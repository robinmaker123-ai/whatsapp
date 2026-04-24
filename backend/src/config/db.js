const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const config = require("./env");
const { createLogger } = require("../utils/logger");

let memoryServer = null;
const logger = createLogger({
  component: "db",
  logDir: config.logDir,
  silent: config.nodeEnv === "test",
});

const buildMongoConnectionError = (message, cause) => {
  const wrappedError = new Error(message);
  wrappedError.cause = cause;
  return wrappedError;
};

const connectPrimaryMongo = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error(
      "MONGO_URI is required. Configure a reachable MongoDB instance before starting the server."
    );
  }

  try {
    const connection = await mongoose.connect(mongoUri);

    logger.info("mongodb connected", {
      host: connection.connection.host,
      database: connection.connection.name,
    });

    return connection;
  } catch (error) {
    throw buildMongoConnectionError(
      "MongoDB connection failed. Set a valid MONGO_URI and make sure the database is reachable. The server was not started.",
      error
    );
  }
};

const connectInMemoryMongo = async (inMemoryDbName) => {
  logger.warn("using isolated in-memory mongodb", {
    database: inMemoryDbName,
  });

  try {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: inMemoryDbName,
      },
    });

    const inMemoryUri = memoryServer.getUri();
    const connection = await mongoose.connect(inMemoryUri);

    logger.info("mongodb in-memory connected", {
      host: connection.connection.host,
      database: connection.connection.name,
    });

    return connection;
  } catch (error) {
    throw buildMongoConnectionError(
      "In-memory MongoDB failed to start. This mode is intended only for isolated tests.",
      error
    );
  }
};

const connectDB = async (options = {}) => {
  const forceInMemory = options.forceInMemory ?? false;
  const mongoUri = options.mongoUri ?? config.mongoUri;
  const inMemoryDbName = String(options.inMemoryDbName || "chat_app").trim() || "chat_app";

  if (forceInMemory) {
    return connectInMemoryMongo(inMemoryDbName);
  }

  return connectPrimaryMongo(mongoUri);
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
