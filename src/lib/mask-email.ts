// "sara@gmail.com" -> "s•••@gmail.com": the first character of the local part and the whole domain.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email.length > 0 ? `${[...email][0]}•••` : "";
  const local = email.slice(0, at);
  return `${[...local][0]}•••${email.slice(at)}`;
}
