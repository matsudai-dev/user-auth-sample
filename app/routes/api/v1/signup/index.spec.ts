import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";

interface MockInsertData {
	id: string;
	email: string;
	signupSessionTokenHash: string;
	expireAt: Date;
}

interface MockEmailData {
	to: string;
	subject: string;
	html: string;
}

const mockGetDBClient = mock(() => ({}));
const mockGetResendClient = mock(() => ({
	emails: {
		send: mock((_v: MockEmailData) => Promise.resolve()),
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
	RESEND_API_KEY: "test-api-key",
	RESEND_EMAIL_FROM: "test@example.com",
}).api;

beforeEach(() => {
	mockGetDBClient.mockClear();
	mockGetResendClient.mockClear();
});

describe("POST /api/v1/signup - Error cases", () => {
	it("should return 409 when user already exists", async () => {
		const testEmail = "existing@example.com";

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => Promise.resolve({ email: testEmail }),
					}),
				}),
			}),
		});

		const response = await api.v1.signup.$post({ json: { email: testEmail } });

		expect(response.status).toBe(409);
	});

	it("should return 409 when deleted user is within reregistration period", async () => {
		const testEmail = "deleted@example.com";
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							callCount++;
							// First call: no existing user
							if (callCount === 1) {
								return Promise.resolve(undefined);
							}
							// Second call: deleted user within reregistration period
							return Promise.resolve({
								reregistrationAllowedAt: futureDate,
							});
						},
					}),
				}),
			}),
		});

		const response = await api.v1.signup.$post({ json: { email: testEmail } });

		expect(response.status).toBe(409);
	});

	it("should return 429 when active signup session already exists", async () => {
		const testEmail = "pending@example.com";
		const futureDate = new Date(Date.now() + 86400000); // +1 day

		let callCount = 0;
		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							callCount++;
							// First call: no existing user
							if (callCount === 1) {
								return Promise.resolve(undefined);
							}
							// Second call: no deleted user
							if (callCount === 2) {
								return Promise.resolve(undefined);
							}
							// Third call: existing active session
							return Promise.resolve({
								email: testEmail,
								expireAt: futureDate,
							});
						},
					}),
				}),
			}),
		});

		const response = await api.v1.signup.$post({ json: { email: testEmail } });

		expect(response.status).toBe(429);
	});
});

describe("POST /api/v1/signup - Success case", () => {
	it("should create signup session and send email successfully", async () => {
		const testEmail = "newuser@example.com";

		const mockInsert = mock((_v: MockInsertData) => Promise.resolve());
		const mockEmailSend = mock((_v: MockEmailData) => Promise.resolve());

		mockGetDBClient.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						get: () => {
							return Promise.resolve(undefined);
						},
					}),
				}),
			}),
			insert: () => ({
				values: mockInsert,
			}),
		});

		mockGetResendClient.mockReturnValue({
			emails: {
				send: mockEmailSend,
			},
		});

		const response = await api.v1.signup.$post({ json: { email: testEmail } });

		expect(response.status).toBe(200);

		expect(mockInsert).toHaveBeenCalledTimes(1);

		const insertCall = mockInsert.mock.calls[0];

		if (!insertCall) {
			throw new Error("Insert was not called");
		}

		const insertedData = insertCall[0];

		expect(insertedData.id).toBeDefined();
		expect(insertedData.email).toBe(testEmail);
		expect(insertedData.signupSessionTokenHash).toBeDefined();
		expect(insertedData.expireAt).toBeInstanceOf(Date);

		expect(mockEmailSend).toHaveBeenCalledTimes(1);

		const emailCall = mockEmailSend.mock.calls[0];

		if (!emailCall) {
			throw new Error("Email send was not called");
		}

		const emailData = emailCall[0];

		expect(emailData.to).toBe(testEmail);
		expect(typeof emailData.subject).toBe("string");
		expect(typeof emailData.html).toBe("string");
	});
});
