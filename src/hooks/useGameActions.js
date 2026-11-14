import { useEffect, useRef } from "react";
import { useLiveGameContext } from "src/context/useLiveGameContext";
import { gameApi, ApiError } from "src/api/gameApi";
import useAudio from "src/hooks/useAudio";
import bankSound from "src/sound_effect/bank.mp3";
import loseSound from "src/sound_effect/lose_sound.mp3";
import celebrationSound from "src/sound_effect/celebration.mp3";
import fireSound from "src/sound_effect/on_fire.mp3";
import bonusSound from "src/sound_effect/bonus_tick.mp3";
import { HOT_STREAK } from "src/utils/hotStreak";


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
    setFeedback,
    setLastEvent,
  } = useLiveGameContext();

  const bankAudio = useAudio(bankSound);
  const loseAudio = useAudio(loseSound);
  const celebrationAudio = useAudio(celebrationSound);
  const fireAudio = useAudio(fireSound);
  const bonusAudio = useAudio(bonusSound);
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
        // Hot Streak. An older server does not send these yet, so they fall back to "no streak".
        streak: serverPlayer.streak ?? 0,
        on_fire: Boolean(serverPlayer.on_fire),
        bonus_this_turn: serverPlayer.bonus_this_turn ?? 0,
      }))
    );
    setCurrentPlayer(game.current_player_index);
  }

  // Setup screen: create the game on the server. Returns true on success.
  async function startGame() {
    const result = await run(() =>
      gameApi.createGame({
        // A blank name stays blank. The server accepts it, and the leaderboard only counts players who typed a name
        // (the pig nickname is only shown on this screen).
        players: playerData.map((p) => ({ name: p.name.trim(), pig_index: p.pig_index })),
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
    // How the player stood BEFORE this roll (this function runs with the screen as it was at the click).
    const before = playerData.find((p) => p.id === rolled.player_id);
    const lostPoints = before ? before.running_points : 0;
    const wasOnFire = Boolean(before?.on_fire);

    syncGame(game);
    setDiceValue(rolled.value);

    const roller = game.players.find((p) => p.id === rolled.player_id);
    const bonus = rolled.bonus ?? 0; // an older server does not send the Hot Streak fields
    const caughtFire = Boolean(rolled.caught_fire);
    const bonusMaxed = bonus > 0 && (roller?.bonus_this_turn ?? 0) >= HOT_STREAK.bonusCap;

    // Everything Hot Streak related that sounds and screen reader text can hook into.
    emit({
      type: "roll",
      player_id: rolled.player_id,
      value: rolled.value,
      outcome: rolled.outcome,
      bonus,
      streak: rolled.streak ?? 0,
      on_fire: Boolean(rolled.on_fire),
      caught_fire: caughtFire,
      bonus_maxed: bonusMaxed,
      was_on_fire: wasOnFire,
      lost_points: lostPoints,
      turn_total: roller ? roller.running_points : 0,
    });

    // Sounds: ON FIRE on the roll that sets the player alight, a small tick on every bonus roll.
    if (caughtFire) fireAudio?.play();
    else if (bonus > 0) bonusAudio?.play();
    
    if (rolled.outcome === "bust") {
      loseAudio?.play();
      if (wasOnFire) {
        say("bad", `${name} rolled a 1: ${lostPoints} turn points lost and the ON FIRE streak is over.`);
      } else if (lostPoints > 0) {
        say("bad", `${name} rolled a 1 and lost ${lostPoints} turn points.`);
      } else {
        say("bad", `${name} rolled a 1.`);
      }
    } else if (caughtFire) {
      say("good", `${name} is ON FIRE! Every roll now gets +${HOT_STREAK.bonusPerRoll} bonus, up to +${HOT_STREAK.bonusCap} per turn.`);
    } else if (bonusMaxed) {
      say("info", `${name} has earned the full +${HOT_STREAK.bonusCap} bonus this turn.`);
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
    if (banked.points_banked > 0) bankAudio?.play();
    syncGame(game);
    emit({ type: "bank", player_id: banked.player_id, points_banked: banked.points_banked });
    if (banked.points_banked === 0) say("info", `${name} passed the turn.`);
    else say("good", `${name} banked ${banked.points_banked}.`);
  }

  return { startGame, roll, showRollResult, bank, isBusy };
}
