import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { createRoute } from "honox/factory";

export default createRoute(logger(), secureHeaders());
