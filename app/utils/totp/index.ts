import { createHmac } from "node:crypto";

/**
 * Decodes a base32-encoded string to a buffer.
 *
 * @param encoded - Base32-encoded string
 * @returns Decoded buffer
 */
export function base32Decode(encoded: string): Buffer {
	const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	const cleanedInput = encoded.toUpperCase().replace(/=+$/, "");

	let bits = 0;
	let value = 0;
	const output: number[] = [];

	for (const char of cleanedInput) {
		const index = base32Chars.indexOf(char);

		if (index === -1) {
			throw new Error(`Invalid base32 character: ${char}`);
		}

		value = (value << 5) | index;
		bits += 5;

		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	return Buffer.from(output);
}

/**
 * Generates a TOTP code for a given secret and time step.
 *
 * @param secret - The base32-encoded TOTP secret
 * @param timeStep - The time step (default: current time / 30)
 * @returns 6-digit TOTP code
 */
export function generateTotpCode(secret: string, timeStep?: number): string {
	const time = timeStep ?? Math.floor(Date.now() / 1000 / 30);
	const decodedSecret = base32Decode(secret);

	const buffer = Buffer.alloc(8);
	buffer.writeBigUInt64BE(BigInt(time));

	const hmac = createHmac("sha1", decodedSecret);
	hmac.update(buffer);
	const hash = hmac.digest();

	const offset = hash[hash.length - 1];

	if (offset === undefined) {
		throw new Error("Failed to generate TOTP code");
	}

	const truncatedHash =
		(((hash[offset & 0x0f] ?? 0) & 0x7f) << 24) |
		(((hash[(offset & 0x0f) + 1] ?? 0) & 0xff) << 16) |
		(((hash[(offset & 0x0f) + 2] ?? 0) & 0xff) << 8) |
		((hash[(offset & 0x0f) + 3] ?? 0) & 0xff);

	const code = truncatedHash % 1000000;

	return code.toString().padStart(6, "0");
}

/**
 * Verifies a TOTP code against a secret.
 *
 * @param code - The 6-digit TOTP code to verify
 * @param secret - The base32-encoded TOTP secret
 * @param window - Number of time steps to check before and after current time (default: 1)
 * @returns True if the code is valid, false otherwise
 *
 * @example
 * const secret = "JBSWY3DPEHPK3PXP";
 * const code = "123456";
 * const isValid = verifyTotpCode(code, secret);
 */
export function verifyTotpCode(
	code: string,
	secret: string,
	window = 1,
): boolean {
	const currentTime = Math.floor(Date.now() / 1000 / 30);

	for (let i = -window; i <= window; i++) {
		const timeStep = currentTime + i;
		const generatedCode = generateTotpCode(secret, timeStep);

		if (generatedCode === code) {
			return true;
		}
	}

	return false;
}
