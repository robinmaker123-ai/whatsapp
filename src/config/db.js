const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const config = require("./env");

let memoryServer = null;

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(config.mongoUri);

    console.log(`MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    const shouldUseInMemoryMongo =
      config.nodeEnv !== "production" && config.allowInMemoryMongo;

    if (!shouldUseInMemoryMongo) {
      throw error;
    }

    console.warn(
      "Primary MongoDB unavailable. Falling back to in-memory MongoDB for development."
    );

    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: "chat_app",
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
