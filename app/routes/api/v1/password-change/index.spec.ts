import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

const mockGetDBClient = mock(() => ({}));

const mockHashPassword = mock(
	(_password: string, _salt: string) => "hashed-password",
);

const mockGenerateSalt = mock(() => "generated-salt");

const mockGetUserIdFromAccessTokenCookie = mock<
	() => Promise<string | undefined>
>(() => Promise.resolve("user-id"));

const mockGetRefreshTokenFromCookie = mock<() => Promise<string | undefined>>(
	() => Promise.resolve("mock-refresh-token"),
);

const mockValidateLoginRateLimit = mock(() =>
	Promise.resolve({ isLocked: false, currentFailedAttempts: 0 }),
);

const mockIncrementLoginAttempts = mock(() =>
	Promise.resolve({ locked: false }),
);

const mockHashToken = mock((token: string) => `hashed-${token}`);

mock.module("@/db/client", () => ({
	getDBClient: mockGetDBClient,
}));

mock.module("@/utils/crypto/server", () => ({
	hashPassword: mockHashPassword,
	generateSalt: mockGenerateSalt,
	hashToken: mockHashToken,
}));

mock.module("@/utils/auth", () => ({
	getUserIdFromAccessTokenCookie: mockGetUserIdFromAccessTokenCookie,
	getRefreshTokenFromCookie: mockGetRefreshTokenFromCookie,
	generateAccessToken: mock(() => Promise.resolve("mock-access-token")),
	generateRefreshToken: mock(() => ({
		refreshToken: "mock-new-refresh-token",
		refreshTokenHash: "mock-new-refresh-token-hash",
		expireAt: new Date(),
	})),
	setAccessTokenInCookie: mock(() => Promise.resolve()),
	setRefreshTokenInCookie: mock(() => Promise.resolve()),
	deleteAccessTokenCookie: mock(() => {}),
	deleteRefreshTokenCookie: mock(() => {}),
	validateLoginRateLimit: mockValidateLoginRateLimit,
	incrementLoginAttempts: mockIncrementLoginAttempts,
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	ACCESS_TOKEN_SECRET_KEY: "test-access-token-secret",
	REFRESH_TOKEN_SECRET_KEY: "test-refresh-token-secret",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockHashPassword.mockClear();
	mockGenerateSalt.mockClear();
	mockGetUserIdFromAccessTokenCookie.mockClear();
	mockGetRefreshTokenFromCookie.mockClear();
	mockValidateLoginRateLimit.mockClear();
	mockIncrementLoginAttempts.mockClear();
	mockHashToken.mockClear();

	// Reset default behavior
	mockGetUserIdFromAccessTokenCookie.mockResolvedValue("user-id");
	mockGetRefreshTokenFromCookie.mockResolvedValue("mock-refresh-token");
	mockValidateLoginRateLimit.mockResolvedValue({
		isLocked: false,
		currentFailedAttempts: 0,
	});
	mockIncrementLoginAttempts.mockResolvedValue({ locked: false });
	mockHashToken.mockImplementation((token: string) => `hashed-${token}`);
});

describe("POST /api/v1/password-change - Error cases", () => {
	it("should return 400 when currentPassword is too short", async () => {
		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "short",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(400);
	});

	it("should return 400 when newPassword is too short", async () => {
		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "currentpassword",
				newPassword: "short",
			},
		});

		expect(response.status).toBe(400);
	});

	it("should return 401 when user is not authenticated", async () => {
		mockGetUserIdFromAccessTokenCookie.mockResolvedValue(undefined);
		mockGetRefreshTokenFromCookie.mockResolvedValue(undefined);

		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "currentpassword",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(401);
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

		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "currentpassword",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 401 when current password is incorrect", async () => {
		mockHashPassword.mockImplementation((password: string, salt: string) => {
			if (password === "wrongpassword") {
				return "wrong-hashed-password";
			}
			return `hashed-${password}-${salt}`;
		});

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "user-id",
								email: "test@example.com",
								salt: "user-salt",
								passwordHash: "correct-password-hash",
							}),
					}),
				}),
			}),
		});

		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "wrongpassword",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(401);
		expect(mockHashPassword).toHaveBeenCalledWith("wrongpassword", "user-salt");
		expect(mockIncrementLoginAttempts).toHaveBeenCalledTimes(1);
		expect(mockIncrementLoginAttempts).toHaveBeenCalledWith(
			expect.anything(),
			"test@example.com",
			0,
		);
	});
});

describe("POST /api/v1/password-change - Success cases", () => {
	it("should successfully change password and delete login sessions", async () => {
		mockHashPassword.mockImplementation((password: string, salt: string) => {
			if (password === "currentpassword" && salt === "user-salt") {
				return "correct-password-hash";
			}
			return `hashed-${password}-${salt}`;
		});

		let passwordUpdated = false;
		let sessionsDeleted = false;
		let rateLimitInserted = false;
		let sessionUpdated = false;
		let selectCallCount = 0;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							selectCallCount++;
							if (selectCallCount === 1) {
								// First call: get user
								return Promise.resolve({
									id: "user-id",
									email: "test@example.com",
									salt: "user-salt",
									passwordHash: "correct-password-hash",
								});
							}
							// Second call: get current session
							return Promise.resolve({
								id: "session-id",
								userId: "user-id",
								refreshTokenHash: "hashed-mock-refresh-token",
							});
						},
					}),
				}),
			}),
			update: () => ({
				set: () => ({
					where: () => {
						if (!passwordUpdated) {
							passwordUpdated = true;
						} else {
							sessionUpdated = true;
						}
						return Promise.resolve();
					},
				}),
			}),
			delete: () => ({
				where: () => {
					sessionsDeleted = true;
					return Promise.resolve();
				},
			}),
			insert: () => ({
				values: () => {
					rateLimitInserted = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "currentpassword",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(200);
		expect(mockHashPassword).toHaveBeenCalledWith(
			"currentpassword",
			"user-salt",
		);
		expect(mockGenerateSalt).toHaveBeenCalledTimes(1);
		expect(mockHashPassword).toHaveBeenCalledWith(
			"newpassword123",
			"generated-salt",
		);
		expect(passwordUpdated).toBe(true);
		expect(sessionsDeleted).toBe(true);
		expect(rateLimitInserted).toBe(true);
		expect(sessionUpdated).toBe(true);
	});

	it("should update user with correct salt and passwordHash", async () => {
		mockHashPassword.mockImplementation((password: string, salt: string) => {
			if (password === "currentpassword" && salt === "user-salt") {
				return "correct-password-hash";
			}
			return `hashed-${password}-${salt}`;
		});

		let updateParams: { salt?: string; passwordHash?: string } = {};
		let selectCallCount = 0;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							selectCallCount++;
							if (selectCallCount === 1) {
								return Promise.resolve({
									id: "user-id",
									email: "test@example.com",
									salt: "user-salt",
									passwordHash: "correct-password-hash",
								});
							}
							return Promise.resolve({
								id: "session-id",
								userId: "user-id",
								refreshTokenHash: "hashed-mock-refresh-token",
							});
						},
					}),
				}),
			}),
			update: () => ({
				set: (params?: { salt?: string; passwordHash?: string }) => {
					if (params?.salt && params?.passwordHash) {
						updateParams = params;
					}
					return {
						where: () => Promise.resolve(),
					};
				},
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
			insert: () => ({
				values: () => Promise.resolve(),
			}),
		});

		const response = await api.v1["password-change"].$post({
			json: {
				currentPassword: "currentpassword",
				newPassword: "mynewpassword",
			},
		});

		expect(response.status).toBe(200);
		expect(updateParams).toBeDefined();

		if (updateParams) {
			expect(updateParams.salt).toBe("generated-salt");
			expect(updateParams.passwordHash).toBe(
				"hashed-mynewpassword-generated-salt",
			);
		}
	});
});
