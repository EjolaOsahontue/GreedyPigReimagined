import React, { useState } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";
import Menu from "./Menu";
import { Dice } from "src/components/Dice";
import useGameActions from "src/hooks/useGameActions";
import DoubleDownButton from "src/components/DoubleDownButton";

function DiceSection() {
  const { playerData, setChangeBackground, currentPlayer, maxPoints, winnerId, gameMeta } =
    useLiveGameContext();
  const { roll, showRollResult, bank, declareDoubleDown, isBusy } = useGameActions();
  const [isRolling, setIsRolling] = useState(false);
  const locked = isBusy || Boolean(winnerId); // request in flight, or the game is already won
  // The server says when banking is allowed (Double Down locks it until enough rolls).
  const passLocked = locked || !gameMeta.allowed.bank;
  const passLabel = gameMeta.bankUnlockIn > 0 ? `Roll ${gameMeta.bankUnlockIn} more` : "PASS";

  const handlePassClick = () => {
    if (isRolling || passLocked) return;
    bank();
  };

  return (
    <div className="h-screen border-r-[#ffffff40] border-r hidden md:flex flex-col items-center justify-around p-8 sticky top-0 bg-[#00000010] ">
      <Dice
        onRoll={roll}
        onRollComplete={showRollResult}
        setIsRolling={setIsRolling}
        isRolling={isRolling}
        setChangeBackground={setChangeBackground}
        disabled={locked}
      />
      <DoubleDownButton onDeclare={declareDoubleDown} disabled={locked || isRolling} />
      <a
        href={"#" + (currentPlayer % playerData.length)}
        className={`bg-[#056FA4c0] w-full  text-white text-center text-base lg:text-xl xl:text-2xl font-semibold py-2 lg:py-4 rounded-lg border hover:scale-105 active:scale-100 duration-300 ${passLocked ? "opacity-40 pointer-events-none" : ""}`}
        onClick={handlePassClick}
        aria-disabled={passLocked}
      >
        {passLabel}
      </a>
      <div className="text-white grid place-content-center gap-2 bg-[#ffffff10] w-full p-4 rounded-lg border border-[#ffffff40]">
        <p className="text-center text-sm lg:text-lg">
          {playerData.length} players
        </p>
        <p className="text-center text-sm  lg:text-lg">
          {maxPoints} max points
        </p>
      </div>
      <Menu />
    </div>
  );
}

export default DiceSection;
