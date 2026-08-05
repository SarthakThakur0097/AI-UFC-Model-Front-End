import Navbar from "./components/Navbar";
import FightCard from "./components/FightCard";
import PastCard from "./components/PastCard";
import CalibrationPage from "./components/Calibrationpage";
import MethodologyPage from "./components/MethodologyPage";
import OddsPage from "./components/OddsPage";
import { getPastCards, getAccuracy, getUpcomingFights, groupByEvent } from "./lib/api";
import type { OddsEventGroup, PromptFightModel } from "./lib/oddsPrompt";
import MatrixRain from "./components/MatrixRain";

export default async function Home({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab || "upcoming";

  if (tab === "calibration") {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--bg-primary)" }}
      >
        <MatrixRain />
        <Navbar activeTab="calibration" />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
          <p
            className="text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Model Calibration
          </p>
          <CalibrationPage />
        </div>
      </main>
    );
  }

  if (tab === "methodology") {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--bg-primary)" }}
      >
        <MatrixRain />
        <Navbar activeTab="methodology" />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
          <p
            className="text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Methodology
          </p>
          <MethodologyPage />
        </div>
      </main>
    );
  }

  // Odds entry. Intentionally NOT linked from Navbar — this is a personal
  // tool, reachable only by typing /?tab=odds. Unlisted, not access-controlled:
  // the route still responds in production for anyone who knows the URL.
  if (tab === "odds") {
    const upcoming = await getUpcomingFights();

    // Deliberately NOT reusing the `fightsWithPredictions` projection below:
    // that one substitutes 50/50 probabilities for fights the model couldn't
    // predict, which would manufacture a phantom edge against every real
    // market price. Here an unpredicted fight carries hasPrediction: false and
    // leaves every probability undefined.
    const oddsFights: PromptFightModel[] = upcoming.map((f) => {
      const hasPrediction = !f.error && f.pick !== undefined;
      return {
        event: f.event,
        date: f.date,
        tag: f.tag,
        weightClass: f.weightClass,
        f1: f.f1,
        f2: f.f2,
        hasPrediction,
        pick: hasPrediction ? f.pick : undefined,
        conf: hasPrediction ? f.conf : undefined,
        f1Prob: hasPrediction ? f.f1Prob : undefined,
        f2Prob: hasPrediction ? f.f2Prob : undefined,
        method: f.method ?? null,
        methodPerFighter: f.methodPerFighter ?? null,
        // Ships with /upcoming already and measures ~5KB across a whole 52-fight
        // slate, so carrying it through costs essentially nothing. Glicko and the
        // radar are NOT here — those are fetched per fighter at generate time.
        commonOpponents: f.commonOpponents ?? null,
      };
    });

    const oddsGroups: OddsEventGroup[] = groupByEvent(oddsFights);

    return (
      <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <MatrixRain />
        <Navbar activeTab="odds" />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
          <p
            className="text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Odds Entry
          </p>
          <OddsPage groups={oddsGroups} />
        </div>
      </main>
    );
  }

  if (tab === "past") {
    const pastCards = await getPastCards(20);

    // Calculate accuracy from displayed cards
    const allFights = pastCards.flatMap((card: any) => card.fights);
    const totalFights = allFights.length;
    const correctFights = allFights.filter((f: any) => f.correct).length;
    const accuracy =
      totalFights > 0
        ? ((correctFights / totalFights) * 100).toFixed(1)
        : "0.0";

    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--bg-primary)" }}
      >
        <MatrixRain />
        <Navbar activeTab="past" />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
          <p
            className="text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Past Cards
          </p>

          {/* Accuracy summary */}
          <div
            className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <p className="text-xs font-medium text-white">2026 Accuracy</p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Based on {totalFights} fights shown
              </p>
            </div>
            <span
              className="text-lg font-semibold"
              style={{ color: "#4ade80" }}
            >
              {accuracy}%
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {pastCards.map((card: any, i: number) => (
              <PastCard
                key={i}
                event={card.event}
                date={card.date}
                fights={card.fights.map((f: any) => ({
                  f1: f.f1,
                  f2: f.f2,
                  pick: f.pick,
                  conf: f.conf,
                  correct: f.correct,
                  result: f.method,
                  f1_prob: f.f1_prob,
                  f2_prob: f.f2_prob,
                  actual_winner: f.actual_winner,
                  method_pred: f.method_pred,
                  method_per_fighter: f.method_per_fighter,
                }))}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Fetch upcoming fights — predictions are precomputed server-side and arrive
  // attached, so there is NO per-fight model call on a user visit.
  const upcomingFights = await getUpcomingFights();

  const fightsWithPredictions = upcomingFights.map((fight) => {
    const hasPred = !fight.error && fight.pick !== undefined;
    return {
      tag: fight.tag,
      tagColor: fight.tagColor,
      f1: fight.f1,
      f1Record: fight.f1Record,
      f2: fight.f2,
      f2Record: fight.f2Record,
      event: fight.event,
      date: fight.date,
      pick: hasPred ? (fight.pick as string) : "—",
      conf: hasPred ? (fight.conf as number) : 0,
      f1Prob: hasPred ? (fight.f1Prob as number) : 50,
      f2Prob: hasPred ? (fight.f2Prob as number) : 50,
      error: !hasPred,
      method: fight.method ?? { Decision: 0, "KO/TKO": 0, Submission: 0 },
      methodPerFighter: fight.methodPerFighter ?? null,
      commonOpponents: fight.commonOpponents ?? null,
    };
  });

  // Group by event name preserving insertion order
  const eventGroups = groupByEvent(fightsWithPredictions);

  const accuracy = await getAccuracy();

  return (
    <main className="min-h-screen" style={{ position: "relative", zIndex: 1 }}>
      <MatrixRain />
      <Navbar activeTab="upcoming" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Upcoming Events
            </h1>
            <div className="flex items-center gap-2">
              {accuracy && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(74, 222, 128, 0.08)",
                    border: "1px solid rgba(74, 222, 128, 0.2)",
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "#4ade80" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#4ade80" }}
                  >
                    {accuracy.accuracy}% accuracy
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    · last {accuracy.total}
                  </span>
                </div>
              )}
              {accuracy?.vegas && accuracy.vegas.accuracy !== null && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(148, 163, 184, 0.08)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    vs Vegas: {accuracy.vegas.accuracy}%
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    · {accuracy.vegas.window} baseline
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            AI predictions for all bouts
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {eventGroups.map((group, i) => (
            <FightCard
              key={i}
              event={group.event}
              date={group.date}
              fights={group.fights}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
