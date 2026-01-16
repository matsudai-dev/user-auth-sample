/**
 * Returns a new Date offset by the specified number of milliseconds.
 *
 * @param date - The base date (not modified)
 * @param ms - Milliseconds to add (use negative values to subtract)
 * @returns A new Date object with the offset applied
 *
 * @example
 * const now = new Date();
 * const tomorrow = offsetMilliSeconds(now, 24 * 60 * 60 * 1000);
 * const yesterday = offsetMilliSeconds(now, -24 * 60 * 60 * 1000);
 * // `now` remains unchanged
 */
export function offsetMilliSeconds(date: Date, ms: number): Date {
	return new Date(date.getTime() + ms);
}
