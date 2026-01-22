import { useState } from "hono/jsx";
import { apiClient } from "@/utils/api/client";

interface Props {
	mfaTotpLoginSessionToken: string;
	onSuccess: () => void;
}

export default function LoginTotpForm({
	mfaTotpLoginSessionToken,
	onSuccess,
}: Props) {
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const response = await apiClient.v1.login.mfa.totp.$post({
				json: {
					mfaTotpLoginSessionToken,
					totpCode: code,
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

	return (
		<form onSubmit={handleSubmit}>
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
			{error && <div>{error}</div>}
		</form>
	);
}
