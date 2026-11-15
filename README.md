# Greedy Pig Reimagined

CSC 419, Assignment 2

**Live site:** https://greedy-pig-reimagined-three.vercel.app

## Team

| Name | Matric no. |
|---|---|
| Ogbonnaya Excel | 23120111036 |
| John Esonu | 23120111019 |
| Oluwatosin Dupe Olayebi | 24120111115 |
| Ejola Osahontue Osadebamhen | 23120111017 |

## About

Greedy Pig is a push-your-luck dice game. Roll to build up points, but roll a 1
and you lose them. Bank before that happens to keep them. The first player to
reach the target score wins.

This version is based on the original Greedy Pig project by
[Hemephelus](https://github.com/Hemephelus). We rebuilt it around an API layer
(a mock server for development and a real Express and Postgres backend) and
added three improvements.

## Improvements

1. **Hot Streak:** rolls 3 to 7 in a single turn earn a +2 bonus (capped at +10).
2. **Sound effects and accessibility.**
3. **Leaderboard, player stats and match history:** the server records results
   when a game finishes. The leaderboard ranks the top 10 players by wins, and
   each player has a stats page with their win rate, best score and recent matches.

## Run it locally

1. `git clone https://github.com/EjolaOsahontue/GreedyPigReimagined.git`
2. `cd GreedyPigReimagined`
3. `npm install`
4. `cp .env.example .env` (keep `VITE_USE_MOCK=true` to run without a backend)
5. `npm run dev`

To use the real backend, set `VITE_USE_MOCK=false` and
`VITE_API_URL=http://localhost:3000` in `.env`, then in a second terminal:
`cd server`, `npm install`, add a `.env` with your `DATABASE_URL`, run
`server/schema.sql` on your database, and start it with `npm start`.

API details are in `docs/API_CONTRACT.md`.

## Tech

Vite, React 18, Tailwind CSS, React Router, Express, PostgreSQL (Neon). Frontend deployed on Vercel.
