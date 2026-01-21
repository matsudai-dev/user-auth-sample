import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";
import { hashPassword } from "@/utils/crypto/server";

const mockGetDBClient = mock(() => ({}));

const mockGenerateAccessToken = mock((_userId: string, _jwtSecret: string) =>
	Promise.resolve("mock-access-token"),
);

const mockSetAccessTokenInCookie = mock((_c: unknown, _token: string) =>
	Promise.resolve(),
);

const mockSetRefreshTokenInCookie = mock((_c: unknown, _token: string) =>
	Promise.resolve(),
);

const mockGetResendClient = mock(() => ({
	emails: {
		send: mock((_v: { to: string; subject: string; html: string }) =>
			Promise.resolve(),
		),
	},
}));

const mockValidateLoginRateLimit = mock<
	() =>
		| Promise<{ isLocked: true; lockedUntil: Date }>
		| Promise<{ isLocked: false; currentFailedAttempts: number }>
>(() => Promise.resolve({ isLocked: false, currentFailedAttempts: 0 }));

const mockIncrementLoginAttempts = mock(() =>
	Promise.resolve({ locked: false }),
);

mock.module("@/db/client", () => ({
	getDBClient: mockGetDBClient,
}));

mock.module("@/utils/auth", () => ({
	generateAccessToken: mockGenerateAccessToken,
	generateRefreshToken: () => ({
		refreshToken: "mock-refresh-token",
		refreshTokenHash: "mock-refresh-token-hash",
		expireAt: new Date(Date.now() + 86400000),
	}),
	setAccessTokenInCookie: mockSetAccessTokenInCookie,
	setRefreshTokenInCookie: mockSetRefreshTokenInCookie,
	getUserIdFromAccessTokenCookie: mock(() => Promise.resolve()),
	getRefreshTokenFromCookie: mock(() => Promise.resolve()),
	deleteAccessTokenCookie: mock(() => {}),
	deleteRefreshTokenCookie: mock(() => {}),
	validateLoginRateLimit: mockValidateLoginRateLimit,
	incrementLoginAttempts: mockIncrementLoginAttempts,
}));

mock.module("@/utils/email", () => ({
	getResendClient: mockGetResendClient,
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	JWT_SECRET: "test-jwt-secret",
	RESEND_API_KEY: "test-api-key",
	RESEND_EMAIL_FROM: "test@example.com",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockGenerateAccessToken.mockClear();
	mockSetAccessTokenInCookie.mockClear();
	mockSetRefreshTokenInCookie.mockClear();
	mockGetResendClient.mockClear();
	mockValidateLoginRateLimit.mockClear();
	mockIncrementLoginAttempts.mockClear();

	// Reset default behavior
	mockValidateLoginRateLimit.mockResolvedValue({
		isLocked: false,
		currentFailedAttempts: 0,
	});
	mockIncrementLoginAttempts.mockResolvedValue({ locked: false });
});

describe("POST /api/v1/login - Error cases", () => {
	it("should return 429 when login is locked", async () => {
		const futureDate = new Date(Date.now() + 900000); // 15 minutes from now

		mockValidateLoginRateLimit.mockResolvedValue({
			isLocked: true,
			lockedUntil: futureDate,
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "password123",
			},
		});

		expect(response.status).toBe(429);
		expect(mockValidateLoginRateLimit).toHaveBeenCalledTimes(1);
	});

	it("should return 401 when user does not exist", async () => {
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(undefined),
					}),
				}),
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "nonexistent@example.com",
				password: "password123",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 401 when password is incorrect", async () => {
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								salt: "salt",
								passwordHash: "wrong-hash",
								mfaTotpEnabled: false,
								mfaEmailOtpEnabled: false,
							}),
					}),
				}),
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "wrongpassword",
			},
		});

		expect(response.status).toBe(401);
		expect(mockIncrementLoginAttempts).toHaveBeenCalledTimes(1);
		expect(mockIncrementLoginAttempts).toHaveBeenCalledWith(
			expect.anything(),
			"test@example.com",
			0,
		);
	});

	it("should return 429 when password is incorrect and max attempts reached", async () => {
		mockValidateLoginRateLimit.mockResolvedValue({
			isLocked: false,
			currentFailedAttempts: 4,
		});

		mockIncrementLoginAttempts.mockResolvedValue({ locked: true });

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								salt: "salt",
								passwordHash: "wrong-hash",
								mfaTotpEnabled: false,
								mfaEmailOtpEnabled: false,
							}),
					}),
				}),
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "wrongpassword",
			},
		});

		expect(response.status).toBe(429);
		expect(mockIncrementLoginAttempts).toHaveBeenCalledWith(
			expect.anything(),
			"test@example.com",
			4,
		);
	});

	it("should return 400 when password is too short", async () => {
		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "short",
			},
		});

		expect(response.status).toBe(400);
	});
});

describe("POST /api/v1/login - Success cases without MFA", () => {
	it("should login successfully without rememberMe", async () => {
		const salt = "mock-salt";
		const mockUser = {
			id: "user-id",
			email: "test@example.com",
			salt,
			passwordHash: hashPassword("password123", salt),
			mfaTotpEnabled: false,
			mfaEmailOtpEnabled: false,
		};

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(mockUser),
					}),
				}),
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "password123",
			},
		});

		expect(response.status).toBe(200);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).not.toHaveBeenCalled();
	});

	it("should login successfully with rememberMe", async () => {
		const salt = "mock-salt";
		const mockUser = {
			id: "user-id",
			email: "test@example.com",
			salt,
			passwordHash: hashPassword("password123", salt),
			mfaTotpEnabled: false,
			mfaEmailOtpEnabled: false,
		};

		let insertedLoginSession = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(mockUser),
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: (_data: unknown) => {
					insertedLoginSession = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "password123",
				rememberMe: true,
			},
		});

		expect(response.status).toBe(200);
		expect(insertedLoginSession).toBe(true);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).toHaveBeenCalledTimes(1);
	});
});

describe("POST /api/v1/login - Success cases with MFA", () => {
	it("should return MFA session tokens when TOTP is enabled", async () => {
		const salt = "mock-salt";
		const mockUser = {
			id: "user-id",
			email: "test@example.com",
			salt,
			passwordHash: hashPassword("password123", salt),
			mfaTotpSecret: "JBSWY3DPEHPK3PXP",
			mfaEmailOtpEnabled: false,
		};

		let insertedTotpSession = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(mockUser),
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: (_data: unknown) => {
					insertedTotpSession = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "password123",
			},
		});

		expect(response.status).toBe(200);
		expect(insertedTotpSession).toBe(true);

		const json = await response.json();
		expect(json).toHaveProperty("mfaTotpLoginSessionToken");
		expect(json).not.toHaveProperty("mfaEmailOtpLoginSessionToken");
	});

	it("should return MFA session tokens when Email OTP is enabled", async () => {
		const salt = "mock-salt";
		const mockUser = {
			id: "user-id",
			email: "test@example.com",
			salt,
			passwordHash: hashPassword("password123", salt),
			mfaTotpEnabled: false,
			mfaEmailOtpEnabled: true,
		};

		let insertedEmailOtpSession = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(mockUser),
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: (_data: unknown) => {
					insertedEmailOtpSession = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "password123",
			},
		});

		expect(response.status).toBe(200);
		expect(insertedEmailOtpSession).toBe(true);
		expect(mockGetResendClient).toHaveBeenCalled();

		const json = await response.json();
		expect(json).not.toHaveProperty("mfaTotpLoginSessionToken");
		expect(json).toHaveProperty("mfaEmailOtpLoginSessionToken");
	});

	it("should return both MFA session tokens when both are enabled", async () => {
		const salt = "mock-salt";
		const mockUser = {
			id: "user-id",
			email: "test@example.com",
			salt,
			passwordHash: hashPassword("password123", salt),
			mfaTotpSecret: "JBSWY3DPEHPK3PXP",
			mfaEmailOtpEnabled: true,
		};

		let insertCount = 0;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(mockUser),
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: (_data: unknown) => {
					insertCount++;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.$post({
			json: {
				email: "test@example.com",
				password: "password123",
			},
		});

		expect(response.status).toBe(200);
		expect(insertCount).toBe(2);

		const json = await response.json();
		expect(json).toHaveProperty("mfaTotpLoginSessionToken");
		expect(json).toHaveProperty("mfaEmailOtpLoginSessionToken");
	});
});
