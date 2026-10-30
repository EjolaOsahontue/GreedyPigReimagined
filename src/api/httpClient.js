// Real implementation: talks to Member 1's deployed API.
// Same function names and return shapes as mockServer.js, so components never change.

import { ApiError } from "./errors";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = 10000;

async function request(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: err.name === "AbortError" ? "The server took too long to respond" : "Could not reach the server",
    });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: data?.error?.code || "UNKNOWN",
      message: data?.error?.message || `Request failed (${res.status})`,
      fields: data?.error?.fields || null,
    });
  }
  return data;
}

export const createGame = ({ players, targetScore }) =>
  request("POST", "/games", { players, target_score: targetScore });

export const getGame = (gameId) => request("GET", `/games/${encodeURIComponent(gameId)}`);

export const rollDice = (gameId) => request("POST", `/games/${encodeURIComponent(gameId)}/roll`);

export const bankPoints = (gameId) => request("POST", `/games/${encodeURIComponent(gameId)}/bank`);
