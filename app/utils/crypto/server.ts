import { createHash, randomBytes } from "node:crypto";

/**
 * Generates a UUIDv7 (time-ordered UUID).
 *
 * UUIDv7 embeds a timestamp in the first 48 bits, making it suitable for
 * time-based sorting and indexing. The remaining bits are filled with
 * cryptographically secure random data.
 *
 * @returns A UUIDv7 string in the format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
 *
 * @example
 * const userId = generateUuidv7();
 * // => "018d3f5e-5c3a-7000-8000-123456789abc"
 * // Can be sorted chronologically
 */
export function generateUuidv7(): string {
	const timestamp = Date.now();

	const buffer = Buffer.alloc(16);
	buffer.writeUIntBE(timestamp, 0, 6);

	const randomData = randomBytes(10);
	randomData.copy(buffer, 6);

	const byte6 = buffer[6];

	if (byte6 === undefined) {
		throw new Error("Failed to generate UUIDv7");
	}

	buffer[6] = (byte6 & 0x0f) | 0x70;

	const byte8 = buffer[8];

	if (byte8 === undefined) {
		throw new Error("Failed to generate UUIDv7");
	}

	buffer[8] = (byte8 & 0x3f) | 0x80;

	const hex = buffer.toString("hex");

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a cryptographically secure random token.
 *
 * @param bytes - Number of random bytes to generate (default: 32)
 * @returns URL-safe base64 encoded string
 *
 * @example
 * const signupToken = generateSecureToken(); // 256-bit token
 * const shortToken = generateSecureToken(16); // 128-bit token
 */
export function generateSecureToken(bytes = 32): string {
	return randomBytes(bytes).toString("base64url");
}

/**
 * Hashes a token using SHA-256.
 *
 * This is used to securely store tokens in the database. Never store tokens
 * in plain text - always hash them first and compare hashes.
 *
 * @param token - The token to hash
 * @returns Hexadecimal string representation of the SHA-256 hash
 *
 * @example
 * const token = generateSecureToken();
 * const tokenHash = hashToken(token);
 * // Store tokenHash in database, send token to user
 *
 * // Later, to verify:
 * const receivedTokenHash = hashToken(receivedToken);
 * // Compare receivedTokenHash with stored hash
 */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}
