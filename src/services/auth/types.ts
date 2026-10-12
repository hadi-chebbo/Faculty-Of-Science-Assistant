import type { UserRole } from "@/db/constants";

export interface AccountSummary {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

// What the caller turns into cookies. The raw refresh token exists only here and in the cookie.
export interface Session {
  user: AccountSummary;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
