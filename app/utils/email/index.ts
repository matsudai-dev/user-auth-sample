import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(apiKey: string): Resend {
	if (resendClient) {
		return resendClient;
	}

	resendClient = new Resend(apiKey);

	return resendClient;
}
