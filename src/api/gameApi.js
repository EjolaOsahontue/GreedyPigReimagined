// The ONLY file components import from:
//   import { gameApi } from "src/api/gameApi";
//   const { game } = await gameApi.createGame({ players, targetScore });
//
// Switch implementations with an env var (no code changes):
//   .env.development   VITE_USE_MOCK=true                (default)
//   .env.production    VITE_USE_MOCK=false
//                      VITE_API_URL=https://your-backend.example.com

import * as mock from "./mockServer";
import * as http from "./httpClient";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

export const gameApi = useMock ? mock : http;
export { ApiError } from "./errors";
