const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const config = require("./env");

let memoryServer = null;

const connectDB = async (options = {}) => {
  const forceInMemory = options.forceInMemory ?? false;
  const mongoUri = options.mongoUri ?? config.mongoUri;
  const inMemoryDbName = String(options.inMemoryDbName || "chat_app").trim() || "chat_app";

  try {
    if (forceInMemory) {
      throw new Error("Forced in-memory MongoDB mode enabled.");
    }

    const connection = await mongoose.connect(mongoUri);

    console.log(`MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    const shouldUseInMemoryMongo =
      forceInMemory || (config.nodeEnv !== "production" && config.allowInMemoryMongo);

    if (!shouldUseInMemoryMongo) {
      throw error;
    }

    if (forceInMemory) {
      console.warn("Using isolated in-memory MongoDB.");
    } else {
      console.warn(
        "Primary MongoDB unavailable. Falling back to in-memory MongoDB for development."
      );
    }

    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: inMemoryDbName,
      },
    });

    const inMemoryUri = memoryServer.getUri();
    const connection = await mongoose.connect(inMemoryUri);

    console.log(`MongoDB in-memory connected: ${connection.connection.host}`);
    return connection;
  }
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
