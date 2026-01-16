import { describe, expect, it } from "bun:test";
import { offsetMilliSeconds } from ".";

describe("offsetMilliSeconds", () => {
	it("should return a new Date offset by positive milliseconds", () => {
		const baseDate = new Date("2026-01-15T12:00:00.000Z");
		const offset = 1000; // 1 second
		const result = offsetMilliSeconds(baseDate, offset);

		expect(result.getTime()).toBe(baseDate.getTime() + offset);
	});

	it("should return a new Date offset by negative milliseconds", () => {
		const baseDate = new Date("2026-01-15T12:00:00.000Z");
		const offset = -1000; // -1 second
		const result = offsetMilliSeconds(baseDate, offset);

		expect(result.getTime()).toBe(baseDate.getTime() + offset);
	});

	it("should return the same date when offset is zero", () => {
		const baseDate = new Date("2026-01-15T12:00:00.000Z");
		const result = offsetMilliSeconds(baseDate, 0);

		expect(result.getTime()).toBe(baseDate.getTime());
	});

	it("should not modify the original date (immutability)", () => {
		const baseDate = new Date("2026-01-15T12:00:00.000Z");
		const originalTime = baseDate.getTime();

		offsetMilliSeconds(baseDate, 5000);

		expect(baseDate.getTime()).toBe(originalTime);
	});

	it("should handle large positive offsets", () => {
		const baseDate = new Date("2026-01-15T00:00:00.000Z");
		const oneDayInMs = 24 * 60 * 60 * 1000;
		const result = offsetMilliSeconds(baseDate, oneDayInMs);

		expect(result.toISOString()).toBe("2026-01-16T00:00:00.000Z");
	});

	it("should handle large negative offsets", () => {
		const baseDate = new Date("2026-01-15T00:00:00.000Z");
		const oneDayInMs = 24 * 60 * 60 * 1000;
		const result = offsetMilliSeconds(baseDate, -oneDayInMs);

		expect(result.toISOString()).toBe("2026-01-14T00:00:00.000Z");
	});
});
