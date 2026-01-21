import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Helper function to define a boolean column */
const boolean = (name: string) => integer(name, { mode: "boolean" });

/** Helper function to define a timestamp column */
const timestamp = (name: string) => integer(name, { mode: "timestamp" });

/** Helper function to get the current Unix epoch time */
const now = () => sql`(unixepoch())`;

/** `users` table schema definition */
export const usersTable = sqliteTable("users", {
	/** UUIDv7 */
	id: text("id").primaryKey(),
	/** User's email address */
	email: text("email").notNull().unique(),
	/** Salt used for password hashing */
	salt: text("salt").notNull(),
	/** Hashed password */
	passwordHash: text("password_hash").notNull(),
	/** Multi-factor authentication via email OTP enabled */
	mfaEmailOtpEnabled: boolean("mfa_email_otp_enabled").notNull().default(false),
	/** TOTP secret for multi-factor authentication */
	mfaTotpSecret: text("mfa_totp_secret"),
	/** Timestamp of user creation */
	createdAt: timestamp("created_at").notNull().default(now()),
});

/** `deleted_users` table schema definition */
export const deletedUsersTable = sqliteTable("deleted_users", {
	/** UUIDv7 of the original user */
	userId: text("user_id").primaryKey(),
	/** Email address of the deleted user */
	email: text("email").notNull(),
	/** Timestamp when the user was deleted */
	deletedAt: timestamp("deleted_at").notNull().default(now()),
	/** Timestamp when re-registration is allowed */
	reregistrationAllowedAt: timestamp("reregistration_allowed_at").notNull(),
	/** Timestamp when the record will be permanently deleted */
	expireAt: timestamp("expire_at").notNull(),
});

/** `signup_sessions` table schema definition */
export const signupSessionsTable = sqliteTable("signup_sessions", {
	/** UUIDv7 */
	id: text("id").primaryKey(),
	/** Email address for signup */
	email: text("email").notNull().unique(),
	/** Hashed signup session token */
	signupSessionTokenHash: text("signup_session_token_hash").notNull().unique(),
	/** Timestamp when the session was created */
	createdAt: timestamp("created_at").notNull().default(now()),
	/** Timestamp when the session expires */
	expireAt: timestamp("expire_at").notNull(),
});

/** `login_rate_limits` table schema definition */
export const loginRateLimitsTable = sqliteTable("login_rate_limits", {
	/** Email address (not a foreign key) */
	email: text("email").primaryKey(),
	/** Failed attempts count */
	failedAttempts: integer("failed_attempts").default(0).notNull(),
	/** Timestamp until which login is locked */
	lockedUntil: timestamp("locked_until"),
	/** Timestamp when the last attempt was made */
	lastAttemptAt: timestamp("last_attempt_at").notNull(),
	/** Timestamp when the rate limit record expires */
	expireAt: timestamp("expire_at").notNull(),
});

/** `login_sessions` table schema definition */
export const loginSessionsTable = sqliteTable("login_sessions", {
	/** UUIDv7 */
	id: text("id").primaryKey(),
	/** Reference to users.id */
	userId: text("user_id")
		.notNull()
		.references(() => usersTable.id),
	/** Hashed refresh token */
	refreshTokenHash: text("refresh_token_hash").notNull(),
	/** User agent string */
	userAgent: text("user_agent").notNull(),
	/** Timestamp when the session was created */
	createdAt: timestamp("created_at").notNull().default(now()),
	/** Timestamp when the session was last accessed */
	lastAccessedAt: timestamp("last_accessed_at").notNull().default(now()),
	/** Timestamp when the session expires */
	expireAt: timestamp("expire_at").notNull(),
});

/** `password_reset_sessions` table schema definition */
export const passwordResetSessionsTable = sqliteTable(
	"password_reset_sessions",
	{
		/** UUIDv7 */
		id: text("id").primaryKey(),
		/** Reference to users.id */
		userId: text("user_id")
			.notNull()
			.references(() => usersTable.id),
		/** Hashed password reset token */
		passwordResetTokenHash: text("password_reset_token_hash").notNull(),
		/** Timestamp when the session was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the session expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `password_reset_rate_limits` table schema definition */
export const passwordResetRateLimitsTable = sqliteTable(
	"password_reset_rate_limits",
	{
		/** Email address (not a foreign key) */
		email: text("email").primaryKey(),
		/** Timestamp when the last request was made */
		lastRequestAt: timestamp("last_request_at").notNull().default(now()),
		/** Timestamp when the rate limit expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `password_change_rate_limits` table schema definition */
export const passwordChangeRateLimitsTable = sqliteTable(
	"password_change_rate_limits",
	{
		/** Reference to users.id */
		userId: text("user_id")
			.primaryKey()
			.references(() => usersTable.id),
		/** Timestamp when the last request was made */
		lastRequestAt: timestamp("last_request_at").notNull().default(now()),
		/** Timestamp when the rate limit expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `email_change_sessions` table schema definition */
export const emailChangeSessionsTable = sqliteTable("email_change_sessions", {
	/** Reference to users.id */
	userId: text("user_id")
		.primaryKey()
		.references(() => usersTable.id),
	/** New email address to change to */
	newEmail: text("new_email").notNull(),
	/** Hashed email change token */
	emailChangeTokenHash: text("email_change_token_hash").notNull(),
	/** Timestamp when the session was created */
	createdAt: timestamp("created_at").notNull().default(now()),
	/** Timestamp when the session expires */
	expireAt: timestamp("expire_at").notNull(),
});

/** `mfa_totp_enable_sessions` table schema definition */
export const mfaTotpEnableSessionsTable = sqliteTable(
	"mfa_totp_enable_sessions",
	{
		/** Reference to users.id */
		userId: text("user_id")
			.primaryKey()
			.references(() => usersTable.id),
		/** Hashed MFA TOTP enable session token */
		mfaTotpEnableSessionTokenHash: text(
			"mfa_totp_enable_session_token_hash",
		).notNull(),
		/** TOTP secret for verification */
		totpSecret: text("totp_secret").notNull(),
		/** Timestamp when the session was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the session expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `mfa_email_otp_enable_sessions` table schema definition */
export const mfaEmailOtpEnableSessionsTable = sqliteTable(
	"mfa_email_otp_enable_sessions",
	{
		/** Reference to users.id */
		userId: text("user_id")
			.primaryKey()
			.references(() => usersTable.id),
		/** Hashed MFA email OTP enable session token */
		mfaEmailOtpEnableSessionTokenHash: text(
			"mfa_email_otp_enable_session_token_hash",
		).notNull(),
		/** Hashed OTP code */
		otpCodeHash: text("otp_code_hash").notNull(),
		/** Timestamp when the session was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the session expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `mfa_totp_login_sessions` table schema definition */
export const mfaTotpLoginSessionsTable = sqliteTable(
	"mfa_totp_login_sessions",
	{
		/** Reference to users.id */
		userId: text("user_id")
			.primaryKey()
			.references(() => usersTable.id),
		/** Hashed MFA TOTP login session token */
		mfaTotpLoginSessionTokenHash: text(
			"mfa_totp_login_session_token_hash",
		).notNull(),
		/** Whether to remember the user's login */
		rememberMe: boolean("remember_me").notNull(),
		/** Timestamp when the session was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the session expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `mfa_email_otp_login_sessions` table schema definition */
export const mfaEmailOtpLoginSessionsTable = sqliteTable(
	"mfa_email_otp_login_sessions",
	{
		/** Reference to users.id */
		userId: text("user_id")
			.primaryKey()
			.references(() => usersTable.id),
		/** Hashed MFA email OTP login session token */
		mfaEmailOtpLoginSessionTokenHash: text(
			"mfa_email_otp_login_session_token_hash",
		).notNull(),
		/** Hashed OTP code */
		otpCodeHash: text("otp_code_hash").notNull(),
		/** Whether to remember the user's login */
		rememberMe: boolean("remember_me").notNull(),
		/** Timestamp when the session was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the session expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `mfa_email_otp_disable_sessions` table schema definition */
export const mfaEmailOtpDisableSessionsTable = sqliteTable(
	"mfa_email_otp_disable_sessions",
	{
		/** Reference to users.id */
		userId: text("user_id")
			.primaryKey()
			.references(() => usersTable.id),
		/** Hashed MFA email OTP disable session token */
		mfaEmailOtpDisableSessionTokenHash: text(
			"mfa_email_otp_disable_session_token_hash",
		).notNull(),
		/** Hashed OTP code */
		otpCodeHash: text("otp_code_hash").notNull(),
		/** Timestamp when the session was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the session expires */
		expireAt: timestamp("expire_at").notNull(),
	},
);

/** `mfa_totp_backup_codes` table schema definition */
export const mfaTotpBackupCodesTable = sqliteTable("mfa_totp_backup_codes", {
	/** UUIDv7 */
	id: text("id").primaryKey(),
	/** Reference to users.id */
	userId: text("user_id")
		.notNull()
		.references(() => usersTable.id),
	/** Hashed backup code */
	backupCodeHash: text("backup_code_hash").notNull(),
	/** Last four characters of the backup code for identification */
	lastFourChars: text("last_four_chars").notNull(),
	/** Timestamp when the backup code was created */
	createdAt: timestamp("created_at").notNull().default(now()),
	/** Timestamp when the backup code was used */
	usedAt: timestamp("used_at"),
});

/** `mfa_email_otp_backup_codes` table schema definition */
export const mfaEmailOtpBackupCodesTable = sqliteTable(
	"mfa_email_otp_backup_codes",
	{
		/** UUIDv7 */
		id: text("id").primaryKey(),
		/** Reference to users.id */
		userId: text("user_id")
			.notNull()
			.references(() => usersTable.id),
		/** Hashed backup code */
		backupCodeHash: text("backup_code_hash").notNull(),
		/** Timestamp when the backup code was created */
		createdAt: timestamp("created_at").notNull().default(now()),
		/** Timestamp when the backup code was used */
		usedAt: timestamp("used_at"),
	},
);
