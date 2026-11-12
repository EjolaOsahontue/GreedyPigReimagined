import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SHORTCUTS } from "src/utils/shortcuts";

const STEPS = [
  {
    title: "Roll the dice",
    text: "Press Roll to throw the dice. Whatever you roll is added to your turn total. Try a practice roll below.",
    practice: true,
  },
  {
    title: "Bank your points",
    text: "Press PASS to bank your turn total into your score and hand over the turn. Points you have not banked are at risk.",
  },
  {
    title: "Watch out for a 1",
    text: "Roll a 1 and you lose your turn points and the turn passes. Double Down, once per game before your first roll, doubles what you bank, but you must roll at least 3 times first and a 1 costs you extra.",
  },
  {
    title: "Win and keyboard keys",
    text: "The first player to reach the target score wins. You can also play with the keyboard on a computer, and mute sounds from the game menu.",
    keys: true,
  },
];

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const [practice, setPractice] = useState({ count: 0, value: null });
  const dialogRef = useRef(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Practice only: this number is never sent to the server and never counts.
  // The first practice roll can never be a 1, so a new player gets a good start.
  function practiceRoll() {
    const value =
      practice.count === 0 ? 2 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 6);
    setPractice({ count: practice.count + 1, value });
  }

  // On open: move focus into the dialog. On close: give focus back to where it was.
  useEffect(() => {
    const before = document.activeElement;
    dialogRef.current?.querySelector("[data-autofocus]")?.focus();
    return () => before?.focus?.();
  }, []);

  // Escape closes. Tab stays inside the dialog while it is open.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll("button, a[href]");
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="w-full max-w-md bg-[#1a0a2a] text-white border border-[#ffffff40] rounded-xl p-6 space-y-4"
      >
        <p className="text-sm opacity-80">
          Step {step + 1} of {STEPS.length}
        </p>

        <div aria-live="polite" className="space-y-3">
          <h2 id="tutorial-title" className="pri-font text-2xl">
            {current.title}
          </h2>
          <p className="text-base">{current.text}</p>

          {current.practice && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={practiceRoll}
                className="min-h-[48px] px-4 rounded-lg bg-[#056FA4] border border-[#ffffff60] font-semibold"
              >
                Practice roll
              </button>
              {practice.value !== null && (
                <p className="text-sm">
                  {practice.value === 1
                    ? "You rolled 1. In a real game you would lose your turn points. Not here, this is only practice."
                    : `You rolled ${practice.value}. In a real game this would be added to your turn total.`}{" "}
                  Practice rolls never count.
                </p>
              )}
            </div>
          )}

          {current.keys && (
            <ul className="space-y-2">
              {SHORTCUTS.map(([key, action]) => (
                <li key={key} className="flex items-center gap-3">
                  <kbd className="min-w-[3rem] text-center px-2 py-1 rounded bg-[#ffffff20] border border-[#ffffff60] font-bold">
                    {key}
                  </kbd>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button type="button" onClick={onClose} className="min-h-[48px] px-2 underline">
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="min-h-[48px] px-4 rounded-lg bg-[#ffffff20] border border-[#ffffff60]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              data-autofocus
              onClick={() => (isLast ? onClose() : setStep(step + 1))}
              className="min-h-[48px] px-5 rounded-lg bg-[#D30CBD] font-bold"
            >
              {isLast ? "Start playing" : "Next"}
            </button>
          </div>
        </div>

        <Link
          to="/live-game/how-to-play"
          onClick={onClose}
          className="inline-block text-sm underline"
        >
          Read the full rules
        </Link>
      </div>
    </div>
  );
}