const assert = require("node:assert/strict");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";
process.env.ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "test-admin-secret";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/videoapp_test";

const { startServer } = require("../backend/src/server");

test("server startup fails fast when external MongoDB is unavailable", async () => {
  await assert.rejects(
    startServer({
      port: 0,
      host: "127.0.0.1",
      enableSignalHandlers: false,
      mongoUri: "not-a-valid-mongo-uri",
    }),
    /MongoDB connection failed|Invalid scheme|Invalid connection string|MONGO_URI/i
  );
});
