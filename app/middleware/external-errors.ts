import type { Env, TypedResponse } from "hono";
import { createMiddleware } from "hono/factory";

type ExternalErrorStatus =
	| 400 // Bad Request
	| 401 // Unauthorized
	| 403 // Forbidden
	| 404 // Not Found
	| 405 // Method Not Allowed
	| 408 // Request Timeout
	| 409 // Conflict
	| 410 // Gone
	| 413 // Payload Too Large
	| 415 // Unsupported Media Type
	| 422 // Unprocessable Entity
	| 429 // Too Many Requests
	| 500 // Internal Server Error
	| 501 // Not Implemented
	| 502 // Bad Gateway
	| 503 // Service Unavailable
	| 504; // Gateway Timeout

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

type ExternalErrorResponse =
	| TypedResponse<JsonValue, ExternalErrorStatus, "json">
	| TypedResponse<string, ExternalErrorStatus, "text">
	| TypedResponse<string, ExternalErrorStatus, "html">
	| TypedResponse<never, ExternalErrorStatus, "redirect">;

export const injectExternalErrors = createMiddleware<
	Env,
	"*",
	// biome-ignore lint/complexity/noBannedTypes: Input type parameter requires {} for no constraints
	{},
	ExternalErrorResponse
>(async (_c, next) => {
	await next();
});
