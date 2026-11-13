# Greedy Pig API Contract (DRAFT v0.4: Hot Streak)

Maintained by Member 2 (frontend) for Member 1 (backend) to review and correct. The frontend is already coded
against this through `src/api/mockServer.js`, so any change should be made in both places.
**Hot Streak replaces Double Down** (change of plans). `applyRoll()` in `mockServer.js` is the reference
implementation of the rule.

**Principle:** the server owns all game rules. The client never sends a dice value, a score or a bonus.
It only asks for actions ("roll", "bank") and renders the game object it gets back.

Base path: `/api/v1`. All bodies are JSON. Field names are `snake_case` to match the base game's existing
player fields (`running_points`, `total_points`, `pig_index`).

---

## The Hot Streak rule

- Roll **3 non-1 numbers in a row** in one turn and you are **ON FIRE**.
- **Every roll after that gets +2 bonus**, up to **+10 bonus per turn** (so rolls 4 to 8 of a turn).
- A **1 still wipes the whole turn**: turn points, streak and bonus. The turn passes.
- It is **automatic**. There is no button and no extra endpoint.
- The roll that sets you on fire gets no bonus itself. The bonus starts with the next roll.
- The bonus is part of the turn points, so it is banked with them and it counts towards the winning score.
- A 1 ends the turn, so the **streak is simply the number of rolls made so far this turn**.

Example turn: rolls 4, 3, 5, 6, 2, then a 1.

| Roll | Value | Bonus | Turn points | Streak | Note |
|---|---|---|---|---|---|
| 1 | 4 | 0 | 4 | 1 | |
| 2 | 3 | 0 | 7 | 2 | |
| 3 | 5 | 0 | 12 | 3 | ON FIRE (`caught_fire`), no bonus yet |
| 4 | 6 | +2 | 20 | 4 | |
| 5 | 2 | +2 | 24 | 5 | banking now adds 24 to the total |
| 6 | 1 | 0 | 0 | 0 | bust: all 24 turn points lost, turn passes |

---

## Game object

```json
{
  "id": "b1c7...-uuid",
  "status": "in_progress",
  "target_score": 100,
  "current_player_index": 0,
  "turn_number": 3,
  "last_roll": { "value": 4, "player_id": "p-uuid" },
  "winner_id": null,
  "players": [
    { "id": "p-uuid", "name": "Ada", "pig_index": 0,
      "running_points": 24, "total_points": 12,
      "streak": 5, "on_fire": true, "bonus_this_turn": 4 },
    { "id": "q-uuid", "name": "", "pig_index": 1,
      "running_points": 0, "total_points": 30,
      "streak": 0, "on_fire": false, "bonus_this_turn": 0 }
  ],
  "created_at": "2026-11-13T10:00:00.000Z",
  "updated_at": "2026-11-13T10:00:05.000Z"
}
```

| Field | Notes |
|---|---|
| `status` | `"in_progress"` or `"finished"` |
| `current_player_index` | index into `players`; whose turn it is |
| `players[].streak` | non-1 rolls in a row this turn. **Always 0 for every player except the one whose turn it is.** |
| `players[].on_fire` | `streak >= 3` |
| `players[].bonus_this_turn` | bonus points earned so far this turn: `min(max(streak - 3, 0) * 2, 10)` |
| `players[].running_points` | turn points **including** any bonus |
| `winner_id` | `null` until `status` is `finished` |
| `name` | 0 to 20 characters. **Blank is allowed**: the screen then shows a pig nickname, and the leaderboard ignores unnamed players. |
| `pig_index` | which pig picture. The server stores only the number; the client maps it to an image. |

`on_fire` and `bonus_this_turn` are worked out from `streak`, so the server only needs to store `streak`
(its `game_players.rolls_this_turn` column does exactly that).

**Removed with Double Down** (the frontend no longer reads them, so the server may stop sending them):
`rolls_this_turn`, `double_down_active`, `turn_multiplier`, `bank_unlock_in`, `allowed`, `players[].double_down_used`.

---

## Endpoints

### 1. `POST /games`: create a game
Request:
```json
{ "players": [ { "name": "Ada", "pig_index": 0 }, { "name": "", "pig_index": 1 } ], "target_score": 100 }
```
Response `201`: `{ "game": <Game> }`

### 2. `GET /games/:id`: fetch a game
Response `200`: `{ "game": <Game> }`

### 3. `POST /games/:id/roll`: roll the die for the current player
No body. The **server** generates the value (CSPRNG, e.g. `crypto.randomInt(1, 7)`).
Response `200`:
```json
{
  "roll": { "value": 6, "bonus": 2, "outcome": "continue", "player_id": "p-uuid",
            "streak": 4, "on_fire": true, "caught_fire": false },
  "game": <Game after the roll>
}
```
| `roll` field | Meaning |
|---|---|
| `value` | the die, 1 to 6 |
| `bonus` | extra points added by this roll: `2` or `0`. The turn gained `value + bonus` points. Always `0` on a 1. |
| `outcome` | `"continue"`, `"bust"` or `"win"` |
| `streak` | the player's streak **after** this roll (`0` after a 1) |
| `on_fire` | `true` if the player is ON FIRE after this roll |
| `caught_fire` | `true` only on the roll that took the streak from 2 to 3 (the roll that sets the player on fire) |

### 4. `POST /games/:id/bank`: bank the turn points and pass the turn
No body. Response `200`:
```json
{
  "bank": { "player_id": "p-uuid", "points_banked": 24 },
  "game": <Game after the bank>
}
```
`points_banked` is what was added to `total_points` (the turn points, bonus included).

---

## Rules the server must enforce

| Action | Result |
|---|---|
| Roll a **1** | `running_points = 0`, streak and bonus gone, turn passes, `outcome: "bust"`, `bonus: 0` |
| Roll **2 to 6** | `bonus = 2` if the player was ON FIRE before this roll **and** `bonus_this_turn` is still below 10, otherwise `0`. Then `streak += 1` and `running_points += value + bonus`. |
| Win check | after a roll, if `total_points + running_points >= target_score`: add `running_points` to `total_points`, set `running_points = 0`, `status = finished`, set `winner_id`, `outcome: "win"`. The bonus counts. |
| **Bank** | `total_points += running_points`, `running_points = 0`, turn passes. Banking 0 is allowed (it just passes the turn). Never blocked. |
| Turn passes | `current_player_index = (current_player_index + 1) % players.length`, `turn_number += 1`, the player who just finished goes back to `streak = 0` |
| Finished game | `roll` and `bank` return `409 GAME_FINISHED` |

## Validation

| Field | Rule |
|---|---|
| `players` | array of 2 to 8 |
| `players[].name` | string, at most 20 characters after trim. Blank is allowed. |
| `players[].pig_index` | integer 0 to 28 |
| `target_score` | integer 25 to 1000 |

## Errors

Every error has the same shape:
```json
{ "error": { "code": "GAME_FINISHED", "message": "This game is already over" } }
```
`VALIDATION_ERROR` also carries `"fields": { "target_score": "..." }`. The `message` is shown to the player as it is, so keep it short and clear.

| HTTP | `code` | `message` (suggested) | When |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Please fix the highlighted fields | bad input |
| 404 | `GAME_NOT_FOUND` | Game not found | unknown game id |
| 409 | `GAME_FINISHED` | This game is already over | roll or bank on a finished game |
| 500 | `INTERNAL_ERROR` | Something went wrong | anything unexpected |

The client adds one more code itself, `NETWORK_ERROR` (status 0), when the server cannot be reached or times out.

## Mapping to the database schema

The JSON above is the contract, so the API serializes database rows into it.

| Contract field | Database |
|---|---|
| `game.current_player_index` | `games.current_seat` |
| `game.winner_id` | `games.winner_player_id` |
| `game.players[]` | `game_players` **ordered by `seat`** (the screen matches players by position) |
| `players[].name` | `game_players.display_name` |
| `players[].total_points` | `game_players.total_score` |
| `players[].running_points` | `game_players.turn_score` (bonus included) |
| `players[].streak` | `game_players.rolls_this_turn` for the **current seat**, `0` for every other seat |
| `players[].on_fire`, `players[].bonus_this_turn` | computed from `streak` (not stored) |

Notes for the server:
- **`rolls_this_turn` must go up on every non-1 roll and go back to 0 on a bust and on a bank.** That is the streak.
- **Add the bonus to `turn_score`** (`turn_score += value + bonus`). `turns.points` then holds the bonus too, both for a bank and for the points lost on a bust.
- **Delete Double Down:** the `double_down_used` and `double_down_active` columns, `turns.double_down`, `POST /games/:id/double-down`, the Double Down code in `gameService.js`, `statsService.js`, `scripts/test-everything.js` and `scripts/seed-sample.js`.
- **Lock the game row** inside each action (`SELECT ... FOR UPDATE` in a transaction) so a double click cannot roll or bank twice.
- **The winning roll saves the results** in the same transaction (already implemented, keep it).

## CORS and config
- Backend must allow the deployed frontend origin (and `http://localhost:5173` for dev). In `FRONTEND_URL`, separate origins with a comma and **no spaces**.
- Frontend reads `VITE_API_URL` (backend origin, no trailing slash) and `VITE_USE_MOCK=false` in production.

## For other members
- **Member 3 (sounds and screen reader):** the frontend puts every roll in `lastEvent` in the live game context:
  `{ id, type: "roll", player_id, value, outcome, bonus, streak, on_fire, caught_fire, bonus_maxed, was_on_fire, lost_points, turn_total }`.
  Use `caught_fire` for the ON FIRE sound, `bonus > 0` for the bonus tick, and `bonus_maxed` for the "bonus capped" moment.
  `bank` events carry `points_banked`. The message box on screen is already a live region, so reuse it for screen reader text.
- **Member 4 (stats):** Double Down stats no longer exist. Remove "Double Downs won and busted" from the stats page.

## Open questions for Member 1
1. **Streak = `rolls_this_turn`** and everything else computed from it: OK?
2. **The bonus counts towards the win check**, as in the example above. Confirm.
3. **Who may act on a game?** Right now anyone with the game id can roll or bank. Fine for pass-and-play on one device.

---

## Competition: leaderboard, stats, history (Member 4)

Added by Member 4. All three endpoints are **read-only**. The client never sends a score. The server records
results itself when a game becomes `finished` (the roll that returns `outcome: "win"`), so no separate
`/finish` endpoint is needed. Rules for who is counted:

- Only players with a non-empty name (after trim) are counted. Unnamed pigs only get a nickname on the client.
- Names match ignoring case and surrounding spaces (`" ada "` and `"Ada"` are the same player). The response
  uses the most recent spelling.
- Only `finished` games count. A game still `in_progress` never appears.

Frontend: `gameApi.getLeaderboard`, `gameApi.getPlayerStats`, `gameApi.getPlayerHistory` (already in
`mockServer.js` and `httpClient.js`).

### 5. `GET /leaderboard?limit=10`
`limit` is a whole number from 1 to 50 (default 10; anything invalid falls back to 10).
Response `200`:
```json
{
  "leaderboard": [
    { "rank": 1, "name": "Zainab", "games_played": 5, "wins": 3, "win_rate": 60 }
  ]
}
```
`win_rate` is a whole-number percentage (`round(wins / games_played * 100)`). Order: most `wins`, then higher
`win_rate`, then fewer `games_played`, then `name` A to Z. `rank` is 1, 2, 3... in that order (no shared ranks).
An empty list is a normal `200`, not an error.

### 6. `GET /players/:name/stats`
Response `200`:
```json
{
  "player": {
    "name": "Ada", "games_played": 5, "wins": 2, "win_rate": 40,
    "best_score": 104, "last_played_at": "2026-11-06T21:45:00.339Z"
  }
}
```
`best_score` is the highest final total in any finished game. Unknown player: `404 PLAYER_NOT_FOUND`.

### 7. `GET /players/:name/history?limit=10`
Newest game first. Same `limit` rule as the leaderboard. Response `200`:
```json
{
  "history": [
    {
      "game_id": "uuid", "played_at": "2026-11-06T21:45:00.339Z", "target_score": 100,
      "won": false, "final_score": 50,
      "opponents": [ { "name": "Zainab", "final_score": 105 } ]
    }
  ]
}
```
`opponents` lists every other player in that game. Their `name` can be an empty string (the UI shows
"Unnamed pig"). Unknown player: `404 PLAYER_NOT_FOUND`.

### New error code
| HTTP | `code` | When |
|---|---|---|
| 404 | `PLAYER_NOT_FOUND` | `stats` or `history` for a name with no finished games |

### Open points for Member 1
1. `server/schema.sql` has `CHECK (length(trim(display_name)) > 0)` on `game_players`, but this contract allows
   empty player names. One of them has to change.
2. `results` needs one row per player per finished game, written in the same transaction as the winning roll.
   Its `UNIQUE (game_id, game_player_id)` already stops duplicates.
