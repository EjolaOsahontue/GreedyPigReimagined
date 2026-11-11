import { useEffect, useRef, useState } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";

const nameOf = (player) => (player ? player.name || player.tag : "Player");

// Speaks what is happening to screen reader users. It draws nothing visible.
// FeedbackMessage already speaks bust, bank and Double Down declared, so this adds
// the parts that are missing: plain rolls, bank totals and whose turn is next.
export default function ScreenReaderAnnouncer() {
  const { lastEvent, playerData, currentPlayer, gameMeta } = useLiveGameContext();
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
        if (lastEvent.multiplier > 1) {
          text += ` Double Down active, worth ${lastEvent.turn_total * lastEvent.multiplier} if banked.`;
        }
        if (gameMeta.bankUnlockIn > 0) {
          const times = gameMeta.bankUnlockIn === 1 ? "time" : "times";
          text += ` Roll ${gameMeta.bankUnlockIn} more ${times} before banking.`;
        }
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
  }, [lastEvent, playerData, currentPlayer, gameMeta]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}