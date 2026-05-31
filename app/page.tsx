import Navbar from "./components/Navbar";
import FightCard from "./components/FightCard";
import PastCard from "./components/PastCard";
import { upcomingFights } from "./lib/fights";
import { getPrediction, getPastCards, getAccuracy } from "./lib/api";

export default async function Home({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab || "upcoming";

  if (tab === "past") {
    const pastCards = await getPastCards(10);
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar activeTab="past" />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
          <p
            className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Past Cards
          </p>
          <div className="flex flex-col gap-4">
            {pastCards.map((card: any, i: number) => (
              <PastCard
                key={i}
                event={card.event}
                venue={card.date}
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

  const [fights, accuracy] = await Promise.all([
    Promise.all(
      upcomingFights.map(async (fight) => {
        const prediction = await getPrediction(fight.f1, fight.f2);
        if (!prediction) {
          return {
            ...fight,
            pick: "—",
            conf: 0,
            f1Prob: 50,
            f2Prob: 50,
            error: true,
            method: { Decision: 0, "KO/TKO": 0, Submission: 0 },
          };
        }
        return { ...fight, ...prediction, error: false };
      }),
    ),
    getAccuracy(),
  ]);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar activeTab="upcoming" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <p className="text-xs font-medium text-red-500 uppercase tracking-widest mb-1">
          Next Event
        </p>
        <h1 className="text-xl font-medium text-white mb-1">
          UFC Fight Night — May 31, 2026
        </h1>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm text-gray-400">AI predictions for all bouts</p>
          {accuracy && (
            <span className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">
              {accuracy.accuracy}% accuracy on last {accuracy.total} fights
            </span>
          )}
        </div>
        <FightCard fights={fights} />
      </div>
    </main>
  );
}
