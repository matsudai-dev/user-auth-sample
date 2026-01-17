import { hc } from "hono/client";
import apiV1Login from "@/routes/api/v1/login";
import apiV1LoginMfaEmailOtp from "@/routes/api/v1/login/mfa/email-otp";
import apiV1LoginMfaEmailOtpBackupCode from "@/routes/api/v1/login/mfa/email-otp/backup-code";
import apiV1LoginMfaEmailOtpSend from "@/routes/api/v1/login/mfa/email-otp/send";
import apiV1LoginMfaTotp from "@/routes/api/v1/login/mfa/totp";
import apiV1LoginMfaTotpBackupCode from "@/routes/api/v1/login/mfa/totp/backup-code";
import apiV1Logout from "@/routes/api/v1/logout";
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
	.route("/api/v1/logout", apiV1Logout);

export const api = hc<typeof apiRoutes>("/", {
	init: {
		credentials: "include",
	},
});
