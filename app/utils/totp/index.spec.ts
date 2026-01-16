import { describe, expect, it } from "bun:test";
import { base32Decode, generateTotpCode, verifyTotpCode } from ".";

describe("base32Decode", () => {
	it("should decode valid base32 string", () => {
		const encoded = "JBSWY3DPEBLW64TMMQ";
		const decoded = base32Decode(encoded);

		expect(decoded.toString()).toBe("Hello World");
	});

	it("should decode base32 with padding", () => {
		const encoded = "JBSWY3DPEBLW64TMMQ======";
		const decoded = base32Decode(encoded);

		expect(decoded.toString()).toBe("Hello World");
	});

	it("should handle lowercase input", () => {
		const encoded = "jbswy3dpeblw64tmmq";
		const decoded = base32Decode(encoded);

		expect(decoded.toString()).toBe("Hello World");
	});

	it("should decode RFC 6238 test secret", () => {
		const encoded = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
		const decoded = base32Decode(encoded);

		expect(decoded.toString()).toBe("12345678901234567890");
	});

	it("should throw error for invalid base32 characters", () => {
		const encoded = "INVALID1!@#";

		expect(() => base32Decode(encoded)).toThrow("Invalid base32 character");
	});

	it("should handle empty string", () => {
		const decoded = base32Decode("");

		expect(decoded.length).toBe(0);
	});

	it("should decode mixed case with padding", () => {
		const encoded = "JbSwY3DpEbLw64TmMq======";
		const decoded = base32Decode(encoded);

		expect(decoded.toString()).toBe("Hello World");
	});
});

describe("generateTotpCode", () => {
	it("should generate 6-digit code", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const code = generateTotpCode(secret);

		expect(code.length).toBe(6);
		expect(code).toMatch(/^\d{6}$/);
	});

	it("should generate consistent code for same time step", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const timeStep = 1000;

		const code1 = generateTotpCode(secret, timeStep);
		const code2 = generateTotpCode(secret, timeStep);

		expect(code1).toBe(code2);
	});

	it("should generate different codes for different time steps", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";

		const code1 = generateTotpCode(secret, 1000);
		const code2 = generateTotpCode(secret, 1001);

		expect(code1).not.toBe(code2);
	});

	it("should generate RFC 6238 test vector (T=59)", () => {
		const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
		const timeStep = 1; // 59 seconds / 30 = 1

		const code = generateTotpCode(secret, timeStep);

		expect(code).toBe("287082");
	});

	it("should generate RFC 6238 test vector (T=1111111109)", () => {
		const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
		const timeStep = 37037036; // 1111111109 / 30 = 37037036.966...

		const code = generateTotpCode(secret, timeStep);

		expect(code).toBe("081804");
	});

	it("should pad code with leading zeros", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const codes = [];

		// Generate multiple codes to check padding
		for (let i = 0; i < 100; i++) {
			const code = generateTotpCode(secret, i);
			codes.push(code);
			expect(code.length).toBe(6);
		}
	});
});

describe("verifyTotpCode", () => {
	it("should verify valid TOTP code", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const timeStep = 1000;
		const code = generateTotpCode(secret, timeStep);

		// Mock current time to match the time step
		const originalDateNow = Date.now;
		Date.now = () => timeStep * 30 * 1000;

		const isValid = verifyTotpCode(code, secret);

		Date.now = originalDateNow;

		expect(isValid).toBe(true);
	});

	it("should reject invalid TOTP code", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";

		const isValid = verifyTotpCode("000000", secret);

		expect(isValid).toBe(false);
	});

	it("should verify code within time window (previous step)", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const timeStep = 1000;
		const code = generateTotpCode(secret, timeStep - 1);

		const originalDateNow = Date.now;
		Date.now = () => timeStep * 30 * 1000;

		const isValid = verifyTotpCode(code, secret, 1);

		Date.now = originalDateNow;

		expect(isValid).toBe(true);
	});

	it("should verify code within time window (next step)", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const timeStep = 1000;
		const code = generateTotpCode(secret, timeStep + 1);

		const originalDateNow = Date.now;
		Date.now = () => timeStep * 30 * 1000;

		const isValid = verifyTotpCode(code, secret, 1);

		Date.now = originalDateNow;

		expect(isValid).toBe(true);
	});

	it("should reject code outside time window", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const timeStep = 1000;
		const code = generateTotpCode(secret, timeStep - 2);

		const originalDateNow = Date.now;
		Date.now = () => timeStep * 30 * 1000;

		const isValid = verifyTotpCode(code, secret, 1);

		Date.now = originalDateNow;

		expect(isValid).toBe(false);
	});

	it("should verify with custom time window", () => {
		const secret = "JBSWY3DPEBLW64TMMQ";
		const timeStep = 1000;
		const code = generateTotpCode(secret, timeStep - 3);

		const originalDateNow = Date.now;
		Date.now = () => timeStep * 30 * 1000;

		const isValidNarrow = verifyTotpCode(code, secret, 1);
		const isValidWide = verifyTotpCode(code, secret, 3);

		Date.now = originalDateNow;

		expect(isValidNarrow).toBe(false);
		expect(isValidWide).toBe(true);
	});

	it("should verify RFC 6238 test vector", () => {
		const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
		const code = "287082";

		const originalDateNow = Date.now;
		Date.now = () => 59 * 1000; // T=59

		const isValid = verifyTotpCode(code, secret);

		Date.now = originalDateNow;

		expect(isValid).toBe(true);
	});
});
