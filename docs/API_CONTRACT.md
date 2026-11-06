# Greedy Pig API Contract (DRAFT v0.2: adds Double Down)

Maintained by Member 2 (frontend) for Member 1 (backend) to review and correct. The frontend is already coded
against this through `src/api/mockServer.js`, so any change should be made in both places.
Rules for Double Down come from the group plan ("Improvement 1: Double Down").

**Principle:** the server owns all game rules. The client never sends a dice value, a score or a multiplier.
It only asks for actions ("roll", "bank", "double down") and renders the game object it gets back. It also does
not work out what is allowed: the server says so in `game.allowed`.

Base path: `/api/v1`. All bodies are JSON. Field names are `snake_case` to match the base game's existing
player fields (`running_points`, `total_points`, `pig_index`).

---

## Game object

```json
{
  "id": "b1c7...-uuid",
  "status": "in_progress",
  "target_score": 100,
  "current_player_index": 0,
  "turn_number": 1,
  "rolls_this_turn": 2,
  "double_down_active": true,
  "turn_multiplier": 2,
  "bank_unlock_in": 1,
  "allowed": { "roll": true, "bank": false, "double_down": false },
  "last_roll": { "value": 4, "player_id": "p-uuid" },
  "winner_id": null,
  "players": [
    { "id": "p-uuid", "name": "Ada", "pig_index": 0,
      "running_points": 9, "total_points": 20, "double_down_used": true }
  ],
  "created_at": "2026-11-05T10:00:00.000Z",
  "updated_at": "2026-11-05T10:00:05.000Z"
}
```

| Field | Notes |
|---|---|
| `status` | `"in_progress"` or `"finished"` |
| `current_player_index` | index into `players`; whose turn it is |
| `rolls_this_turn` | rolls made by the current player this turn. Resets to 0 when the turn passes. |
| `double_down_active` | true while the **current** player's turn is under Double Down. Resets to false when the turn passes. |
| `turn_multiplier` | `2` while `double_down_active`, otherwise `1`. What the current turn's points are worth when banked. The client multiplies nothing itself except to preview "turn points x multiplier". |
| `bank_unlock_in` | rolls still needed before banking is allowed. `0` when Double Down is not active or the lock is over. Server computes it, the client only shows it. |
| `allowed` | what the current player may do right now (see below). The client uses it to enable or grey out buttons. |
| `players[].double_down_used` | true once that player has declared Double Down in this game (one use per game) |
| `last_roll` | `null` until the first roll |
| `winner_id` | `null` until `status` is `finished` |
| `name` | may be an empty string. The UI then shows a pig nickname. Server stores what it is given (trimmed). |
| `pig_index` | which pig picture. The server stores only the number; the client maps it to an image. |

`allowed` is computed by the server after every action:
- `roll`: game is `in_progress`
- `bank`: game is `in_progress` and `bank_unlock_in === 0`
- `double_down`: game is `in_progress`, current player has `double_down_used === false`, `double_down_active` is false and `rolls_this_turn === 0`

The endpoints still **enforce** these rules and return errors. `allowed` only saves the UI from guessing.

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
  "roll": { "value": 1, "outcome": "bust", "player_id": "p-uuid",
            "multiplier": 2, "penalty_applied": 5 },
  "game": <Game after the roll>
}
```
| `roll` field | Meaning |
|---|---|
| `outcome` | `"continue"`, `"bust"` or `"win"` |
| `multiplier` | `2` if Double Down was active when this roll happened, otherwise `1`. (Needed because a bust ends the turn and clears the flag in `game`.) |
| `penalty_applied` | points actually taken from `total_points` by the Double Down penalty. `0` unless the roll was a 1 under Double Down. Never more than the player had. |

### 4. `POST /games/:id/bank`: bank running points and pass the turn
No body. Response `200`:
```json
{
  "bank": { "player_id": "p-uuid", "points_banked": 24, "multiplier": 2 },
  "game": <Game after the bank>
}
```
`points_banked` is what was added to `total_points` (already multiplied). Rejected with `409 BANK_LOCKED` while `bank_unlock_in > 0`.

### 5. `POST /games/:id/double-down`: declare Double Down (NEW)
No body. The server checks, in this order: game is in progress, player has not used it, it is not already active and no roll has been made this turn.
On success it sets `double_down_active = true` and the player's `double_down_used = true`.
Response `200`:
```json
{
  "double_down": { "player_id": "p-uuid", "multiplier": 2, "min_rolls": 3, "penalty": 5 },
  "game": <Game after declaring>
}
```
`min_rolls` and `penalty` are sent so the UI text always matches the server's current rule values (the group may tune the penalty from 5 to 3 after playtesting).

---

## Rules the server must enforce

| Action | Result |
|---|---|
| Roll a **1** (normal) | `running_points` set to 0, turn passes, `outcome: "bust"` |
| Roll a **1** under Double Down | Same as above **and** `penalty_applied = min(5, total_points)` is taken from `total_points` (never below 0). Flag clears with the turn. |
| Roll **2 to 6** | added to `running_points`. Win check uses the multiplier: if `total_points + running_points * multiplier >= target_score`, add `running_points * multiplier` to `total_points`, set `running_points` to 0, `status` to `finished`, set `winner_id`, `outcome: "win"`. Otherwise `outcome: "continue"`. |
| **Bank** | `points_banked = running_points * multiplier`; `total_points += points_banked`; `running_points = 0`; turn passes. Banking 0 is allowed (it just passes the turn). Blocked while the Double Down lock is on. |
| **Double Down lock** | Once declared, the player must roll **3** times before they can bank (`bank_unlock_in = max(0, 3 - rolls_this_turn)`). |
| Turn passes | `current_player_index = (current_player_index + 1) % players.length`; `turn_number += 1`; `rolls_this_turn = 0`; `double_down_active = false` |
| Finished game | `roll`, `bank` and `double-down` return `409 GAME_FINISHED` |

**Worked example (from the group plan):** player has 20 banked, declares Double Down, rolls 4, 5, 3 (turn total 12) and banks:
`points_banked = 24`, `total_points = 44`. If the third roll had been a 1 instead: the 9 turn points are lost,
`penalty_applied = 5`, and `total_points` goes from 20 to 15.

## Validation

| Field | Rule |
|---|---|
| `players` | array of 2 to 8 |
| `players[].name` | string, at most 20 characters after trim (empty allowed) |
| `players[].pig_index` | integer 0 to 28 |
| `target_score` | integer 25 to 1000 |

## Errors

Every error has the same shape:
```json
{ "error": { "code": "DOUBLE_DOWN_USED", "message": "Double Down already used" } }
```
`VALIDATION_ERROR` also carries `"fields": { "target_score": "..." }`. The `message` is shown to the player as it is, so keep it short and clear.

| HTTP | `code` | `message` (suggested) | When |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Please fix the highlighted fields | bad input |
| 404 | `GAME_NOT_FOUND` | Game not found | unknown game id |
| 409 | `GAME_FINISHED` | This game is already over | any action on a finished game |
| 409 | `DOUBLE_DOWN_USED` | Double Down already used | player declared it earlier in this game |
| 409 | `DOUBLE_DOWN_TOO_LATE` | Declare Double Down before your first roll of the turn | already rolled this turn, or already active |
| 409 | `BANK_LOCKED` | Double Down is active: roll N more time(s) before banking | bank while `bank_unlock_in > 0` |
| 500 | `INTERNAL_ERROR` | Something went wrong | anything unexpected |

The client adds one more code itself, `NETWORK_ERROR` (status 0), when the server cannot be reached or times out.

## CORS and config
- Backend must allow the deployed frontend origin (and `http://localhost:5173` for dev).
- Frontend reads `VITE_API_URL` (backend origin, no trailing slash) and `VITE_USE_MOCK=false` in production.

## For other members
- **Member 3 (sounds):** the frontend exposes a `lastEvent` in the live game context: `{ id, type, ... }` with types `roll`, `bust`, `bank`, `win`, `double_down_declared`. Play sounds off that.
- **Member 4 (stats):** "Double Downs won and busted" needs the server to count them. Suggested: a bank under Double Down = "won", a bust under Double Down = "busted", stored per player per game in `results`.

## Open questions for Member 1
1. **Win check under Double Down.** This draft counts `running_points * 2` toward the target (so the reward is consistent). Confirm, or tell us if the win check should use the raw turn points.
2. **Penalty value.** 5 for now, kept in one constant so it can drop to 3 after playtesting.
3. **Who may act on a game?** Right now anyone with the game id can roll or bank. Fine for pass-and-play on one device.
4. **Database ids.** The draft assumes UUID strings.
