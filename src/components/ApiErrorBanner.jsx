import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLiveGameContext } from "src/context/useLiveGameContext";

// Errors that cannot be fixed by trying again: the player needs a new game.
const NEEDS_NEW_GAME = ["NO_GAME", "GAME_NOT_FOUND", "GAME_FINISHED"];

export default function ApiErrorBanner({ showSetupLink = false }) {
  const { apiError, setApiError } = useLiveGameContext();

  // Do not carry an old error over to another page.
  useEffect(() => () => setApiError(null), []);

  if (!apiError) return null;

  const fieldMessages = apiError.fields ? Object.values(apiError.fields) : [];
  const isNetwork = apiError.code === "NETWORK_ERROR";

  return (
    <div
      role="alert"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-md rounded-lg border border-[#D30C0C] bg-[#2a0a0a] text-white p-4 shadow-lg"
    >
      <p className="font-semibold">{apiError.message}</p>
      {fieldMessages.length > 0 && (
        <ul className="list-disc pl-5 mt-1 text-sm">
          {fieldMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {isNetwork && <p className="text-sm mt-1">Check your connection, then try again.</p>}
      <div className="flex gap-4 mt-3 text-sm">
        {showSetupLink && NEEDS_NEW_GAME.includes(apiError.code) && (
          <Link to="/live-game/setup" className="underline">
            Back to setup
          </Link>
        )}
        <button type="button" className="underline" onClick={() => setApiError(null)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
