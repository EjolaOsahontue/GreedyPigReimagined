import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { gameApi } from "src/api/gameApi";
import logo from "src/assets/pig-0.webp";

// How often the board quietly refreshes while the tab is open and visible.
const REFRESH_MS = 20000;

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const hasData = useRef(false);

  // `silent` refreshes never flash "Loading..." and never replace a good board with an error.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus("loading");
    try {
      const { leaderboard } = await gameApi.getLeaderboard({ limit: 10 });
      setRows(leaderboard);
      hasData.current = true;
      setStatus("ready");
    } catch (err) {
      if (silent && hasData.current) return; // keep showing the last good board
      setErrorMessage(err?.message || "Something went wrong");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();

    const refresh = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  return (
    <div className="px-4 sm:px-[5%] pb-10 pt-20 sm:pt-24 flex flex-col relative w-full items-center text-white">
      <nav className="fixed top-0 left-0 w-full flex justify-between p-4 sm:p-[5%] z-20">
        <Link
          to="/"
          aria-label="Home"
          className="bg-[#D30CBD80] hover:bg-[#D30CBD] duration-300 text-white w-[48px] h-[48px] border rounded-full flex items-center justify-around"
        >
          <AiFillHome size={24} />
        </Link>
      </nav>

      <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-3xl">
        <figure>
          <img src={logo} alt="" className="w-28 sm:w-40" />
        </figure>
        <h1 className="pri-font text-3xl sm:text-4xl lg:text-5xl text-center">Leaderboard</h1>
        <p className="text-center text-sm sm:text-base text-[#F9F7E8] opacity-80">
          Top 10 players by wins. Only players who typed a name are ranked.
        </p>

        <section className="w-full backdrop:blur bg-[#ffffff10] border rounded-lg px-3 sm:px-8 py-4 sm:py-6">
          {status === "loading" && (
            <p role="status" className="text-center py-8">
              Loading leaderboard...
            </p>
          )}

          {status === "error" && (
            <div role="alert" className="text-center py-8 space-y-4">
              <p>{errorMessage}</p>
              <button
                onClick={() => load()}
                className="rounded px-6 py-2 bg-[#d30cbcc0] hover:bg-[#d30cbc] font-bold duration-300"
              >
                Try again
              </button>
            </div>
          )}

          {status === "ready" && rows.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <p>No finished games yet. Finish a game with named players to appear here.</p>
              <Link
                to="/live-game/setup"
                className="inline-block rounded px-6 py-2 bg-[#d30cbcc0] hover:bg-[#d30cbc] font-bold duration-300"
              >
                Play a game
              </Link>
            </div>
          )}

          {status === "ready" && rows.length > 0 && (
            <table className="w-full table-fixed text-left text-sm sm:text-lg lg:text-xl">
              <caption className="sr-only">Top players ranked by wins</caption>
              <thead className="text-xs sm:text-base opacity-70">
                <tr>
                  <th scope="col" className="py-2 pr-1 w-8 sm:w-12">
                    #
                  </th>
                  <th scope="col" className="py-2">
                    Player
                  </th>
                  <th scope="col" className="py-2 text-right w-12 sm:w-20">
                    Wins
                  </th>
                  <th scope="col" className="py-2 text-right w-14 sm:w-24 hidden min-[420px]:table-cell">
                    Games
                  </th>
                  <th scope="col" className="py-2 text-right w-14 sm:w-24">
                    Win %
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-t border-[#ffffff30]">
                    <td className={`py-3 pr-1 font-bold ${row.rank === 1 ? "text-[#FFD700]" : ""}`}>{row.rank}</td>
                    <td className="py-3 pr-2 truncate">
                      <Link
                        to={`/players/${encodeURIComponent(row.name)}`}
                        className="underline decoration-[#D30CBD] underline-offset-4 hover:text-[#D30CBD] duration-300 font-bold"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 text-right">{row.wins}</td>
                    <td className="py-3 text-right hidden min-[420px]:table-cell">{row.games_played}</td>
                    <td className="py-3 text-right">{row.win_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
