import React, { useState } from 'react'
import { useLiveGameContext } from 'src/context/useLiveGameContext';
import Menu from "./Menu";
import { Dice } from "src/components/Dice";
import useGameActions from "src/hooks/useGameActions";
import DoubleDownButton from "src/components/DoubleDownButton";


function DiceSectionMobile() {
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
    <div className=" border-r-[#ffffff40] border-r md:hidden flex flex-col items-center justify-around px-2 bg-[#00000010] min-h-[60vh] gap-2 py-2 ">
         <a
          href={"#" + (currentPlayer % playerData.length)}
          className={`bg-[#056FA480] w-[200px] md:w-full  text-white text-center text-base lg:text-xl xl:text-2xl font-semibold py-2 lg:py-4 rounded border hover:scale-105 active:scale-100 duration-300 ${passLocked ? "opacity-40 pointer-events-none" : ""}`}
          onClick={handlePassClick}
          aria-disabled={passLocked}
        >
          {passLabel}
        </a>
        <div className="w-[200px]">
          <DoubleDownButton onDeclare={declareDoubleDown} disabled={locked || isRolling} />
        </div>

        <Dice
          onRoll={roll}
          onRollComplete={showRollResult}
          setIsRolling={setIsRolling}
          isRolling={isRolling}
          setChangeBackground={setChangeBackground}
          disabled={locked}
        />
      
      
        <Menu />
        <div className="text-white flex justify-between w-full">
          <p className="text-center text-sm lg:text-lg">{playerData.length} players</p>
          <p className="text-center text-sm  lg:text-lg">{maxPoints} max points</p>
        </div>
      </div>
  )
}

export default DiceSectionMobile