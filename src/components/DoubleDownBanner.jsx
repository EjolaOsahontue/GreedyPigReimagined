import { useLiveGameContext } from "src/context/useLiveGameContext";

// Shown to everyone at the table while the current player's turn is under Double Down.
export default function DoubleDownBanner() {
  const { gameMeta, playerData, currentPlayer, winnerId } = useLiveGameContext();
  if (!gameMeta.doubleDownActive || winnerId) return null;

  const player = playerData[currentPlayer % playerData.length];
  const name = player ? player.name || player.tag : "Player";
  const left = gameMeta.bankUnlockIn;
  const mult = gameMeta.turnMultiplier;
  const turnPoints = player ? player.running_points : 0;

  return (
    <div className="w-full rounded-lg border-2 border-[#FBBF24] bg-[#C2410C] text-white text-center p-3">
      <p className="font-bold tracking-wide text-base lg:text-xl">DOUBLE DOWN ACTIVE x{mult}</p>
      <p className="text-sm lg:text-base">
        {left > 0
          ? `${name}: roll ${left} more ${left === 1 ? "time" : "times"} before you can bank`
          : `${name}: you can bank now. Remember, a 1 costs extra`}
      </p>
      <p className="text-sm lg:text-base">
        Turn points {turnPoints} = {turnPoints * mult} when banked
      </p>
    </div>
  );
}
