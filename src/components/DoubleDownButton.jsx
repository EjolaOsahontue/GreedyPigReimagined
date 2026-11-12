import { useId } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";

// Double Down: declared before the first roll of a turn, once per game per player.
// The server decides whether it is allowed (gameMeta.allowed.doubleDown).
// This button only shows that answer, it never works out the rule itself.
export default function DoubleDownButton({ onDeclare, disabled = false }) {
  const { playerData, currentPlayer, gameMeta } = useLiveGameContext();
  const hintId = useId();

  const player = playerData[currentPlayer % playerData.length];
  const used = Boolean(player?.double_down_used);
  const active = gameMeta.doubleDownActive;
  const enabled = gameMeta.allowed.doubleDown && !disabled;

  let label = "Double Down x2";
  let hint = "Once per game, before your first roll";
  if (active) {
    label = "Double Down ACTIVE";
    hint = "Roll to build your turn total";
  } else if (used) {
    label = "Double Down used";
    hint = "Already used this game";
  } else if (gameMeta.rollsThisTurn > 0) {
    hint = "Only before your first roll";
  }

  return (
    <div className="w-full flex flex-col items-center gap-1">
      <button
        data-action="doubledown"
        aria-keyshortcuts="D"
        type="button"
        onClick={onDeclare}
        disabled={!enabled}
        aria-describedby={hintId}
        className="w-full bg-[#C2410C] text-white text-center text-sm lg:text-lg font-semibold py-2 rounded-lg border border-[#ffffff60] hover:scale-105 active:scale-100 duration-300 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
      >
        {label}
      </button>
      <span id={hintId} className="text-white text-xs opacity-80 text-center">
        {hint}
      </span>
    </div>
  );
}
