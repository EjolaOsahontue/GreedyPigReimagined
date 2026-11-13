import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { gameApi } from "src/api/gameApi";
import logo from "src/assets/pig-0.png";

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function StatCard({ label, value }) {
  return (
    <div className="bg-[#ffffff10] border rounded-lg px-4 py-5 text-center">
      <p className="pri-font text-3xl lg:text-4xl">{value}</p>
      <p className="text-sm lg:text-base opacity-70">{label}</p>
    </div>
  );
}

export default function PlayerStats() {
  const { name } = useParams(); // react-router already decodes the URL
  const [player, setPlayer] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "not-found" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([gameApi.getPlayerStats(name), gameApi.getPlayerHistory(name, { limit: 10 })])
      .then(([stats, hist]) => {
        if (cancelled) return;
        setPlayer(stats.player);
        setHistory(hist.history);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.code === "PLAYER_NOT_FOUND") {
          setStatus("not-found");
        } else {
          setErrorMessage(err?.message || "Something went wrong");
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [name, attempt]);

  return (
    <div className="p-[5%] pt-24 flex flex-col relative w-full items-center text-white">
      <nav className="fixed top-0 left-0 w-full flex justify-between p-[5%] z-20">
        <Link
          to="/leaderboard"
          className="bg-[#ffffff10] hover:bg-[#ffffff40] duration-300 text-white px-4 h-[48px] border rounded-full flex items-center font-bold"
        >
          Leaderboard
        </Link>
        <Link
          to="/"
          aria-label="Home"
          className="bg-[#D30CBD80] hover:bg-[#D30CBD] duration-300 text-white w-[48px] h-[48px] border rounded-full flex items-center justify-around"
        >
          <AiFillHome size={24} />
        </Link>
      </nav>

      <div className="flex flex-col items-center gap-6 w-full md:max-w-[70%] xl:max-w-[50%]">
        <figure>
          <img src={logo} alt="" width={140} />
        </figure>
        <h1 className="pri-font text-3xl lg:text-5xl text-center break-all">{player?.name || name}</h1>

        {status === "loading" && (
          <p role="status" className="py-8">
            Loading stats...
          </p>
        )}

        {status === "not-found" && (
          <div className="text-center py-8 space-y-4">
            <p>No finished games found for this player yet.</p>
            <Link
              to="/live-game/setup"
              className="inline-block rounded px-6 py-2 bg-[#d30cbcc0] hover:bg-[#d30cbc] font-bold duration-300"
            >
              Play a game
            </Link>
          </div>
        )}

        {status === "error" && (
          <div role="alert" className="text-center py-8 space-y-4">
            <p>{errorMessage}</p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded px-6 py-2 bg-[#d30cbcc0] hover:bg-[#d30cbc] font-bold duration-300"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && player && (
          <>
            <section aria-label="Player stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <StatCard label="Games played" value={player.games_played} />
              <StatCard label="Wins" value={player.wins} />
              <StatCard label="Win rate" value={`${player.win_rate}%`} />
              <StatCard label="Best score" value={player.best_score} />
            </section>
            <p className="opacity-70 text-sm">Last played {formatDate(player.last_played_at)}</p>

            <section className="w-full space-y-4">
              <h2 className="pri-font text-2xl lg:text-3xl">Recent matches</h2>
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.game_id} className="bg-[#ffffff10] border rounded-lg px-4 py-4 flex flex-col gap-1">
                    <div className="flex justify-between items-center gap-4">
                      <span className="font-bold text-lg">
                        {h.won ? "Won" : "Lost"} with {h.final_score}
                        <span className="opacity-70 font-normal"> / {h.target_score}</span>
                      </span>
                      <span className="text-sm opacity-70 whitespace-nowrap">{formatDate(h.played_at)}</span>
                    </div>
                    <p className="text-sm sm:text-base opacity-80">
                      vs{" "}
                      {h.opponents.length
                        ? h.opponents.map((o) => `${o.name || "Unnamed pig"} (${o.final_score})`).join(", ")
                        : "no one else"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
