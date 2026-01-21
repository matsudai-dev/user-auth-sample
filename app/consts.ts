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

/** Login rate limit record expiration duration in milliseconds */
export const LOGIN_RATE_LIMIT_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

/** MFA login session expiration duration in milliseconds */
export const MFA_LOGIN_SESSION_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/** Password reset session expiration duration in milliseconds */
export const PASSWORD_RESET_SESSION_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

/** MFA TOTP enable session expiration duration in milliseconds */
export const MFA_TOTP_ENABLE_SESSION_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

/** MFA Email OTP session expiration duration in milliseconds */
export const MFA_EMAIL_OTP_ENABLE_SESSION_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

/** MFA Email OTP disable session expiration duration in milliseconds */
export const MFA_EMAIL_OTP_DISABLE_SESSION_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

/** Number of backup codes to generate */
export const BACKUP_CODES_COUNT = 10;

/** Length of each backup code */
export const BACKUP_CODE_LENGTH = 12;

/** Deleted user reregistration allowed duration in milliseconds */
export const DELETED_USER_REREGISTRATION_ALLOWED_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Deleted user record expiration duration in milliseconds */
export const DELETED_USER_EXPIRATION_MS = 31 * 24 * 60 * 60 * 1000; // 31 days
