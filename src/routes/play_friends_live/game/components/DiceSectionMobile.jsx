import React, { useState } from 'react'
import { useLiveGameContext } from 'src/context/useLiveGameContext';
import Menu from "./Menu";
import { Dice } from "src/components/Dice";
import useGameActions from "src/hooks/useGameActions";


function DiceSectionMobile() {
  const { playerData, setChangeBackground, currentPlayer, maxPoints, winnerId } =
    useLiveGameContext();
  const { roll, showRollResult, bank, isBusy } = useGameActions();
  const [isRolling, setIsRolling] = useState(false);
  const locked = isBusy || Boolean(winnerId); // request in flight, or the game is already won

  const handlePassClick = () => {
    if (isRolling || locked) return;
    bank();
  };

  return (
    <div className=" border-r-[#ffffff40] border-r md:hidden flex flex-col items-center justify-around px-2 bg-[#00000010] h-[60vh] ">
         <a
          href={"#" + (currentPlayer % playerData.length)}
          className="bg-[#056FA480] w-[200px] md:w-full  text-white text-center text-base lg:text-xl xl:text-2xl font-semibold py-2 lg:py-4 rounded border hover:scale-105 active:scale-100 duration-300"
          onClick={handlePassClick}
        >
          PASS
        </a>

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