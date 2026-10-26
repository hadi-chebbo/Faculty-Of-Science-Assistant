// Plain errors the entry points translate into HTTP responses or pages.
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// The caller passed arguments the service cannot accept. `fields` names the offending inputs.
export class ValidationError extends Error {
  readonly fields: string[];

  constructor(fields: string[], message = "Invalid input") {
    super(fields.length > 0 ? `${message}: ${fields.join(", ")}` : message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

// Wrong email or password. Deliberately says nothing about which of the two was wrong.
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

// Too many recent failed sign-ins for this email or IP. Checked before the password is.
export class TooManyAttemptsError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many attempts");
    this.name = "TooManyAttemptsError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// The refresh token is unknown, expired, revoked or already used. One error for all of them.
export class InvalidSessionError extends Error {
  constructor() {
    super("Invalid session");
    this.name = "InvalidSessionError";
  }
}

// The resource exists and is visible, but its material cannot be served (yet).
export class UnavailableError extends Error {
  constructor(message = "Unavailable") {
    super(message);
    this.name = "UnavailableError";
  }
}

// The confirmation link is unknown, expired or already used. One error for all of them.
export class InvalidConfirmationTokenError extends Error {
  constructor() {
    super("Invalid confirmation token");
    this.name = "InvalidConfirmationTokenError";
  }
}

// The student already has the most cards a board may hold.
export class BoardFullError extends Error {
  constructor() {
    super("Board full");
    this.name = "BoardFullError";
  }
}

// The password was right but the email address has not been confirmed yet. Only raised after the
// password check, so it reveals nothing to someone who does not know the password.
export class EmailNotConfirmedError extends Error {
  constructor() {
    super("Email not confirmed");
    this.name = "EmailNotConfirmedError";
  }
}
