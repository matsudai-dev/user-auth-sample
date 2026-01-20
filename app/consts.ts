export const OK = "OK";
export const BAD_REQUEST = "Bad Request";
export const UNAUTHORIZED = "Unauthorized";
export const NOT_FOUND = "Not Found";
export const CONFLICT = "Conflict";
export const GONE = "Gone";
export const TOO_MANY_REQUESTS = "Too Many Requests";

/** Signup session expiration durations in milliseconds */
export const SIGNUP_SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Authentication token expiration durations in milliseconds */
export const ACCESS_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

/** Refresh token expiration duration in milliseconds */
export const REFRESH_TOKEN_EXPIRATION_MS = 31 * 24 * 60 * 60 * 1000; // 31 days

/** Login rate limit max attempts */
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Login rate limit lock duration in milliseconds */
export const LOGIN_RATE_LIMIT_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** MFA login session expiration duration in milliseconds */
export const MFA_LOGIN_SESSION_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/** Password reset session expiration duration in milliseconds */
export const PASSWORD_RESET_SESSION_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
