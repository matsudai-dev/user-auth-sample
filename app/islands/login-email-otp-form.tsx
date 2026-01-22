import { useState } from "hono/jsx";
import { apiClient } from "@/utils/api/client";

interface Props {
	mfaEmailOtpLoginSessionToken: string;
	onSuccess: () => void;
}

export default function LoginEmailOtpForm({
	mfaEmailOtpLoginSessionToken,
	onSuccess,
}: Props) {
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [resent, setResent] = useState(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const response = await apiClient.v1.login.mfa["email-otp"].$post({
				json: {
					mfaEmailOtpLoginSessionToken,
					otpCode: code,
				},
			});
			if (!response.ok) {
				setError("認証に失敗しました");
				setLoading(false);
				return;
			}
			onSuccess();
		} catch (_err) {
			setError("通信エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	const handleResend = async () => {
		setLoading(true);
		setError("");
		try {
			const response = await apiClient.v1.login.mfa["email-otp"].send.$post({
				json: { mfaEmailOtpLoginSessionToken },
			});
			if (response.ok) setResent(true);
			else setError("再送信に失敗しました");
		} catch {
			setError("通信エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit}>
			<div>認証コードをメールで送信しました</div>
			<label>
				6桁の認証コード
				<input
					type="text"
					inputMode="numeric"
					pattern="[0-9]{6}"
					maxLength={6}
					value={code}
					onInput={(e) => setCode((e.target as HTMLInputElement).value)}
					required
				/>
			</label>
			<button type="submit" disabled={loading}>
				ログイン
			</button>
			<button type="button" onClick={handleResend} disabled={loading}>
				コードを再送信
			</button>
			{resent && <div>認証コードを再送信しました</div>}
			{error && <div>{error}</div>}
		</form>
	);
}
