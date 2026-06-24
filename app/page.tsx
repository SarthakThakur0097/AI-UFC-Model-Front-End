import Navbar from "./components/Navbar";
import FightCard from "./components/FightCard";
import PastCard from "./components/PastCard";
import { getPastCards, getAccuracy, getUpcomingFights } from "./lib/api";
import MatrixRain from "./components/MatrixRain";

export default async function Home({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab || "upcoming";

  if (tab === "past") {
    const pastCards = await getPastCards(10);

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
    };
  });

  // Group by event name preserving insertion order
  const eventMap = new Map<
    string,
    { event: string; date: string; fights: typeof fightsWithPredictions }
  >();
  for (const fight of fightsWithPredictions) {
    if (!eventMap.has(fight.event)) {
      eventMap.set(fight.event, {
        event: fight.event,
        date: fight.date,
        fights: [],
      });
    }
    eventMap.get(fight.event)!.fights.push(fight);
  }
  const eventGroups = Array.from(eventMap.values());

  const accuracy = await getAccuracy();

  return (
    <main className="min-h-screen" style={{ position: "relative", zIndex: 1 }}>
      <MatrixRain />
      <Navbar activeTab="upcoming" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <p className="text-xs font-medium text-red-500 uppercase tracking-widest mb-1">
          Upcoming Events
        </p>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm text-gray-400">AI predictions for all bouts</p>
          {accuracy && (
            <span className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">
              {accuracy.accuracy}% accuracy on last {accuracy.total} fights
            </span>
          )}
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