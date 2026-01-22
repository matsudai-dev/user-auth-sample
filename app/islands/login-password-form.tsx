import { useState } from "hono/jsx";
import { apiClient } from "@/utils/api/client";

interface Props {
	onSuccess: (tokens: {
		mfaTotpLoginSessionToken?: string;
		mfaEmailOtpLoginSessionToken?: string;
	}) => void;
}

export default function LoginPasswordForm({ onSuccess }: Props) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const response = await apiClient.v1.login.$post({
				json: { email, password, rememberMe },
			});
			if (!response.ok) {
				setError("ログインに失敗しました");
				setLoading(false);
				return;
			}
			const tokens = await response.json();
			onSuccess(tokens);
		} catch (_err) {
			setError("通信エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit}>
			<label>
				メールアドレス
				<input
					type="email"
					name="email"
					value={email}
					onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
					required
				/>
			</label>
			<label>
				パスワード
				<input
					type="password"
					name="password"
					value={password}
					onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
					required
				/>
			</label>
			<label>
				<input
					type="checkbox"
					name="rememberMe"
					checked={rememberMe}
					onChange={(e) =>
						setRememberMe((e.target as HTMLInputElement).checked)
					}
				/>
				ログイン状態を維持する
			</label>
			<button type="submit" disabled={loading}>
				ログイン
			</button>
			{error && <div>{error}</div>}
			<a href="/password-reset">パスワードを忘れた方はこちら</a>
		</form>
	);
}
