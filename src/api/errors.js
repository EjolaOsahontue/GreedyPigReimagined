// Every failure in the app surfaces as an ApiError, so UI code (Member 3's
// error handling) only needs to handle one shape.
export class ApiError extends Error {
  constructor({ status = 0, code = "UNKNOWN", message = "Something went wrong", fields = null }) {
    super(message);
    this.name = "ApiError";
    this.status = status; // HTTP status, or 0 when the request never reached the server
    this.code = code; // VALIDATION_ERROR | GAME_NOT_FOUND | GAME_FINISHED | NETWORK_ERROR | ...
    this.fields = fields; // { fieldName: "what is wrong" } for validation errors
  }
}
