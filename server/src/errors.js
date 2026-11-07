export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    }
}

export const gameNotFound = () => new AppError(404, "GAME_NOT_FOUND", "Game not found");
export const gameFinished = () =>
  new AppError(409, "GAME_FINISHED", "This game is already finished");

export function handleError(err, req, res, next) {
  if (err instanceof AppError) {
    const errbody = {code: err.code, message: err.message};
    if (err.fields) {
      errbody.fields = err.fields;
    }
    return res.status(err.status).json({error: errbody});
  }
  console.error(err);
  return res.status(500).json({error: {code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error'}});
}