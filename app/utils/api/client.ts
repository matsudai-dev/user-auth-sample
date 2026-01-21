import { hc } from "hono/client";
import apiV1EmailChangeSend from "@/routes/api/v1/email-change/send";
import apiV1Login from "@/routes/api/v1/login";
import apiV1LoginMfaEmailOtp from "@/routes/api/v1/login/mfa/email-otp";
import apiV1LoginMfaEmailOtpBackupCode from "@/routes/api/v1/login/mfa/email-otp/backup-code";
import apiV1LoginMfaEmailOtpSend from "@/routes/api/v1/login/mfa/email-otp/send";
import apiV1LoginMfaTotp from "@/routes/api/v1/login/mfa/totp";
import apiV1LoginMfaTotpBackupCode from "@/routes/api/v1/login/mfa/totp/backup-code";
import apiV1Logout from "@/routes/api/v1/logout";
import apiV1MfaEmailOtpEnable from "@/routes/api/v1/mfa/email-otp/enable";
import apiV1MfaTotpBackupCodes from "@/routes/api/v1/mfa/totp/backup-codes";
import apiV1MfaTotpBackupCodesRegenerate from "@/routes/api/v1/mfa/totp/backup-codes/regenerate";
import apiV1MfaTotpDisable from "@/routes/api/v1/mfa/totp/disable";
import apiV1MfaTotpEnable from "@/routes/api/v1/mfa/totp/enable";
import apiV1MfaTotpEnableComplete from "@/routes/api/v1/mfa/totp/enable/complete";
import apiV1PasswordChange from "@/routes/api/v1/password-change";
import apiV1PasswordReset from "@/routes/api/v1/password-reset";
import apiV1PasswordResetSend from "@/routes/api/v1/password-reset/send";
import apiV1Signup from "@/routes/api/v1/signup";
import apiV1SignupComplete from "@/routes/api/v1/signup/complete";
import { createHonoApp } from "@/utils/factory/hono";

export const apiRoutes = createHonoApp()
	.route("/api/v1/signup", apiV1Signup)
	.route("/api/v1/signup/complete", apiV1SignupComplete)
	.route("/api/v1/login", apiV1Login)
	.route("/api/v1/login/mfa/totp", apiV1LoginMfaTotp)
	.route("/api/v1/login/mfa/totp/backup-code", apiV1LoginMfaTotpBackupCode)
	.route("/api/v1/login/mfa/email-otp/send", apiV1LoginMfaEmailOtpSend)
	.route("/api/v1/login/mfa/email-otp", apiV1LoginMfaEmailOtp)
	.route(
		"/api/v1/login/mfa/email-otp/backup-code",
		apiV1LoginMfaEmailOtpBackupCode,
	)
	.route("/api/v1/logout", apiV1Logout)
	.route("/api/v1/password-reset/send", apiV1PasswordResetSend)
	.route("/api/v1/password-reset", apiV1PasswordReset)
	.route("/api/v1/password-change", apiV1PasswordChange)
	.route("/api/v1/email-change/send", apiV1EmailChangeSend)
	.route("/api/v1/mfa/totp/enable", apiV1MfaTotpEnable)
	.route("/api/v1/mfa/totp/enable/complete", apiV1MfaTotpEnableComplete)
	.route("/api/v1/mfa/totp/disable", apiV1MfaTotpDisable)
	.route("/api/v1/mfa/totp/backup-codes", apiV1MfaTotpBackupCodes)
	.route(
		"/api/v1/mfa/totp/backup-codes/regenerate",
		apiV1MfaTotpBackupCodesRegenerate,
	)
	.route("/api/v1/mfa/email-otp/enable", apiV1MfaEmailOtpEnable);

export const api = hc<typeof apiRoutes>("/", {
	init: {
		credentials: "include",
	},
});
