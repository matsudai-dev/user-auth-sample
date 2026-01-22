import { useState } from "hono/jsx";
import LoginEmailOtpForm from "./login-email-otp-form";
import LoginPasswordForm from "./login-password-form";
import LoginTotpForm from "./login-totp-form";

export default function LoginForm() {
	const [step, setStep] = useState<"password" | "totp" | "email-otp">(
		"password",
	);
	const [mfaTotpLoginSessionToken, setTotpToken] = useState<
		string | undefined
	>();
	const [mfaEmailOtpLoginSessionToken, setEmailOtpToken] = useState<
		string | undefined
	>();

	const handlePasswordSuccess = (tokens: {
		mfaTotpLoginSessionToken?: string;
		mfaEmailOtpLoginSessionToken?: string;
	}) => {
		if (tokens.mfaTotpLoginSessionToken) {
			setTotpToken(tokens.mfaTotpLoginSessionToken);
			setStep("totp");
		} else if (tokens.mfaEmailOtpLoginSessionToken) {
			setEmailOtpToken(tokens.mfaEmailOtpLoginSessionToken);
			setStep("email-otp");
		} else {
			location.href = "/";
		}
	};

	const handleTotpSuccess = () => {
		if (mfaEmailOtpLoginSessionToken) {
			setStep("email-otp");
		} else {
			location.href = "/";
		}
	};

	const handleEmailOtpSuccess = () => {
		location.href = "/";
	};

	if (step === "password") {
		return <LoginPasswordForm onSuccess={handlePasswordSuccess} />;
	}
	if (step === "totp" && mfaTotpLoginSessionToken) {
		return (
			<LoginTotpForm
				mfaTotpLoginSessionToken={mfaTotpLoginSessionToken}
				onSuccess={handleTotpSuccess}
			/>
		);
	}
	if (step === "email-otp" && mfaEmailOtpLoginSessionToken) {
		return (
			<LoginEmailOtpForm
				mfaEmailOtpLoginSessionToken={mfaEmailOtpLoginSessionToken}
				onSuccess={handleEmailOtpSuccess}
			/>
		);
	}
	return null;
}
