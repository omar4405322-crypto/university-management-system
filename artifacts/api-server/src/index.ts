import "./config/loadEnvironment";
import os from "os";
import http from "http";
import app from "./app";
import { bootstrap } from "./bootstrap";
import logger from "./utils/logger";
import killPort from "kill-port";

const rawPort = process.env["PORT"];
if (!rawPort) {
  console.error("PORT environment variable is required");
  process.exit(1);
}

const PORT = Number(rawPort);
const server: http.Server = http.createServer(app);

// Authoritative single bootstrap initialization
bootstrap(server);

const startServer = () => {
  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`[SERVER] Running on http://localhost:${PORT}`);

    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          logger.info(
            `[SERVER] Running on http://${net.address}:${PORT} (Network)`,
          );
        }
      }
    }
  });
};

if (process.env.NODE_ENV === "production") {
  startServer();
} else {
  // Attempt to kill whatever is on the port first, then start the server.
  killPort(PORT, "tcp")
    .then(() => {
      logger.info(`[SERVER] Cleared port ${PORT}`);
      startServer();
    })
    .catch(() => {
      // Port might not be in use, or we lack permissions. Just try starting anyway.
      startServer();
    });
}

export { server };
