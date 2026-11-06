import { z } from "zod";
import { AppError } from "./errors.js";

const playerSchema = z.strictObject({
    name: z
    .string({error: "Name must be text"}).trim().max(20, "Name cannot be longer than 20 characters").default(""),
    pig_index: z.
    number({error: "It must be a number from 0 to 28"}).int({error: "It must be an integer from 0 to 28"}).min(0, "Pig index must be a number from 0 to 28").max(28, "Pig index must be a number from 0 to 28"),
});

export const createGameSchema = z.strictObject({
  players: z.array(playerSchema, { error: "Players must be a list" }).min(2, "A game needs at least 2 players").max(8, "A game can have at most 8 players"),
  target_score: z.number({ error: "Target score must be a whole number from 25 to 1000" }).int("Target score must be a whole number from 25 to 1000")
  .min(25, "Target score must be a whole number from 25 to 1000").max(1000, "Target score must be a whole number from 25 to 1000").default(100),
});


export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

   const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_"; // e.g. "players.0.name"
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  throw new AppError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fields);
}