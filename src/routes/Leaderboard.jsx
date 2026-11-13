import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { gameApi } from "src/api/gameApi";
import logo from "src/assets/pig-0.png";

// Sample-data buttons exist only in `npm run dev` with the mock server.
const CAN_SEED = import.meta.env.DEV && typeof gameApi.seedSampleGames === "function";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { leaderboard } = await gameApi.getLeaderboard({ limit: 10 });
      setRows(leaderboard);
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err?.message || "Something went wrong");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSampleAction(action) {
    await action();
    load();
  }

  return (
    <div className="p-[5%] pt-24 flex flex-col relative w-full items-center text-white">
      <nav className="fixed top-0 left-0 w-full flex justify-between p-[5%] z-20">
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
          <img src={logo} alt="" width={160} />
        </figure>
        <h1 className="pri-font text-3xl lg:text-5xl text-center">Leaderboard</h1>
        <p className="text-center text-[#F9F7E8] opacity-80">
          Top 10 players by wins. Only players who typed a name are ranked.
        </p>

        <section className="w-full backdrop:blur bg-[#ffffff10] border rounded-lg px-4 sm:px-8 py-6">
          {status === "loading" && (
            <p role="status" className="text-center py-8">
              Loading leaderboard...
            </p>
          )}

          {status === "error" && (
            <div role="alert" className="text-center py-8 space-y-4">
              <p>{errorMessage}</p>
              <button
                onClick={load}
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
            <table className="w-full text-left text-base sm:text-xl">
              <caption className="sr-only">Top players ranked by wins</caption>
              <thead className="text-sm sm:text-base opacity-70">
                <tr>
                  <th scope="col" className="py-2 pr-2 w-10">
                    #
                  </th>
                  <th scope="col" className="py-2">
                    Player
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Wins
                  </th>
                  <th scope="col" className="py-2 text-right hidden sm:table-cell">
                    Games
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Win rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-t border-[#ffffff30]">
                    <td className={`py-3 pr-2 font-bold ${row.rank === 1 ? "text-[#FFD700]" : ""}`}>{row.rank}</td>
                    <td className="py-3 break-all">
                      <Link
                        to={`/players/${encodeURIComponent(row.name)}`}
                        className="underline decoration-[#D30CBD] underline-offset-4 hover:text-[#D30CBD] duration-300 font-bold"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 text-right">{row.wins}</td>
                    <td className="py-3 text-right hidden sm:table-cell">{row.games_played}</td>
                    <td className="py-3 text-right">{row.win_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {CAN_SEED && (
          <div className="flex gap-4 text-sm">
            <button
              onClick={() => runSampleAction(gameApi.seedSampleGames)}
              className="rounded px-4 py-2 border border-[#ffffff80] hover:bg-[#ffffff20] duration-300"
            >
              Add sample games (dev only)
            </button>
            <button
              onClick={() => runSampleAction(gameApi.clearSampleGames)}
              className="rounded px-4 py-2 border border-[#ffffff80] hover:bg-[#ffffff20] duration-300"
            >
              Remove sample games
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
