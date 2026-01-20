import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

const mockGetDBClient = mock(() => ({}));

const mockGetSignedCookie = mock(
	(_c: unknown, _secret: string, _name: string): Promise<string | undefined> =>
		Promise.resolve(undefined),
);

const mockDeleteAccessTokenCookie = mock((_c: unknown) => {});

const mockDeleteRefreshTokenCookie = mock((_c: unknown) => {});

const mockGetRefreshTokenFromCookie = mock(
	(_c: unknown, _secret: string, _name: string): Promise<string | undefined> =>
		Promise.resolve(undefined),
);

mock.module("@/db/client", () => ({
	getDBClient: mockGetDBClient,
}));

mock.module("hono/cookie", () => ({
	getSignedCookie: mockGetSignedCookie,
	setSignedCookie: () => Promise.resolve(),
}));

mock.module("@/utils/auth", () => ({
	generateAccessToken: mock(() => Promise.resolve("mock-access-token")),
	generateRefreshToken: () => ({
		refreshToken: "mock-refresh-token",
		refreshTokenHash: "mock-refresh-token-hash",
		expireAt: new Date(Date.now() + 86400000),
	}),
	setAccessTokenInCookie: mock(() => Promise.resolve()),
	setRefreshTokenInCookie: mock(() => Promise.resolve()),
	getUserIdFromAccessTokenCookie: mock(() => Promise.resolve()),
	getRefreshTokenFromCookie: mockGetRefreshTokenFromCookie,
	deleteAccessTokenCookie: mockDeleteAccessTokenCookie,
	deleteRefreshTokenCookie: mockDeleteRefreshTokenCookie,
	validateLoginRateLimit: mock(() => Promise.resolve()),
	incrementLoginAttempts: mock(() => Promise.resolve()),
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
	REFRESH_TOKEN_SECRET_KEY: "test-refresh-token-secret",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockGetSignedCookie.mockClear();
	mockGetRefreshTokenFromCookie.mockClear();
	mockDeleteAccessTokenCookie.mockClear();
	mockDeleteRefreshTokenCookie.mockClear();
});

describe("POST /api/v1/logout - Error cases", () => {
	it("should return 401 when refresh token does not exist in cookie", async () => {
		mockGetRefreshTokenFromCookie.mockResolvedValue(undefined);

		const response = await api.v1.logout.$post({
			json: {
				scope: "current",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 401 when session does not exist", async () => {
		mockGetRefreshTokenFromCookie.mockResolvedValue("valid-refresh-token");

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve(undefined),
					}),
				}),
			}),
		});

		const response = await api.v1.logout.$post({
			json: {
				scope: "current",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 400 when scope is invalid", async () => {
		const response = await api.v1.logout.$post({
			json: {
				scope: "invalid",
			} as never,
		});

		expect(response.status).toBe(400);
	});
});

describe("POST /api/v1/logout - Success cases", () => {
	it("should logout current session only when scope is current", async () => {
		mockGetRefreshTokenFromCookie.mockResolvedValue("valid-refresh-token");

		let deleteWasCalled = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "current-session-id",
								userId: "user-id",
								refreshTokenHash: "hash",
							}),
					}),
				}),
			}),
			delete: () => ({
				where: () => {
					deleteWasCalled = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.logout.$post({
			json: {
				scope: "current",
			},
		});

		expect(response.status).toBe(200);
		expect(deleteWasCalled).toBe(true);
		expect(mockDeleteAccessTokenCookie).toHaveBeenCalledTimes(1);
		expect(mockDeleteRefreshTokenCookie).toHaveBeenCalledTimes(1);
	});

	it("should logout other sessions when scope is others", async () => {
		mockGetRefreshTokenFromCookie.mockResolvedValue("valid-refresh-token");

		let deletedOthers = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "current-session-id",
								userId: "user-id",
								refreshTokenHash: "hash",
							}),
					}),
				}),
			}),
			delete: () => ({
				where: () => {
					deletedOthers = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.logout.$post({
			json: {
				scope: "others",
			},
		});

		expect(response.status).toBe(200);
		expect(deletedOthers).toBe(true);
		expect(mockDeleteAccessTokenCookie).toHaveBeenCalledTimes(1);
		expect(mockDeleteRefreshTokenCookie).toHaveBeenCalledTimes(1);
	});

	it("should logout all sessions when scope is all", async () => {
		mockGetRefreshTokenFromCookie.mockResolvedValue("valid-refresh-token");

		let deletedAll = false;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () =>
							Promise.resolve({
								id: "current-session-id",
								userId: "user-id",
								refreshTokenHash: "hash",
							}),
					}),
				}),
			}),
			delete: () => ({
				where: () => {
					deletedAll = true;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1.logout.$post({
			json: {
				scope: "all",
			},
		});

		expect(response.status).toBe(200);
		expect(deletedAll).toBe(true);
		expect(mockDeleteAccessTokenCookie).toHaveBeenCalledTimes(1);
		expect(mockDeleteRefreshTokenCookie).toHaveBeenCalledTimes(1);
	});
});
