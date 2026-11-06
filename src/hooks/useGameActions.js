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
    setGameMeta,
    setFeedback,
    setLastEvent,
  } = useLiveGameContext();

  const addPlayerAudio = useAudio(addPlayerSound);
  const loseAudio = useAudio(loseSound);
  const celebrationAudio = useAudio(celebrationSound);
  const gameOverTimer = useRef(null);

  useEffect(() => () => clearTimeout(gameOverTimer.current), []);

  // What other parts of the UI listen to (Member 3: sounds and screen reader text).
  // Every event gets a new id so the same kind of event twice in a row is still noticed.
  function emit(event) {
    setLastEvent({ id: `${Date.now()}-${Math.random()}`, ...event });
  }

  // A short message on screen. type is "info" | "good" | "bad".
  function say(type, text) {
    setFeedback({ id: `${Date.now()}-${Math.random()}`, type, text });
  }

  function nameOf(playerId) {
    const p = playerData.find((player) => player.id === playerId);
    return p ? p.name || p.tag : "Player";
  }

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
        double_down_used: serverPlayer.double_down_used,
      }))
    );
    setCurrentPlayer(game.current_player_index);
    // The server decides what is allowed. The screen only shows it.
    setGameMeta({
      doubleDownActive: game.double_down_active,
      turnMultiplier: game.turn_multiplier,
      bankUnlockIn: game.bank_unlock_in,
      rollsThisTurn: game.rolls_this_turn,
      allowed: {
        roll: game.allowed.roll,
        bank: game.allowed.bank,
        doubleDown: game.allowed.double_down,
      },
    });
  }

  // Setup screen: create the game on the server. Returns true on success.
  async function startGame() {
    const result = await run(() =>
      gameApi.createGame({
        // The server does not accept blank names, so a player who left the name empty is sent under their pig nickname.
        players: playerData.map((p) => ({ name: p.name.trim() || p.tag, pig_index: p.pig_index })),
        targetScore: Number(maxPoints),
      })
    );
    if (!result) return false;

    clearTimeout(gameOverTimer.current);
    setGameId(result.game.id);
    setWinnerId(null);
    setFeedback(null);
    setLastEvent(null);
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
    const name = nameOf(rolled.player_id);
    syncGame(game);
    setDiceValue(rolled.value);
    const roller = game.players.find((p) => p.id === rolled.player_id);
    emit({
      type: "roll",
      player_id: rolled.player_id,
      value: rolled.value,
      outcome: rolled.outcome,
      turn_total: roller ? roller.running_points : 0,
      multiplier: rolled.multiplier,
      penalty_applied: rolled.penalty_applied,
    });
    if (rolled.outcome === "bust") {
      loseAudio?.play();
      if (rolled.multiplier > 1) {
        say(
          "bad",
          rolled.penalty_applied > 0
            ? `${name} rolled a 1 under Double Down: turn points lost and ${rolled.penalty_applied} taken from their total.`
            : `${name} rolled a 1 under Double Down: turn points lost. Nothing to take from their total.`
        );
      } else {
        say("bad", `${name} rolled a 1 and lost their turn points.`);
      }
    }
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
    const { bank: banked, game } = result;
    const name = nameOf(banked.player_id);
    addPlayerAudio?.play();
    syncGame(game);
    emit({ type: "bank", player_id: banked.player_id, points_banked: banked.points_banked, multiplier: banked.multiplier });
    if (banked.points_banked === 0) say("info", `${name} passed the turn.`);
    else if (banked.multiplier > 1) say("good", `${name} banked ${banked.points_banked} (Double Down x${banked.multiplier}).`);
    else say("good", `${name} banked ${banked.points_banked}.`);
  }

  // Double Down button: declare before the first roll of a turn.
  // The server checks the rules; if it says no, the error banner shows its message.
  async function declareDoubleDown() {
    if (!requireGame()) return;
    const result = await run(() => gameApi.doubleDown(gameId));
    if (!result) return;
    const { double_down: dd, game } = result;
    syncGame(game);
    emit({ type: "double_down_declared", player_id: dd.player_id, multiplier: dd.multiplier, min_rolls: dd.min_rolls, penalty: dd.penalty });
    say(
      "info",
      `${nameOf(dd.player_id)} declared Double Down: roll at least ${dd.min_rolls} times before banking. Banked points count x${dd.multiplier}, but a 1 also costs ${dd.penalty} points.`
    );
  }

  return { startGame, roll, showRollResult, bank, declareDoubleDown, isBusy };
}
