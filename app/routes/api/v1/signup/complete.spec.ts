import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

interface MockUserData {
	id: string;
	email: string;
	salt: string;
	passwordHash: string;
}

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
	getUserIdFromAccessTokenCookie: mock(() => Promise.resolve()),
	getRefreshTokenFromCookie: mock(() => Promise.resolve()),
	deleteAccessTokenCookie: mock(() => {}),
	deleteRefreshTokenCookie: mock(() => {}),
	validateLoginRateLimit: mock(() => Promise.resolve()),
	incrementLoginAttempts: mock(() => Promise.resolve()),
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
});

describe("POST /api/v1/signup/complete - Error cases", () => {
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

		const response = await api.v1.signup.complete.$post({
			json: {
				signupSessionToken: "invalid-token",
				password: "password123",
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
								id: "session-id",
								email: "test@example.com",
								expireAt: pastDate,
							}),
					}),
				}),
			}),
		});

		const response = await api.v1.signup.complete.$post({
			json: {
				signupSessionToken: "valid-token",
				password: "password123",
			},
		});

		expect(response.status).toBe(410);
	});

	it("should return 400 when password is too short", async () => {
		const response = await api.v1.signup.complete.$post({
			json: {
				signupSessionToken: "valid-token",
				password: "short",
			},
		});

		expect(response.status).toBe(400);
	});
});

describe("POST /api/v1/signup/complete - Success cases", () => {
	it("should create user and return 200 without refresh token when rememberMe is false", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day
		let insertedUser: MockUserData | undefined;
		let deletedSessionId: string | undefined;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "session-id",
								email: "test@example.com",
								expireAt: futureDate,
							}),
					}),
				}),
			}),
			insert: (_table: unknown) => ({
				values: (data: MockUserData) => {
					// Only capture user insertion, not login session
					if ("passwordHash" in data) {
						insertedUser = data;
					}
					return Promise.resolve();
				},
			}),
			delete: () => ({
				where: () => {
					deletedSessionId = "session-id";
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.signup.complete.$post({
			json: {
				signupSessionToken: "valid-token",
				password: "password123",
			},
		});

		expect(response.status).toBe(200);
		expect(insertedUser).toBeDefined();
		if (insertedUser === undefined) {
			throw new Error("User was not inserted");
		}
		expect(insertedUser.email).toBe("test@example.com");
		expect(insertedUser.passwordHash).toBeDefined();
		expect(insertedUser.salt).toBeDefined();
		expect(deletedSessionId).toBe("session-id");
		expect(mockGenerateAccessToken).toHaveBeenCalledTimes(1);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledWith(
			expect.anything(),
			"mock-access-token",
		);
		expect(mockSetRefreshTokenInCookie).not.toHaveBeenCalled();
	});

	it("should create user with refresh token when rememberMe is true", async () => {
		const futureDate = new Date(Date.now() + 86400000); // +1 day
		let insertedUser: MockUserData | undefined;
		let _insertedLoginSession = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "session-id",
								email: "test@example.com",
								expireAt: futureDate,
							}),
					}),
				}),
			}),
			insert: (_table: { id?: unknown }) => ({
				values: (data: MockUserData | { userId: string }) => {
					if ("passwordHash" in data) {
						insertedUser = data;
					} else if ("userId" in data) {
						_insertedLoginSession = true;
					}
					return Promise.resolve();
				},
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
		});

		const response = await api.v1.signup.complete.$post({
			json: {
				signupSessionToken: "valid-token",
				password: "password123",
				rememberMe: true,
			},
		});

		expect(response.status).toBe(200);
		expect(insertedUser).toBeDefined();
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetAccessTokenInCookie).toHaveBeenCalledWith(
			expect.anything(),
			"mock-access-token",
		);
		expect(mockSetRefreshTokenInCookie).toHaveBeenCalledTimes(1);
		expect(mockSetRefreshTokenInCookie).toHaveBeenCalledWith(
			expect.anything(),
			"mock-refresh-token",
		);
	});
});
