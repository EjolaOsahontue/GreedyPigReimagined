import { useEffect, useState } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";

const COLOURS = {
  good: "bg-[#14532D] border-[#4ADE80]",
  bad: "bg-[#7F1D1D] border-[#F87171]",
  info: "bg-[#1E3A5F] border-[#60A5FA]",
};

// A short message for what just happened (banked, bust, on fire).
// It is a polite live region, so screen readers hear it as well.
export default function FeedbackMessage() {
  const { feedback } = useLiveGameContext();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!feedback) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!feedback || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md rounded-lg border p-3 text-white text-center shadow-lg ${COLOURS[feedback.type] || COLOURS.info}`}
    >
      {feedback.text}
    </div>
  );
}
