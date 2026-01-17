import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

interface mockEmailSendData {
	from: string;
	to: string;
	subject: string;
	text: string;
}

const mockGetDBClient = mock(() => ({}));

const mockGetResendClient = mock(() => ({
	emails: {
		send: mock((_v: mockEmailSendData) => Promise.resolve()),
	},
}));

mock.module("@/db/client", () => ({
	getDBClient: mockGetDBClient,
}));

mock.module("@/utils/email", () => ({
	getResendClient: mockGetResendClient,
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	RESEND_API_KEY: "test-resend-key",
	RESEND_EMAIL_FROM: "test@example.com",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockGetResendClient.mockClear();
	const resendClient = mockGetResendClient();
	if (resendClient?.emails?.send) {
		resendClient.emails.send.mockClear();
	}
});

describe("POST /api/v1/login/mfa/email-otp - Error cases", () => {
	it("should return 401 when session does not exist", async () => {
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(undefined),
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa["email-otp"].send.$post({
			json: {
				mfaEmailOtpLoginSessionToken: "invalid-token",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 410 when session has expired", async () => {
		const pastDate = new Date(Date.now() - 86400000); // -1 day

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								userId: "user-id",
								mfaEmailOtpLoginSessionTokenHash: "hash",
								otpCodeHash: "old-hash",
								rememberMe: false,
								expireAt: pastDate,
							}),
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa["email-otp"].send.$post({
			json: {
				mfaEmailOtpLoginSessionToken: "valid-token",
			},
		});

		expect(response.status).toBe(410);
	});

	it("should return 404 when user does not exist", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							callCount++;
							if (callCount === 1) {
								return Promise.resolve({
									userId: "user-id",
									mfaEmailOtpLoginSessionTokenHash: "hash",
									otpCodeHash: "old-hash",
									rememberMe: false,
									expireAt: futureDate,
								});
							}
							return Promise.resolve(undefined);
						},
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa["email-otp"].send.$post({
			json: {
				mfaEmailOtpLoginSessionToken: "valid-token",
			},
		});

		expect(response.status).toBe(404);
	});

	it("should return 400 when mfaEmailOtpLoginSessionToken is empty", async () => {
		const response = await api.v1.login.mfa["email-otp"].send.$post({
			json: {
				mfaEmailOtpLoginSessionToken: "",
			},
		});

		expect(response.status).toBe(400);
	});
});

describe("POST /api/v1/login/mfa/email-otp - Success cases", () => {
	it("should generate new OTP code and send email", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		let updatedSession = false;
		const mockEmailSend = mock((_v: mockEmailSendData) => Promise.resolve());

		mockGetResendClient.mockReturnValue({
			emails: {
				send: mockEmailSend,
			},
		});

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							callCount++;
							if (callCount === 1) {
								return Promise.resolve({
									userId: "user-id",
									mfaEmailOtpLoginSessionTokenHash: "hash",
									otpCodeHash: "old-hash",
									rememberMe: false,
									expireAt: futureDate,
								});
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
							});
						},
					}),
				}),
			}),
			update: () => ({
				set: () => ({
					where: () => {
						updatedSession = true;
						return Promise.resolve();
					},
				}),
			}),
		});

		const response = await api.v1.login.mfa["email-otp"].send.$post({
			json: {
				mfaEmailOtpLoginSessionToken: "valid-token",
			},
		});

		expect(response.status).toBe(200);
		expect(updatedSession).toBe(true);
		expect(mockEmailSend).toHaveBeenCalledTimes(1);

		const emailCall = mockEmailSend.mock.calls[0];
		if (!emailCall) {
			throw new Error("Email send was not called");
		}
		const emailArgs = emailCall[0] as unknown as {
			from: string;
			to: string;
			subject: string;
			text: string;
		};

		expect(emailArgs.from).toBe("test@example.com");
		expect(emailArgs.to).toBe("test@example.com");
		expect(emailArgs.subject).toBe("Email OTP Code");
		expect(emailArgs.text).toContain("Your email OTP code is:");
		expect(emailArgs.text).toMatch(/\d{6}/);
	});
});
