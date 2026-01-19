import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

const mockGetDBClient = mock(() => ({}));

const mockHashToken = mock((token: string) => `hashed-${token}`);

const mockHashPassword = mock(
	(_password: string, _salt: string) => "hashed-password",
);

const mockGenerateSalt = mock(() => "generated-salt");

mock.module("@/db/client", () => ({
	getDBClient: mockGetDBClient,
}));

mock.module("@/utils/crypto/server", () => ({
	hashToken: mockHashToken,
	hashPassword: mockHashPassword,
	generateSalt: mockGenerateSalt,
	generateSecureToken: mock(() => "mock-secure-token"),
	generateUuidv7: mock(() => "mock-uuid-v7"),
	generateOtpCode: mock(() => "123456"),
}));

const { apiRoutes } = await import("@/utils/api/client");

const api = testClient(apiRoutes, {
	DB: {} as unknown,
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockHashToken.mockClear();
	mockHashPassword.mockClear();
	mockGenerateSalt.mockClear();
});

describe("POST /api/v1/password-reset - Error cases", () => {
	it("should return 400 when passwordResetToken is empty", async () => {
		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(400);
	});

	it("should return 400 when newPassword is too short", async () => {
		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "valid-token",
				newPassword: "short",
			},
		});

		expect(response.status).toBe(400);
	});

	it("should return 401 when session does not exist", async () => {
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					leftJoin: () => ({
						where: () => ({
							get: () => Promise.resolve(undefined),
						}),
					}),
				}),
			}),
		});

		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "nonexistent-token",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(401);
		expect(mockHashToken).toHaveBeenCalledTimes(1);
		expect(mockHashToken).toHaveBeenCalledWith("nonexistent-token");
	});

	it("should return 401 when userId is null", async () => {
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					leftJoin: () => ({
						where: () => ({
							get: () =>
								Promise.resolve({
									userId: null,
									email: null,
									expireAt: new Date(Date.now() + 3600000),
								}),
						}),
					}),
				}),
			}),
		});

		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "valid-token",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return 410 when session is expired", async () => {
		const expiredDate = new Date(Date.now() - 3600000);

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					leftJoin: () => ({
						where: () => ({
							get: () =>
								Promise.resolve({
									userId: "user-id",
									email: "test@example.com",
									expireAt: expiredDate,
								}),
						}),
					}),
				}),
			}),
		});

		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "expired-token",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(410);
	});
});

describe("POST /api/v1/password-reset - Success cases", () => {
	it("should successfully reset password and clean up sessions", async () => {
		const futureDate = new Date(Date.now() + 3600000);

		let passwordUpdated = false;
		let deleteCallCount = 0;

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					leftJoin: () => ({
						where: () => ({
							get: () =>
								Promise.resolve({
									userId: "user-id",
									email: "test@example.com",
									expireAt: futureDate,
								}),
						}),
					}),
				}),
			}),
			update: () => ({
				set: () => ({
					where: () => {
						passwordUpdated = true;
						return Promise.resolve();
					},
				}),
			}),
			delete: () => ({
				where: () => {
					deleteCallCount++;
					return Promise.resolve();
				},
			}),
		});

		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "valid-token",
				newPassword: "newpassword123",
			},
		});

		expect(response.status).toBe(200);
		expect(mockHashToken).toHaveBeenCalledTimes(1);
		expect(mockHashToken).toHaveBeenCalledWith("valid-token");
		expect(mockGenerateSalt).toHaveBeenCalledTimes(1);
		expect(mockHashPassword).toHaveBeenCalledTimes(1);
		expect(mockHashPassword).toHaveBeenCalledWith(
			"newpassword123",
			"generated-salt",
		);
		expect(passwordUpdated).toBe(true);
		expect(deleteCallCount).toBe(3); // password_reset_sessions, password_reset_rate_limits, login_sessions
	});

	it("should update user with correct salt and passwordHash", async () => {
		const futureDate = new Date(Date.now() + 3600000);

		let updateParams: { salt?: string; passwordHash?: string } = {};

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					leftJoin: () => ({
						where: () => ({
							get: () =>
								Promise.resolve({
									userId: "user-id",
									email: "test@example.com",
									expireAt: futureDate,
								}),
						}),
					}),
				}),
			}),
			update: () => ({
				set: (params: { salt?: string; passwordHash?: string }) => {
					updateParams = params;
					return {
						where: () => Promise.resolve(),
					};
				},
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
		});

		const response = await api.v1["password-reset"].$post({
			json: {
				passwordResetToken: "valid-token",
				newPassword: "mynewpassword",
			},
		});

		expect(response.status).toBe(200);
		expect(updateParams).toBeDefined();

		if (updateParams) {
			expect(updateParams.salt).toBe("generated-salt");
			expect(updateParams.passwordHash).toBe("hashed-password");
		}
	});
});
