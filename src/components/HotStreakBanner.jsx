import { useLiveGameContext } from "src/context/useLiveGameContext";
import { HOT_STREAK } from "src/utils/hotStreak";

// Streak counter for the player whose turn it is. Turns into the ON FIRE banner
// once the server says the player is on fire. Everyone at the table sees it.
export default function HotStreakBanner() {
  const { playerData, currentPlayer, winnerId } = useLiveGameContext();
  const player = playerData[currentPlayer % playerData.length];
  if (!player || winnerId) return null;

  const name = player.name || player.tag;
  const streak = player.streak ?? 0; // an older server does not send these yet
  const bonus = player.bonus_this_turn ?? 0;

  if (player.on_fire) {
    return (
      <div className="fire-banner w-full rounded-lg border-2 border-[#FBBF24] bg-[#C2410C] text-white text-center p-3">
        <p className="font-bold tracking-wide text-base lg:text-xl">
          <span aria-hidden="true">🔥 </span>ON FIRE! +{HOT_STREAK.bonusPerRoll} on every roll
        </p>
        <p className="text-sm lg:text-base">
          {name}: streak {streak}. Bonus so far {bonus} of {HOT_STREAK.bonusCap}.
        </p>
      </div>
    );
  }

  // No glow at streak 0. It warms up as the circles fill.
  const glow = streak >= 2 ? "streak-glow-2" : streak === 1 ? "streak-glow-1" : "";

  return (
    <div className={`${glow} w-full rounded-lg border border-[#ffffff40] bg-[#ffffff10] text-white p-2 flex flex-wrap items-center justify-between gap-2`}>
      <span className="text-sm lg:text-base">
        {name}: streak <strong>{streak}</strong>
      </span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: HOT_STREAK.igniteAt }, (_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full ${i < streak ? "bg-[#FBBF24]" : "bg-[#ffffff30]"}`} />
        ))}
      </span>
      <span className="text-xs lg:text-sm opacity-80">
        {HOT_STREAK.igniteAt} rolls in a row without a 1 = ON FIRE
      </span>
    </div>
  );
}