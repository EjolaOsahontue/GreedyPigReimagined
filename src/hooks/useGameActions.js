import { useEffect, useRef } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";
import { gameApi, ApiError } from "src/api/gameApi";
import useAudio from "src/hooks/useAudio";
import addPlayerSound from "src/sound_effect/add_player.mp3";
import loseSound from "src/sound_effect/lose_sound.mp3";
import celebrationSound from "src/sound_effect/celebration.mp3";

const GAME_OVER_DELAY_MS = 1000; // same pause the base game used before the winner screen

// The only place the UI talks to the game API. Components call these
// functions; they never roll dice or add up scores themselves, because the
// server owns the rules (see docs/API_CONTRACT.md).
export default function useGameActions() {
  const {
    playerData,
    maxPoints,
    gameId,
    isBusy,
    setGameId,
    setPlayerData,
    setCurrentPlayer,
    setDiceValue,
    setIsGameOver,
    setWinnerId,
    setIsBusy,
    setApiError,
  } = useLiveGameContext();

  const addPlayerAudio = useAudio(addPlayerSound);
  const loseAudio = useAudio(loseSound);
  const celebrationAudio = useAudio(celebrationSound);
  const gameOverTimer = useRef(null);

  useEffect(() => () => clearTimeout(gameOverTimer.current), []);

  // Runs one API call with shared loading + error handling.
  // Returns the response, or null if it failed (the error is then in context).
  async function run(action) {
    setApiError(null);
    setIsBusy(true);
    try {
      return await action();
    } catch (err) {
      setApiError(
        err instanceof ApiError
          ? err
          : new ApiError({ code: "UNKNOWN", message: "Something went wrong. Please try again." })
      );
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  function requireGame() {
    if (gameId) return true;
    setApiError(
      new ApiError({
        code: "NO_GAME",
        message: "No game in progress. Start a new game from the setup page.",
      })
    );
    return false;
  }

  // Copy the server's numbers onto the existing player objects.
  // The server only knows id, name, pig_index and points; avatar and tag stay
  // as they are locally. New objects are created, nothing is mutated.
  function syncGame(game) {
    setPlayerData((prev) =>
      game.players.map((serverPlayer, i) => ({
        ...prev[i],
        id: serverPlayer.id,
        running_points: serverPlayer.running_points,
        total_points: serverPlayer.total_points,
      }))
    );
    setCurrentPlayer(game.current_player_index);
  }

  // Setup screen: create the game on the server. Returns true on success.
  async function startGame() {
    const result = await run(() =>
      gameApi.createGame({
        players: playerData.map((p) => ({ name: p.name, pig_index: p.pig_index })),
        targetScore: Number(maxPoints),
      })
    );
    if (!result) return false;

    clearTimeout(gameOverTimer.current);
    setGameId(result.game.id);
    setWinnerId(null);
    setDiceValue(0);
    setIsGameOver(false);
    syncGame(result.game);
    return true;
  }

  // Ask the server to roll. Returns { roll, game } or null on failure.
  // It does NOT update the screen: the dice animation finishes first and then
  // calls showRollResult(), so the score does not spoil the roll.
  async function roll() {
    if (!requireGame()) return null;
    return run(() => gameApi.rollDice(gameId));
  }

  // Reveal the outcome of a roll once the animation has ended.
  function showRollResult({ roll: rolled, game }) {
    syncGame(game);
    setDiceValue(rolled.value);
    if (rolled.outcome === "bust") loseAudio?.play();
    if (rolled.outcome === "win") {
      setWinnerId(game.winner_id);
      gameOverTimer.current = setTimeout(() => {
        celebrationAudio?.play();
        setIsGameOver(true);
      }, GAME_OVER_DELAY_MS);
    }
  }

  // PASS button: bank the running points and hand over the turn.
  async function bank() {
    if (!requireGame()) return;
    const result = await run(() => gameApi.bankPoints(gameId));
    if (!result) return;
    addPlayerAudio?.play();
    syncGame(result.game);
  }

  return { startGame, roll, showRollResult, bank, isBusy };
}
