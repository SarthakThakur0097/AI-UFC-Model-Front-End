"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OddsFightRow from "./OddsFightRow";
import {
  MARKETS,
  clearMarket,
  countEnteredValues,
  countMarketValues,
  fightKey,
  hasAnyOdds,
  normalizeFightOdds,
  setOddsField,
  type FightOddsInput,
  type MarketId,
} from "../lib/odds";
import {
  buildOddsPrompt,
  type OddsEventGroup,
  type PromptFightInput,
  type PromptFighterProfile,
  type PromptFightModel,
} from "../lib/oddsPrompt";
import { getProfilesFor } from "../lib/oddsProfiles";
import {
  clearOddsStore,
  deleteEntries,
  deleteEntry,
  emptyStore,
  exportStore,
  importStore,
  loadOddsStore,
  mergeStores,
  pruneStore,
  reconcileOrientation,
  saveOddsStore,
  staleEntries,
  type OddsStore,
  type OddsStoreEntry,
} from "../lib/oddsStorage";

const SAVE_DEBOUNCE_MS = 400;

const card = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
} as const;

/**
 * Moneyline opens on a fight you haven't touched; any market that already has
 * values opens too. Once the user toggles anything we persist their explicit
 * choice instead, so a market they deliberately collapsed stays collapsed.
 */
function defaultOpenMarkets(odds: FightOddsInput): MarketId[] {
  const withValues = MARKETS.filter((m) => countMarketValues(odds, m.id) > 0).map((m) => m.id);
  return Array.from(new Set<MarketId>(["moneyline", ...withValues]));
}

export default function OddsPage({ groups }: { groups: OddsEventGroup[] }) {
  const [store, setStore] = useState<OddsStore>(emptyStore);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveRefs = useMemo(
    () => groups.flatMap((g) => g.fights.map((f) => ({ event: f.event, f1: f.f1, f2: f.f2 }))),
    [groups]
  );

  // Load once, on mount. This must NOT happen during render: localStorage
  // doesn't exist on the server, so reading it in the render body would make
  // the server HTML and the first client render disagree. Setting state from a
  // mount effect is the intended pattern for hydrating from browser storage,
  // which is why the set-state-in-effect rule is suppressed rather than worked
  // around.
  //
  useEffect(() => {
    const { store: raw, corrupted } = loadOddsStore();
    const pruned = pruneStore(raw, Date.now());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(reconcileOrientation(pruned, liveRefs));
    setLoaded(true);
    if (corrupted) setNotice("Saved odds could not be read and were reset.");
    // Mount-only on purpose: re-running when liveRefs changes identity would
    // clobber in-progress edits with whatever is in localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced persist.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveOddsStore(store, Date.now());
      if (!ok) setNotice("Could not save to this browser (storage full or disabled).");
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store, loaded]);

  // The preview renders at the end of a very long page (50+ fights), so without
  // this it appears thousands of pixels below the fold and clicking Generate
  // looks like it did nothing.
  useEffect(() => {
    if (!preview) return;
    // Called directly rather than inside requestAnimationFrame: useEffect already
    // runs after the DOM is committed, and rAF never fires in a backgrounded tab,
    // which would silently skip the scroll entirely.
    // "auto" rather than "smooth" because this is often a 3000px+ jump.
    previewRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [preview]);

  const stale = useMemo(
    () => (loaded ? staleEntries(store, liveRefs).filter((s) => countEnteredValues(s.entry.odds) > 0) : []),
    [store, liveRefs, loaded]
  );

  const totalEntered = useMemo(
    () =>
      Object.values(store.fights).reduce((sum, e) => sum + countEnteredValues(e.odds), 0),
    [store]
  );
  const fightsWithOdds = useMemo(
    () => Object.values(store.fights).filter((e) => countEnteredValues(e.odds) > 0).length,
    [store]
  );

  const updateEntry = useCallback(
    (model: PromptFightModel, mutate: (entry: OddsStoreEntry) => OddsStoreEntry) => {
      const key = fightKey(model.event, model.f1, model.f2);
      setStore((prev) => {
        const existing: OddsStoreEntry = prev.fights[key] ?? {
          meta: { f1: model.f1, f2: model.f2, event: model.event, savedAt: Date.now() },
          odds: {},
        };
        const next = mutate(existing);
        return {
          ...prev,
          fights: {
            ...prev.fights,
            [key]: { ...next, meta: { ...next.meta, savedAt: Date.now() } },
          },
        };
      });
    },
    []
  );

  const handleGenerate = async () => {
    const all: PromptFightInput[] = groups.flatMap((g) =>
      g.fights.map((model) => {
        const entry = store.fights[fightKey(model.event, model.f1, model.f2)];
        return {
          model,
          odds: normalizeFightOdds(entry?.odds ?? {}),
          notes: entry?.notes,
        };
      })
    );

    // Ratings and radar percentiles aren't in /upcoming, so fetch them now —
    // and only for the fights actually going into the prompt.
    const priced = all.filter((f) => hasAnyOdds(f.odds));
    setGenerating(true);
    setNotice(null);
    let profiles = new Map<string, PromptFighterProfile>();
    try {
      profiles = await getProfilesFor(
        priced.map((f) => ({ f1: f.model.f1, f2: f.model.f2 }))
      );
    } catch {
      // Individual lookups already swallow their own errors; this only fires on
      // something systemic. Build the prompt without the profile sections
      // rather than failing the whole action.
      setNotice("Could not load fighter ratings — prompt built without them.");
    }

    for (const f of priced) {
      f.profiles = {
        f1: profiles.get(f.model.f1) ?? null,
        f2: profiles.get(f.model.f2) ?? null,
      };
    }

    // try/finally so an unexpected throw can't strand the button on
    // "Loading stats…" with no way to retry.
    try {
      const prompt = buildOddsPrompt({
        // Impure by design at the call site — the builder itself takes this in.
        generatedAt: new Date().toISOString(),
        fights: all,
        staleSkipped: stale.length,
      });
      console.log(prompt);
      setPreview(prompt);
    } catch {
      setNotice("Something went wrong building the prompt. Nothing was lost — try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied to clipboard.`);
    } catch {
      setNotice(`Could not copy ${what.toLowerCase()} — select the text manually.`);
    }
  };

  const handleClearAll = () => {
    if (totalEntered === 0) return;
    if (!window.confirm(`Delete all ${totalEntered} entered odds? This cannot be undone.`)) return;
    clearOddsStore();
    setStore(emptyStore());
    setPreview(null);
    setNotice("All saved odds cleared.");
  };

  const handleImport = () => {
    const incoming = importStore(importText);
    if (!incoming) {
      setNotice("That doesn't look like an exported odds file.");
      return;
    }
    setStore((prev) => reconcileOrientation(mergeStores(prev, incoming), liveRefs));
    setImportOpen(false);
    setImportText("");
    setNotice(`Imported ${Object.keys(incoming.fights).length} saved fight(s).`);
  };

  if (groups.length === 0) {
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", padding: "40px 0" }}>
        No upcoming fights available right now. Your saved odds are untouched.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Enter the current book prices for any markets you care about. Everything is
        optional and saves to this browser as you type.
      </p>

      {notice && (
        <div
          className="rounded-xl px-4 py-2 mb-4 flex items-center gap-3"
          style={{ ...card, borderColor: "var(--border)" }}
        >
          <p className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
            {notice}
          </p>
          <span
            role="button"
            tabIndex={0}
            className="text-xs cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setNotice(null)}
            onKeyDown={(e) => e.key === "Enter" && setNotice(null)}
          >
            dismiss
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((group) => {
          const entered = group.fights.filter(
            (f) =>
              countEnteredValues(
                store.fights[fightKey(f.event, f.f1, f.f2)]?.odds ?? {}
              ) > 0
          ).length;

          return (
            <div key={group.event} className="rounded-xl overflow-hidden" style={card}>
              <div
                style={{ borderBottom: "1px solid var(--border)" }}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-bold tracking-wide truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {group.event}
                  </p>
                  <p
                    className="text-xs mt-0.5 uppercase tracking-widest truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {group.date}
                  </p>
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-md font-medium uppercase tracking-wider shrink-0"
                  style={{
                    background: "rgba(0,255,102,0.10)",
                    color: "var(--matrix-green)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {entered}/{group.fights.length} fights
                </span>
              </div>

              {group.fights.map((fight, i) => {
                const key = fightKey(fight.event, fight.f1, fight.f2);
                const entry = store.fights[key];
                const odds = entry?.odds ?? {};
                return (
                  <OddsFightRow
                    key={key}
                    fight={fight}
                    odds={odds}
                    openMarkets={entry?.openMarkets ?? defaultOpenMarkets(odds)}
                    expanded={expanded === key}
                    isLast={i === group.fights.length - 1}
                    onToggleExpand={() => setExpanded(expanded === key ? null : key)}
                    onChangeField={(market, field, value) =>
                      updateEntry(fight, (e) => ({
                        ...e,
                        odds: setOddsField(e.odds, market, field, value),
                      }))
                    }
                    onClearMarket={(market) =>
                      updateEntry(fight, (e) => ({ ...e, odds: clearMarket(e.odds, market) }))
                    }
                    onToggleMarket={(market) =>
                      updateEntry(fight, (e) => {
                        const current = e.openMarkets ?? defaultOpenMarkets(e.odds);
                        return {
                          ...e,
                          openMarkets: current.includes(market)
                            ? current.filter((m) => m !== market)
                            : [...current, market],
                        };
                      })
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Saved odds for fights no longer on the card. Never auto-deleted:
          getUpcomingFights() returns [] on any backend error, so absence is
          not proof a fight is gone. */}
      {stale.length > 0 && (
        <div className="rounded-xl overflow-hidden mt-4" style={card}>
          <div
            style={{ borderBottom: "1px solid var(--border)" }}
            className="px-4 py-3 flex items-center justify-between gap-3"
          >
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Saved odds for {stale.length} fight(s) not on the current card
            </p>
            <span
              role="button"
              tabIndex={0}
              className="text-xs cursor-pointer shrink-0"
              style={{ color: "var(--matrix-red)" }}
              onClick={() => setStore((p) => deleteEntries(p, stale.map((s) => s.key)))}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                setStore((p) => deleteEntries(p, stale.map((s) => s.key)))
              }
            >
              clear all stale
            </span>
          </div>
          {stale.map(({ key, entry }) => (
            <div
              key={key}
              className="px-4 py-2 flex items-center gap-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p className="text-xs flex-1 truncate" style={{ color: "var(--text-muted)" }}>
                {entry.meta.event} — {entry.meta.f1} vs {entry.meta.f2} —{" "}
                {countEnteredValues(entry.odds)} values
              </p>
              <span
                role="button"
                tabIndex={0}
                className="text-xs cursor-pointer shrink-0"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setStore((p) => deleteEntry(p, key))}
                onKeyDown={(e) => e.key === "Enter" && setStore((p) => deleteEntry(p, key))}
              >
                delete
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Import panel */}
      {importOpen && (
        <div className="rounded-xl p-4 mt-4" style={card}>
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Paste a previously exported odds file:
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            spellCheck={false}
            className="w-full text-xs px-2 py-2 rounded outline-none"
            style={{
              background: "var(--bg-detail)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleImport}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: "rgba(0,255,102,0.10)",
                border: "1px solid var(--matrix-green)",
                color: "var(--matrix-green)",
              }}
            >
              Load
            </button>
            <button
              onClick={() => setImportOpen(false)}
              className="text-xs px-3 py-1.5 rounded"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Generated prompt */}
      {preview && (
        <div ref={previewRef} className="rounded-xl overflow-hidden mt-4" style={card}>
          <div
            style={{ borderBottom: "1px solid var(--border)" }}
            className="px-4 py-3 flex items-center justify-between gap-3"
          >
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              Generated prompt ({preview.length.toLocaleString()} chars)
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => copy(preview, "Prompt")}
                className="text-xs px-3 py-1 rounded"
                style={{
                  background: "rgba(0,255,102,0.10)",
                  border: "1px solid var(--matrix-green)",
                  color: "var(--matrix-green)",
                }}
              >
                Copy
              </button>
              <button
                onClick={() => setPreview(null)}
                className="text-xs px-2 py-1 rounded"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Close
              </button>
            </div>
          </div>
          <pre
            className="px-4 py-3 text-xs"
            style={{
              color: "var(--text-secondary)",
              maxHeight: 420,
              overflow: "auto",
              whiteSpace: "pre",
            }}
          >
            {preview}
          </pre>
        </div>
      )}

      {/* Sticky action bar — bottom, because after scrolling into fight 9's
          exact-method grid you are a long way from the top of the page. */}
      <div
        className="flex items-center gap-2 mt-4 px-3 py-3 rounded-xl"
        style={{
          position: "sticky",
          bottom: 12,
          background: "var(--bg-detail)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(6px)",
        }}
      >
        <p className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
          {totalEntered} value{totalEntered === 1 ? "" : "s"} across {fightsWithOdds} fight
          {fightsWithOdds === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => copy(exportStore(store), "Backup")}
          disabled={totalEntered === 0}
          className="text-xs px-2.5 py-1.5 rounded disabled:opacity-40"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Export
        </button>
        <button
          onClick={() => setImportOpen((v) => !v)}
          className="text-xs px-2.5 py-1.5 rounded"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Import
        </button>
        <button
          onClick={handleClearAll}
          disabled={totalEntered === 0}
          className="text-xs px-2.5 py-1.5 rounded disabled:opacity-40"
          style={{ border: "1px solid var(--border)", color: "var(--matrix-red)" }}
        >
          Clear all
        </button>
        <button
          onClick={handleGenerate}
          disabled={totalEntered === 0 || generating}
          className="text-xs px-4 py-1.5 rounded font-medium disabled:opacity-40"
          style={{
            background: "rgba(0,255,102,0.10)",
            border: "1px solid var(--matrix-green)",
            color: "var(--matrix-green)",
          }}
        >
          {generating ? "Loading stats…" : "Generate prompt"}
        </button>
      </div>
    </div>
  );
}
