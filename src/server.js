const http = require("http");

const app = require("./app");
const { connectDB, disconnectDB } = require("./config/db");
const config = require("./config/env");
const initializeSocketServer = require("./socket/chatSocket");

const startServer = async (options = {}) => {
  const port = options.port ?? config.port;
  const host = options.host ?? "0.0.0.0";
  const enableSignalHandlers = options.enableSignalHandlers ?? true;

  await connectDB();

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

  console.log(`Server is running on port ${actualPort}`);

  const shutdown = async () => {
    io.close();

    await new Promise((resolve) => {
      httpServer.close(resolve);
    });

    await disconnectDB();
  };

  if (enableSignalHandlers) {
    const handleSignal = async () => {
      console.log("Shutting down server...");
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
  console.error("Uncaught Exception:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error.message);
  process.exit(1);
});

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
