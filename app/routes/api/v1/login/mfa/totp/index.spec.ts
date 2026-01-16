import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

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

const mockVerifyTotpCode = mock((_code: string, _secret: string) => true);

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
}));

mock.module("@/utils/totp", () => ({
	verifyTotpCode: mockVerifyTotpCode,
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	JWT_SECRET: "test-jwt-secret",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockGenerateAccessToken.mockClear();
	mockSetAccessTokenInCookie.mockClear();
	mockSetRefreshTokenInCookie.mockClear();
	mockVerifyTotpCode.mockClear();
	mockVerifyTotpCode.mockReturnValue(true);
});

describe("POST /api/v1/login/mfa/totp - Error cases", () => {
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

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "invalid-token",
				code: "123456",
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
								mfaTotpLoginSessionTokenHash: "hash",
								rememberMe: false,
								expireAt: pastDate,
							}),
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "123456",
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
									mfaTotpLoginSessionTokenHash: "hash",
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

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "123456",
			},
		});

		expect(response.status).toBe(404);
	});

	it("should return 401 when user has no TOTP secret", async () => {
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
									mfaTotpLoginSessionTokenHash: "hash",
									rememberMe: false,
									expireAt: futureDate,
								});
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								mfaTotpSecret: null,
							});
						},
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "123456",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 401 when TOTP code is invalid", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		mockVerifyTotpCode.mockReturnValue(false);

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
									mfaTotpLoginSessionTokenHash: "hash",
									rememberMe: false,
									expireAt: futureDate,
								});
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								mfaTotpSecret: "JBSWY3DPEHPK3PXP",
							});
						},
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "000000",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 400 when code is not 6 digits", async () => {
		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "12345",
			},
		});

		expect(response.status).toBe(400);
	});
});

describe("POST /api/v1/login/mfa/totp - Success cases", () => {
	it("should login successfully without rememberMe", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		let deletedSession = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							callCount++;
							if (callCount === 1) {
								return Promise.resolve({
									userId: "user-id",
									mfaTotpLoginSessionTokenHash: "hash",
									rememberMe: false,
									expireAt: futureDate,
								});
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								mfaTotpSecret: "JBSWY3DPEHPK3PXP",
							});
						},
					}),
				}),
			}),
			delete: () => ({
				where: () => {
					deletedSession = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "123456",
			},
		});

		expect(response.status).toBe(200);
		expect(deletedSession).toBe(true);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).not.toHaveBeenCalled();
	});

	it("should login successfully with rememberMe", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		let insertedLoginSession = false;
		let deletedSession = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							callCount++;
							if (callCount === 1) {
								return Promise.resolve({
									userId: "user-id",
									mfaTotpLoginSessionTokenHash: "hash",
									rememberMe: true,
									expireAt: futureDate,
								});
							}
							return Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								mfaTotpSecret: "JBSWY3DPEHPK3PXP",
							});
						},
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: (_data: unknown) => {
					insertedLoginSession = true;
					return Promise.resolve();
				},
			}),
			delete: () => ({
				where: () => {
					deletedSession = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.mfa.totp.$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				code: "123456",
			},
		});

		expect(response.status).toBe(200);
		expect(insertedLoginSession).toBe(true);
		expect(deletedSession).toBe(true);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).toHaveBeenCalledTimes(1);
	});
});
