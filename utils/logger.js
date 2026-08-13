// utils/logger.js - Structured logging.
//
// Render's log viewer shows one line per entry; console.log with emoji and
// multi-line JSON dumps is hard to filter there. pino emits one JSON object
// per line in production (queryable by level/field) and stays human-readable
// in development.
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // Never let credentials reach the logs, wherever they appear in an object.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-hub-signature-256']",
      "accessToken",
      "access_token",
      "ACCESS_TOKEN",
      "WHATSAPP_ACCESS_TOKEN",
      "WEBHOOK_SECRET",
      "ADMIN_PASSWORD",
      "password",
      "token",
      "*.accessToken",
      "*.password",
      "*.token",
    ],
    censor: "[redacted]",
  },

  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});

/** Child logger for a subsystem, e.g. log('outreach').info(...) */
export const log = (component) => logger.child({ component });
