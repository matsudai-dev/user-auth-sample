import { useState } from "hono/jsx";
import { apiClient } from "@/utils/api/client";

export default function SignupForm() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setSuccess(false);

		try {
			const response = await apiClient.v1.signup.$post({
				json: { email },
			});

			if (!response.ok) {
				setError("送信に失敗しました");
				setLoading(false);
				return;
			}

			setSuccess(true);
		} catch (_err) {
			setError("通信エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 space-y-4">
			<label className="block space-y-2">
				<span className="text-sm font-medium text-gray-700">
					メールアドレス
				</span>
				<input
					type="email"
					name="email"
					value={email}
					onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
					required
					className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</label>
			<button
				type="submit"
				disabled={loading}
				className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? "送信中..." : "登録用URLを送信"}
			</button>
			{error && (
				<div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
					{error}
				</div>
			)}
			{success && (
				<div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
					登録用URLを送信しました。メールをご確認ください。
				</div>
			)}
		</form>
	);
}
