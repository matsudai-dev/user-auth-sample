import { describe, expect, it } from "bun:test";
import { setTimeout } from "node:timers/promises";
import {
	generateOtpCode,
	generateSalt,
	generateSecureToken,
	generateUuidv7,
	hashPassword,
	hashToken,
} from "./server";

describe("generateUuidv7", () => {
	it("should generate a valid UUIDv7 format", () => {
		const uuid = generateUuidv7();
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

		expect(uuid).toMatch(uuidRegex);
	});

	it("should have version 7 identifier", () => {
		const uuid = generateUuidv7();
		const version = uuid[14];

		expect(version).toBe("7");
	});

	it("should have correct variant bits", () => {
		const uuid = generateUuidv7();
		const variant = uuid[19];

		if (variant === undefined) {
			throw new Error("UUID variant character is undefined");
		}

		expect(["8", "9", "a", "b"]).toContain(variant.toLowerCase());
	});

	it("should generate unique UUIDs", () => {
		const uuid1 = generateUuidv7();
		const uuid2 = generateUuidv7();

		expect(uuid1).not.toBe(uuid2);
	});

	it("should generate time-ordered UUIDs", async () => {
		const uuid1 = generateUuidv7();

		await setTimeout(1);

		const uuid2 = generateUuidv7();

		expect(uuid1 < uuid2).toBe(true);
	});
});

describe("generateSecureToken", () => {
	it("should generate a token with default length (32 bytes)", () => {
		const token = generateSecureToken();
		const decoded = Buffer.from(token, "base64url");

		expect(decoded.length).toBe(32);
	});

	it("should generate a token with custom byte length", () => {
		const bytes = 16;
		const token = generateSecureToken(bytes);
		const decoded = Buffer.from(token, "base64url");

		expect(decoded.length).toBe(bytes);
	});

	it("should generate URL-safe tokens (base64url)", () => {
		const token = generateSecureToken();
		const urlUnsafeChars = /[+/=]/;

		expect(token).not.toMatch(urlUnsafeChars);
	});

	it("should generate unique tokens", () => {
		const token1 = generateSecureToken();
		const token2 = generateSecureToken();

		expect(token1).not.toBe(token2);
	});

	it("should only contain valid base64url characters", () => {
		const token = generateSecureToken();
		const base64urlRegex = /^[A-Za-z0-9_-]+$/;

		expect(token).toMatch(base64urlRegex);
	});

	it("should generate tokens of different lengths", () => {
		const token8 = generateSecureToken(8);
		const token16 = generateSecureToken(16);
		const token32 = generateSecureToken(32);

		expect(token8.length).toBeLessThan(token16.length);
		expect(token16.length).toBeLessThan(token32.length);
	});
});

describe("hashToken", () => {
	it("should produce consistent hashes for the same input", () => {
		const token = "test-token-12345";
		const hash1 = hashToken(token);
		const hash2 = hashToken(token);

		expect(hash1).toBe(hash2);
	});

	it("should produce different hashes for different inputs", () => {
		const token1 = "test-token-1";
		const token2 = "test-token-2";
		const hash1 = hashToken(token1);
		const hash2 = hashToken(token2);

		expect(hash1).not.toBe(hash2);
	});

	it("should produce SHA-256 hash (64 hex characters)", () => {
		const token = "test-token-12345";
		const hash = hashToken(token);

		expect(hash.length).toBe(64);
	});

	it("should only contain hexadecimal characters", () => {
		const token = "test-token-12345";
		const hash = hashToken(token);

		expect(hash).toMatch(/^[0-9a-f]+$/);
	});

	it("should handle empty string", () => {
		const hash = hashToken("");

		expect(hash.length).toBe(64);
	});
});

describe("generateSalt", () => {
	it("should generate a salt with default length (32 bytes)", () => {
		const salt = generateSalt();
		const decoded = Buffer.from(salt, "hex");

		expect(decoded.length).toBe(32);
	});

	it("should generate a salt with custom byte length", () => {
		const bytes = 16;
		const salt = generateSalt(bytes);
		const decoded = Buffer.from(salt, "hex");

		expect(decoded.length).toBe(bytes);
	});

	it("should only contain hexadecimal characters", () => {
		const salt = generateSalt();

		expect(salt).toMatch(/^[0-9a-f]+$/);
	});

	it("should generate unique salts", () => {
		const salt1 = generateSalt();
		const salt2 = generateSalt();

		expect(salt1).not.toBe(salt2);
	});

	it("should generate salts of expected hex string length", () => {
		const bytes = 16;
		const salt = generateSalt(bytes);

		// 16 bytes = 32 hex characters
		expect(salt.length).toBe(bytes * 2);
	});
});

describe("hashPassword", () => {
	it("should produce consistent hashes for the same password and salt", () => {
		const password = "myPassword123";
		const salt = generateSalt();
		const hash1 = hashPassword(password, salt);
		const hash2 = hashPassword(password, salt);

		expect(hash1).toBe(hash2);
	});

	it("should produce different hashes for different passwords", () => {
		const salt = generateSalt();
		const hash1 = hashPassword("password1", salt);
		const hash2 = hashPassword("password2", salt);

		expect(hash1).not.toBe(hash2);
	});

	it("should produce different hashes for different salts", () => {
		const password = "myPassword123";
		const salt1 = generateSalt();
		const salt2 = generateSalt();
		const hash1 = hashPassword(password, salt1);
		const hash2 = hashPassword(password, salt2);

		expect(hash1).not.toBe(hash2);
	});

	it("should produce SHA-256 hash (64 hex characters)", () => {
		const password = "myPassword123";
		const salt = generateSalt();
		const hash = hashPassword(password, salt);

		expect(hash.length).toBe(64);
	});

	it("should only contain hexadecimal characters", () => {
		const password = "myPassword123";
		const salt = generateSalt();
		const hash = hashPassword(password, salt);

		expect(hash).toMatch(/^[0-9a-f]+$/);
	});

	it("should handle empty password", () => {
		const salt = generateSalt();
		const hash = hashPassword("", salt);

		expect(hash.length).toBe(64);
	});

	it("should handle special characters in password", () => {
		const password = "p@ssw0rd!#$%^&*()";
		const salt = generateSalt();
		const hash = hashPassword(password, salt);

		expect(hash.length).toBe(64);
		expect(hash).toMatch(/^[0-9a-f]+$/);
	});
});

describe("generateOtpCode", () => {
	it("should generate a 6-digit code", () => {
		const code = generateOtpCode();

		expect(code.length).toBe(6);
	});

	it("should only contain numeric characters", () => {
		const code = generateOtpCode();

		expect(code).toMatch(/^\d{6}$/);
	});

	it("should generate codes within valid range", () => {
		const codes = Array.from({ length: 1000 }, () => generateOtpCode());

		for (const code of codes) {
			const numericCode = Number.parseInt(code, 10);
			expect(numericCode).toBeGreaterThanOrEqual(0);
			expect(numericCode).toBeLessThanOrEqual(999999);
		}
	});
});
