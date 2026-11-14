import { useEffect, useRef, useState } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";

const SHOW_MS = 1400;

// A "+2" (or "ON FIRE!") that fades up in the free space under the player table when a roll
// earns a bonus or sets the player on fire. Purely visual: screen readers get the same news
// from the live regions, so this is hidden from them.
export default function BonusPopup() {
  const { lastEvent } = useLiveGameContext();
  const [popup, setPopup] = useState(null);
  const handledId = useRef(lastEvent?.id); // do not replay an old event when the screen is re-entered
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!lastEvent || lastEvent.id === handledId.current) return;
    handledId.current = lastEvent.id;
    if (lastEvent.type !== "roll") return;

    let text = null;
    if (lastEvent.caught_fire) text = "ON FIRE!";
    else if (lastEvent.bonus > 0) text = `+${lastEvent.bonus}`;
    if (!text) return;

    clearTimeout(timer.current);
    setPopup({ id: lastEvent.id, text });
    timer.current = setTimeout(() => setPopup(null), SHOW_MS);
  }, [lastEvent]);

  // The box is always there, so the page does not jump when the text appears.
  return (
    <div
      aria-hidden="true"
      className="min-h-[72px] flex items-center justify-center pointer-events-none select-none"
    >
      {popup && (
        <span
          key={popup.id}
          className="bonus-pop text-4xl md:text-5xl font-extrabold text-[#FBBF24] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
        >
          {popup.text}
        </span>
      )}
    </div>
  );
}