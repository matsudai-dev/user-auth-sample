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

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	ACCESS_TOKEN_SECRET_KEY: "test-access-token-secret",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockGenerateAccessToken.mockClear();
	mockSetAccessTokenInCookie.mockClear();
	mockSetRefreshTokenInCookie.mockClear();
});

describe("POST /api/v1/login/mfa/totp/backup-code - Error cases", () => {
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

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "invalid-token",
				backupCode: "backup-code",
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

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "backup-code",
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

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "backup-code",
			},
		});

		expect(response.status).toBe(404);
	});

	it("should return 401 when backup code does not exist", async () => {
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
							if (callCount === 2) {
								return Promise.resolve({
									id: "user-id",
									email: "test@example.com",
								});
							}
							return Promise.resolve(undefined);
						},
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "invalid-backup-code",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 401 when backup code is already used", async () => {
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
							if (callCount === 2) {
								return Promise.resolve({
									id: "user-id",
									email: "test@example.com",
								});
							}
							return Promise.resolve({
								id: "backup-code-id",
								userId: "user-id",
								backupCodeHash: "hash",
								usedAt: new Date(),
							});
						},
					}),
				}),
			}),
		});

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "used-backup-code",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 400 when code is empty", async () => {
		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "",
			},
		});

		expect(response.status).toBe(400);
	});

	it("should return 400 when mfaTotpLoginSessionToken is empty", async () => {
		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "",
				backupCode: "backup-code",
			},
		});

		expect(response.status).toBe(400);
	});
});

describe("POST /api/v1/login/mfa/totp/backup-code - Success cases", () => {
	it("should login successfully without rememberMe", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		let updatedBackupCode = false;
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
							if (callCount === 2) {
								return Promise.resolve({
									id: "user-id",
									email: "test@example.com",
								});
							}
							return Promise.resolve({
								id: "backup-code-id",
								userId: "user-id",
								backupCodeHash: "hash",
								usedAt: null,
							});
						},
					}),
				}),
			}),
			update: () => ({
				set: () => ({
					where: () => {
						updatedBackupCode = true;
						return Promise.resolve();
					},
				}),
			}),
			delete: () => ({
				where: () => {
					deletedSession = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "backup-code",
			},
		});

		expect(response.status).toBe(200);
		expect(updatedBackupCode).toBe(true);
		expect(deletedSession).toBe(true);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).not.toHaveBeenCalled();
	});

	it("should login successfully with rememberMe", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		let updatedBackupCode = false;
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
							if (callCount === 2) {
								return Promise.resolve({
									id: "user-id",
									email: "test@example.com",
								});
							}
							return Promise.resolve({
								id: "backup-code-id",
								userId: "user-id",
								backupCodeHash: "hash",
								usedAt: null,
							});
						},
					}),
				}),
			}),
			update: () => ({
				set: () => ({
					where: () => {
						updatedBackupCode = true;
						return Promise.resolve();
					},
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

		const response = await api.v1.login.mfa.totp["backup-code"].$post({
			json: {
				mfaTotpLoginSessionToken: "valid-token",
				backupCode: "backup-code",
			},
		});

		expect(response.status).toBe(200);
		expect(updatedBackupCode).toBe(true);
		expect(insertedLoginSession).toBe(true);
		expect(deletedSession).toBe(true);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).toHaveBeenCalledTimes(1);
	});
});
