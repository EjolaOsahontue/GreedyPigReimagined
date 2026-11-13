import { useEffect, useRef, useState } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";

const SHOW_MS = 1600;

// A big "+2" (or "ON FIRE!") that pops up when a roll earns a bonus or sets the
// player on fire. Purely visual: screen readers get the same news from the live
// regions, so this is hidden from them.
export default function BonusPopup() {
  const { lastEvent } = useLiveGameContext();
  const [popup, setPopup] = useState(null);
  const handledId = useRef(lastEvent?.id); // do not replay an old event when the screen is re-entered

  useEffect(() => {
    if (!lastEvent || lastEvent.id === handledId.current) return;
    handledId.current = lastEvent.id;
    if (lastEvent.type !== "roll") return;

    let next = null;
    if (lastEvent.caught_fire) next = "ON FIRE!";
    else if (lastEvent.bonus > 0) next = `+${lastEvent.bonus} BONUS`;
    if (!next) return;

    setPopup({ id: lastEvent.id, text: next });
    const timer = setTimeout(() => setPopup(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [lastEvent]);

  if (!popup) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none text-4xl md:text-6xl font-extrabold text-[#FBBF24] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] motion-safe:animate-bounce"
    >
      {popup.text}
    </div>
  );
}
