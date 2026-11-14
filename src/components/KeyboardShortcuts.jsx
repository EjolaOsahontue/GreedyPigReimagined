import { useEffect } from "react";

// The game draws a desktop copy and a mobile copy of the controls, and CSS hides one.
// So we look for the copy that is actually visible.
function findVisible(action) {
  const candidates = document.querySelectorAll(`[data-action="${action}"]`);
  return Array.from(candidates).find((el) => el.getClientRects().length > 0);
}

// R rolls and B banks (passes). It presses the real on-screen button, so every
// rule that blocks the button (rolling, game over) blocks the key too.
export default function KeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.repeat) return; // holding a key down must not spam rolls
      if (e.ctrlKey || e.metaKey || e.altKey) return; // keep Ctrl+R (reload) etc. working

      const target = e.target;
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return; // the player is typing, not playing
      }
      if (document.querySelector('[aria-modal="true"]')) return; // a pop-up is open

      const key = e.key.toLowerCase();
      const action = { r: "roll", b: "pass" }[key];
      if (!action) return;

      const button = findVisible(action);
      if (!button) return;
      e.preventDefault();
      button.click();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}