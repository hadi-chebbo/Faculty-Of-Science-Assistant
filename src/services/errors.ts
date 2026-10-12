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
