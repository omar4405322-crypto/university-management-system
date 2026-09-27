import "./config/loadEnvironment";
import http from "http";
import * as Sentry from "@sentry/node";
import { getJwtSecretValidationError } from "./utils/jwtSecretValidation";
import { getEncryptionKey } from "./utils/encryption.utils";
import { getTwoFactorConfigError } from "./utils/twoFactorConfig";
import { getMissingRuntimeEnvVars } from "./utils/runtimeEnvironment";
import { initSocket } from "./utils/socket";
import {
  startRiskDetectionJob,
  startSessionAutoExpiryJob,
  startPendingReviewAutoResolveJob,
} from "./utils/cron";
import { registerShutdownSignals } from "./utils/shutdown";

export interface BootstrapOptions {
  skipCron?: boolean;
  skipSocket?: boolean;
  skipShutdown?: boolean;
  skipEnvValidation?: boolean;
}

export interface BootstrapResult {
  server: http.Server;
  cronJobsStarted: boolean;
  socketInitialized: boolean;
  shutdownRegistered: boolean;
}

let isBootstrapped = false;

/**
 * Validates all required environment variables, secrets, encryption keys, and 2FA configuration.
 * Exits process with code 1 upon fatal misconfiguration.
 */
export function validateEnvironment(): void {
  const jwtSecretError = getJwtSecretValidationError(process.env.JWT_SECRET, 32);
  if (jwtSecretError) {
    console.error(`FATAL: ${jwtSecretError} Exiting.`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    try {
      getEncryptionKey();
    } catch (error) {
      console.error(`FATAL: ${(error as Error).message} Exiting.`);
      process.exit(1);
    }
  }

  const twoFactorConfigError = getTwoFactorConfigError(
    process.env.NODE_ENV,
    process.env.REQUIRE_2FA,
  );
  if (twoFactorConfigError) {
    console.error(`FATAL: ${twoFactorConfigError} Exiting.`);
    process.exit(1);
  }

  const missingRequired = getMissingRuntimeEnvVars(process.env);
  if (missingRequired.length > 0) {
    console.error(
      "❌ FATAL: Missing required environment variables:",
      missingRequired.join(", "),
    );
    process.exit(1);
  }
}

/**
 * Initializes Sentry application monitoring if SENTRY_DSN is configured.
 */
export function initSentry(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
  }
}

/**
 * Resets bootstrap state for isolated test execution.
 */
export function resetBootstrapStateForTesting(): void {
  isBootstrapped = false;
}

/**
 * Authoritative single bootstrap initialization:
 * 1. Validates environment
 * 2. Initializes Sentry monitoring
 * 3. Registers graceful shutdown lifecycle signals
 * 4. Initializes Socket.IO real-time infrastructure
 * 5. Launches distributed cron jobs
 */
export function bootstrap(
  server: http.Server,
  options: BootstrapOptions = {}
): BootstrapResult {
  if (isBootstrapped) {
    throw new Error("Application bootstrap can only be executed once per process.");
  }
  isBootstrapped = true;

  if (!options.skipEnvValidation) {
    validateEnvironment();
  }

  initSentry();

  let shutdownRegistered = false;
  if (!options.skipShutdown) {
    registerShutdownSignals(server);
    shutdownRegistered = true;
  }

  let socketInitialized = false;
  if (!options.skipSocket) {
    initSocket(server);
    socketInitialized = true;
  }

  let cronJobsStarted = false;
  if (!options.skipCron) {
    startRiskDetectionJob();
    startSessionAutoExpiryJob();
    startPendingReviewAutoResolveJob();
    cronJobsStarted = true;
  }

  return {
    server,
    cronJobsStarted,
    socketInitialized,
    shutdownRegistered,
  };
}
