// Numbers the screen needs to DRAW the Hot Streak (how many dots, "of 10").
// They only mirror the server's rule. The server decides every real roll and bonus,
// so changing a number here changes what is shown, not how the game scores.
export const HOT_STREAK = {
  igniteAt: 3, // non-1 rolls in a row that set a player ON FIRE
  bonusPerRoll: 2, // extra points for every roll while ON FIRE
  bonusCap: 10, // most bonus points one turn can earn
};
