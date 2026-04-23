const crypto = require("crypto");

const { createLogger } = require("../utils/logger");
const config = require("../config/env");

const baseLogger = createLogger({
  component: "http",
  logDir: config.logDir,
  silent: config.nodeEnv === "test",
});

const requestContext = (req, res, next) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  req.logger = baseLogger.child(requestId);

  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    req.logger.info("request completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id || null,
    });
  });

  next();
};

module.exports = {
  requestContext,
};
