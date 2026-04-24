const http = require("http");

const app = require("./app");
const { connectDB, disconnectDB } = require("./config/db");
const config = require("./config/env");
const initializeSocketServer = require("./socket/chatSocket");
const { createLogger } = require("./utils/logger");

const logger = createLogger({
  component: "server",
  logDir: config.logDir,
  silent: config.nodeEnv === "test",
});

const startServer = async (options = {}) => {
  const port = options.port ?? config.port;
  const host = options.host ?? "0.0.0.0";
  const enableSignalHandlers = options.enableSignalHandlers ?? true;
  const databaseMode = options.forceInMemoryMongo ? "in-memory-test" : "external";

  logger.info("starting server", {
    port,
    host,
    environment: config.nodeEnv,
    databaseMode,
  });

  try {
    await connectDB({
      forceInMemory: options.forceInMemoryMongo ?? false,
      inMemoryDbName: options.mongoDbName,
      mongoUri: options.mongoUri,
    });
  } catch (error) {
    logger.error("database connection failed; server not started", {
      port,
      host,
      environment: config.nodeEnv,
      databaseMode,
      error,
    });
    throw error;
  }

  const httpServer = http.createServer(app);
  const io = initializeSocketServer(httpServer);
  app.set("io", io);

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, resolve);
  });

  const address = httpServer.address();
  const actualPort =
    typeof address === "object" && address ? address.port : port;

  logger.info("server started", {
    port: actualPort,
    host,
    environment: config.nodeEnv,
    databaseMode,
  });

  const shutdown = async () => {
    io.close();

    await new Promise((resolve) => {
      httpServer.close(resolve);
    });

    await disconnectDB();
  };

  if (enableSignalHandlers) {
    const handleSignal = async () => {
      logger.info("shutting down server");
      await shutdown();
      process.exit(0);
    };

    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);
  }

  return {
    app,
    io,
    port: actualPort,
    server: httpServer,
    shutdown,
  };
};

process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", { error });
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  logger.error("unhandled rejection", { error });
  process.exit(1);
});

if (require.main === module) {
  startServer().catch((error) => {
    logger.error("failed to start server", { error });
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
