# Base repo map: what Member 2 has to replace

Repo: https://github.com/Hemephelus/greed_pig (React 18 + Vite + Tailwind + react-router). Everything lives on the
client. There is **no backend and no database**. `@supabase/supabase-js` is a dependency but is only used in an
unused sample file (`routes/play_friend_remote/text.js`).

## Where state lives
`src/routes/play_friends_live/LivePage.jsx` holds all game state in `useState` and shares it through
`LiveGameContext` (`src/context/useLiveGameContext.jsx`):

| State | Meaning | Becomes |
|---|---|---|
| `playerData` | array of `{id, avatar, tag, name, pig_index, running_points, total_points}` | `game.players` from the server (`avatar` and `tag` are derived on the client from `pig_index`) |
| `currentPlayer` | index of whose turn | `game.current_player_index` |
| `maxPoints` | target score (setup screen, default 100, min 25) | `game.target_score` |
| `isGameOver` | show GameOver overlay | `game.status === "finished"` |
| `diceValue` | last roll (also drives background colour: red on 1) | `game.last_roll?.value` |
| `numberRolled`, `gameHistory`, `isRunning` | declared but **never used** | delete |
| `changeBackground` | purely visual, true while the dice animates | keep (UI only) |
| `isContinue` | lets Setup offer "Resume Game" | keep, plus remember `game.id` |

## Where the rules live (all of this moves to the server)

| Rule | Current location | Problem |
|---|---|---|
| Dice value | `components/Dice.jsx`: `Math.floor(Math.random() * 6)` inside a 30-tick, 100 ms animation. The value shown on the last tick is the roll. | Client-side and trivially cheatable |
| Roll outcome (1 = bust, else add) | `DiceSection.jsx` and `DiceSectionMobile.jsx`: `handleFinalDiceValue` | **Duplicated** in two files |
| Pass / bank | same two files: `handlePassClick` | Duplicated |
| Win check | same two files: `setGameOverPage` (running + total + dice >= maxPoints, then a 1 s delay before the overlay) | Duplicated |
| Winner | `GameOver.jsx`: sorts players by total + running and takes first | Should be `game.winner_id` |
| Player/game reset | `setup/Setup.jsx`: `setupPlayers()` zeroes points | Becomes `createGame()` |

## Bugs noticed in the base (worth fixing while rewriting)
1. `handleFinalDiceValue` mutates `playerData` objects in place on a bust and never calls `setPlayerData`. It only appears to work because the same array is re-rendered later. Moving to server state removes it.
2. The two dice sections are copy-pasted, so any fix has to be made twice. Replace both with one hook.
3. `maxPoints` comes from `e.target.value` as a **string**, and `min={25}` is only an HTML hint. The server validates it as an integer 25 to 1000.
4. Winner is computed from the sorted leaderboard, not recorded. Ties and bank timing are ambiguous. The server sets `winner_id`.
5. A dead Supabase sample file with a hard-coded project URL (`routes/play_friend_remote/text.js`). Delete it before submission.

## Suggested replacement plan

1. **Add `src/api/`** (done in this bundle).
2. **One hook, `useGameActions()`**, wrapping `gameApi` and the context: `start(players, target)`, `roll()`, `bank()`, plus `isLoading` and `error`. Both `DiceSection` and `DiceSectionMobile` call it, and their duplicated logic is deleted.
3. **Dice animation:** keep the spinning faces, but start the `rollDice()` request at the same moment. When the response arrives, end the animation on `roll.value` (and keep a minimum spin time so it still feels like a roll). On `NETWORK_ERROR`, stop the animation and show a retry (coordinate with Member 3 on the error UI).
4. **Setup.jsx:** "Start Game" calls `createGame`, stores `game.id`, then navigates. Show server `fields` errors next to the inputs. "Resume" calls `getGame(id)`.
5. **Replace `playerData`** in the context with `game` from the server. Derive `avatar` and `tag` from `pig_index` at render time (helper in `utils/`).
6. **GameOver:** read `game.winner_id` instead of re-sorting.
7. **Then** build Improvement 1 on top, adding its endpoints to the contract first.

## Merge-conflict warning
Members 3 and 4 will edit the same components (`DiceSection*`, `Setup`). Do step 2 to 6 early and merge it fast, in small PRs, so they build on the new structure.
