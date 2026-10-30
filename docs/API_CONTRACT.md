# Greedy Pig API Contract (DRAFT v0.1)

Proposed by Member 2 for Member 1 to review and correct. The frontend is already coded against this
through `src/api/mockServer.js`, so any change should be made in both places.

**Principle:** the server owns all game rules. The client never sends a dice value or a score. It only
asks for actions ("roll", "bank") and renders the game object it gets back.

Base path: `/api/v1`. All bodies are JSON. Field names are `snake_case` to match the base game's existing
player fields (`running_points`, `total_points`, `pig_index`), which keeps frontend changes small.

---

## Game object

```json
{
  "id": "b1c7...-uuid",
  "status": "in_progress",
  "target_score": 100,
  "current_player_index": 0,
  "turn_number": 1,
  "last_roll": { "value": 4, "player_id": "p-uuid" },
  "winner_id": null,
  "players": [
    { "id": "p-uuid", "name": "Ada", "pig_index": 0, "running_points": 4, "total_points": 12 }
  ],
  "created_at": "2026-11-02T10:00:00.000Z",
  "updated_at": "2026-11-02T10:00:05.000Z"
}
```

| Field | Notes |
|---|---|
| `status` | `"in_progress"` or `"finished"` |
| `current_player_index` | index into `players`; whose turn it is |
| `last_roll` | `null` until the first roll |
| `winner_id` | `null` until `status` is `finished` |
| `name` | may be an empty string. The UI then shows a pig nickname. Server stores what it is given (trimmed). |
| `pig_index` | which pig picture. The server stores only the number; the client maps it to an image. |

---

## Endpoints

### 1. `POST /games`: create a game
Request:
```json
{ "players": [ { "name": "Ada", "pig_index": 0 }, { "name": "", "pig_index": 1 } ], "target_score": 100 }
```
Response `201`: `{ "game": <Game> }`

### 2. `GET /games/:id`: fetch a game (used on page refresh / resume)
Response `200`: `{ "game": <Game> }`

### 3. `POST /games/:id/roll`: roll the die for the current player
No body. The **server** generates the value (use a CSPRNG, e.g. `crypto.randomInt(1, 7)`).
Response `200`:
```json
{
  "roll": { "value": 1, "outcome": "bust", "player_id": "p-uuid" },
  "game": <Game after the roll>
}
```
`outcome` is `"continue"`, `"bust"` or `"win"`.

### 4. `POST /games/:id/bank`: bank running points and pass the turn
No body. Response `200`: `{ "game": <Game> }`

---

## Rules the server must enforce (same as the base game)

| Action | Result |
|---|---|
| Roll a **1** | `running_points` set to 0, turn passes, `outcome: "bust"` |
| Roll **2 to 6** | added to `running_points`. If `total_points + running_points >= target_score`, running points are added to `total_points`, `running_points` becomes 0, `status` becomes `finished`, `winner_id` is set, `outcome: "win"`. Otherwise `outcome: "continue"` and the turn stays. |
| **Bank** | `total_points += running_points`, `running_points = 0`, turn passes. Banking 0 is allowed (it simply passes the turn). |
| Turn order | `current_player_index = (current_player_index + 1) % players.length`; `turn_number` increases by 1 on every pass |
| Finished game | `roll` and `bank` return `409 GAME_FINISHED` |

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
{ "error": { "code": "VALIDATION_ERROR", "message": "Please fix the highlighted fields",
             "fields": { "target_score": "Target score must be a whole number from 25 to 1000" } } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad input (`fields` lists each problem) |
| 404 | `GAME_NOT_FOUND` | unknown game id |
| 409 | `GAME_FINISHED` | roll/bank on a finished game |
| 500 | `INTERNAL_ERROR` | anything unexpected |

The client adds one more code itself, `NETWORK_ERROR` (status 0), when the server cannot be reached or times out.

## CORS and config
- Backend must allow the deployed frontend origin (and `http://localhost:5173` for dev).
- Frontend reads `VITE_API_URL` (backend origin, no trailing slash) and `VITE_USE_MOCK=false` in production.

## Questions for Member 1
1. **Who is allowed to act on a game?** Right now anyone with the game id can roll/bank. Fine for pass-and-play on one device; if Improvement 2/3 adds online play we need a per-player token.
2. **Do the improvements need extra fields or endpoints?** (bots, power-ups, accounts, leaderboard, etc.) Each improvement owner should add theirs here under a new heading before building.
3. **Slow requests:** should `roll` be idempotent against double-clicks (e.g. reject a second roll sent within a few ms)? The UI will disable the button while a request is in flight regardless.
4. **Database choice** affects ids. The draft assumes UUID strings.
