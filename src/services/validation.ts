import { z } from "zod";
import { ValidationError } from "./errors";

// Services check their own arguments, so a caller that skips validation gets a ValidationError
// instead of a database error.
export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "value"))];
    throw new ValidationError(fields);
  }
  return result.data;
}

// A filter form submits "" for "All", so a blank string means the value was not given.
export function blankToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}
