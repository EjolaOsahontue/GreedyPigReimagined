import { useEffect, useRef, useState } from "react";
import { useGreedyPigContext } from "src/context/useGreedyPigContext";
import diceRollSound from "src/sound_effect/dice_roll.mp3";
import useAudio from "src/hooks/useAudio";

const MIN_SPIN_TICKS = 30; // 30 x 100ms = 3s minimum spin, same feel as the base game

// The spinning faces are decoration only. The real roll comes from the
// server (onRoll). The dice keeps spinning until the server has answered, then
// lands on the server's number and reports the result via onRollComplete.
export function Dice({
  onRoll, // () => Promise<{ roll, game } | null>, asks the server to roll
  onRollComplete, // (result) => void, called after the dice has stopped
  setIsRolling,
  isRolling,
  setChangeBackground,
  disabled = false,
}) {
  const { preloadSrcList } = useGreedyPigContext();
  const [currentDice, setCurrentDice] = useState(0);
  const die = preloadSrcList.filter((dice) => dice.includes("dice"));
  const diceRollAudio = useAudio(diceRollSound);
  const request = useRef({ done: false, result: null });

  const handleDiceClick = () => {
    if (isRolling || disabled) return;
    request.current = { done: false, result: null };
    // Start the server request now, so it runs while the dice spins.
    onRoll().then((result) => {
      request.current = { done: true, result };
    });
    setIsRolling(true);
    setChangeBackground(true);
  };

  useEffect(() => {
    if (!isRolling) return;
    let ticks = 0;
    const interval = setInterval(() => {
      if (ticks < MIN_SPIN_TICKS || !request.current.done) {
        diceRollAudio?.play();
        setCurrentDice(Math.floor(Math.random() * 6)); // visual only
        ticks++;
        return;
      }
      clearInterval(interval);
      const { result } = request.current;
      if (result) setCurrentDice(result.roll.value - 1);
      setIsRolling(false);
      setChangeBackground(false);
      if (result) onRollComplete(result);
    }, 100);
    return () => clearInterval(interval);
  }, [isRolling]);

  return (
    <>
      <button
        className={`hover:scale-105 active:scale-100 duration-300 md:w-auto w-[200px] disabled:cursor-not-allowed`}
        onClick={handleDiceClick}
        disabled={isRolling || disabled}
        aria-label="Roll the dice"
      >
        {die.map((dice, index) => (
          <img
            key={index}
            src={dice}
            alt={currentDice + 1}
            className={`${currentDice === index ? "" : "hidden"}`}
          />
        ))}
      </button>
    </>
  );
}
