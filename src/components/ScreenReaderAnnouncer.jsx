import { useEffect, useRef, useState } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";

const nameOf = (player) => (player ? player.name || player.tag : "Player");

export default function ScreenReaderAnnouncer() {
  const { lastEvent, playerData, currentPlayer } = useLiveGameContext();
  const [message, setMessage] = useState("");

  // Start from the current event, so an old one is not announced again on re-entry.
  const handledId = useRef(lastEvent?.id);

  useEffect(() => {
    if (!lastEvent || lastEvent.id === handledId.current) return;
    handledId.current = lastEvent.id;

    const actor = nameOf(playerData.find((p) => p.id === lastEvent.player_id));
    const next = nameOf(playerData[currentPlayer]);
    let text = "";

    if (lastEvent.type === "roll") {
      if (lastEvent.outcome === "continue") {
        text = `${actor} rolled ${lastEvent.value}. Turn total ${lastEvent.turn_total}.`;
      } else if (lastEvent.outcome === "bust") {
        text = `Now ${next}'s turn.`;
      } else if (lastEvent.outcome === "win") {
        text = `${actor} rolled ${lastEvent.value} and wins the game.`;
      }
    }

    if (lastEvent.type === "bank") {
      const banker = playerData.find((p) => p.id === lastEvent.player_id);
      text = `${actor} now has ${banker ? banker.total_points : 0} points. ${next}'s turn.`;
    }

    if (text) setMessage(text);
  }, [lastEvent, playerData, currentPlayer]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}