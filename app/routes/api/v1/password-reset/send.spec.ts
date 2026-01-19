import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

const mockGetDBClient = mock(() => ({}));

const mockHashToken = mock((token: string) => `hashed-${token}`);

const mockGenerateSecureToken = mock(() => "mock-secure-token");

const mockGenerateUuidv7 = mock(() => "mock-uuid-v7");

const mockOffsetMilliSeconds = mock(
	(date: Date, ms: number) => new Date(date.getTime() + ms),
);

const mockGetResendClient = mock(() => ({
	emails: {
		send: mock((_v: unknown) => Promise.resolve()),
	},
}));

mock.module("@/db/client", () => ({
	getDBClient: mockGetDBClient,
}));

mock.module("@/utils/crypto/server", () => ({
	hashToken: mockHashToken,
	generateSecureToken: mockGenerateSecureToken,
	generateUuidv7: mockGenerateUuidv7,
	hashPassword: mock(() => "hashed-password"),
	generateSalt: mock(() => "generated-salt"),
	generateOtpCode: mock(() => "123456"),
}));

mock.module("@/utils/date", () => ({
	offsetMilliSeconds: mockOffsetMilliSeconds,
}));

mock.module("@/utils/email", () => ({
	getResendClient: mockGetResendClient,
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	RESEND_API_KEY: "test-resend-api-key",
	RESEND_EMAIL_FROM: "test@example.com",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockHashToken.mockClear();
	mockGenerateSecureToken.mockClear();
	mockGenerateUuidv7.mockClear();
	mockOffsetMilliSeconds.mockClear();
	mockGetResendClient.mockClear();
});

describe("POST /api/v1/password-reset - Error cases", () => {
	it("should return 400 when email is invalid", async () => {
		const response = await api.v1["password-reset"].send.$post({
			json: {
				email: "invalid-email",
			},
		});

		expect(response.status).toBe(400);
	});

	it("should return 429 when rate limit is exceeded", async () => {
		const futureDate = new Date(Date.now() + 3600000);

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								email: "test@example.com",
								lastRequestAt: new Date(),
								expireAt: futureDate,
							}),
					}),
				}),
			}),
		});

		const response = await api.v1["password-reset"].send.$post({
			json: {
				email: "test@example.com",
			},
		});

		expect(response.status).toBe(429);
	});
});

describe("POST /api/v1/password-reset - Success cases", () => {
	it("should return 200 when user does not exist (prevent user enumeration)", async () => {
		let rateLimitInserted = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: (_table: unknown) => ({
					where: () => ({
						get: () => {
							// Rate limit check returns nothing (no rate limit)
							// User check returns nothing (user doesn't exist)
							return Promise.resolve(undefined);
						},
					}),
				}),
			}),
			insert: () => ({
				values: () => ({
					onConflictDoUpdate: () => {
						rateLimitInserted = true;
						return Promise.resolve();
					},
				}),
			}),
		});

		const response = await api.v1["password-reset"].send.$post({
			json: {
				email: "nonexistent@example.com",
			},
		});

		expect(response.status).toBe(200);
		expect(rateLimitInserted).toBe(true);
	});

	it("should return 200 and create password reset session when user exists", async () => {
		let rateLimitInserted = false;
		let sessionDeleted = false;
		let sessionInserted = false;
		let emailSent = false;

		const mockEmailSend = mock(() => {
			emailSent = true;
			return Promise.resolve();
		});

		mockGetResendClient.mockReturnValue({
			emails: {
				send: mockEmailSend,
			},
		});

		let selectCallCount = 0;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							selectCallCount++;
							if (selectCallCount === 1) {
								// Rate limit check
								return Promise.resolve(undefined);
							}
							// User check
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
							});
						},
					}),
				}),
			}),
			insert: () => ({
				values: () => ({
					onConflictDoUpdate: () => {
						rateLimitInserted = true;
						return Promise.resolve();
					},
				}),
			}),
			delete: () => ({
				where: () => {
					sessionDeleted = true;
					return Promise.resolve();
				},
			}),
		});

		// Override insert for session creation
		const _originalMockGetDBClient = mockGetDBClient.getMockImplementation();
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							selectCallCount++;
							if (selectCallCount === 1) {
								return Promise.resolve(undefined);
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
							});
						},
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: () => {
					sessionInserted = true;
					return {
						onConflictDoUpdate: () => {
							rateLimitInserted = true;
							return Promise.resolve();
						},
					};
				},
			}),
			delete: () => ({
				where: () => {
					sessionDeleted = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1["password-reset"].send.$post({
			json: {
				email: "test@example.com",
			},
		});

		expect(response.status).toBe(200);
		expect(rateLimitInserted).toBe(true);
		expect(sessionDeleted).toBe(true);
		expect(sessionInserted).toBe(true);
		expect(emailSent).toBe(true);
		expect(mockGenerateSecureToken).toHaveBeenCalledTimes(1);
		expect(mockGenerateUuidv7).toHaveBeenCalledTimes(1);
		expect(mockHashToken).toHaveBeenCalledTimes(1);
	});

	it("should include correct password reset URL in email", async () => {
		let emailContent: unknown = null;

		const mockEmailSend = mock((data: unknown) => {
			emailContent = data;
			return Promise.resolve();
		});

		mockGetResendClient.mockReturnValue({
			emails: {
				send: mockEmailSend,
			},
		});

		let selectCallCount = 0;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							selectCallCount++;
							if (selectCallCount === 1) {
								return Promise.resolve(undefined);
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
							});
						},
					}),
				}),
			}),
			insert: () => ({
				values: () => ({
					onConflictDoUpdate: () => Promise.resolve(),
				}),
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
		});

		const response = await api.v1["password-reset"].send.$post({
			json: {
				email: "test@example.com",
			},
		});

		expect(response.status).toBe(200);
		expect(emailContent).toBeDefined();

		const email = emailContent as {
			from: string;
			to: string;
			subject: string;
			html: string;
		};

		expect(email.from).toBe("test@example.com");
		expect(email.to).toBe("test@example.com");
		expect(email.subject).toBe("Password Reset Request");
		expect(email.html).toContain(
			"password-reset/complete?token=mock-secure-token",
		);
		expect(email.html).toContain("This link will expire in 1 hour");
	});
});
