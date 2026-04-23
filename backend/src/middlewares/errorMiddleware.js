const mongoose = require("mongoose");

const config = require("../config/env");
const ErrorLog = require("../models/ErrorLog");
const { createLogger } = require("../utils/logger");

const errorLogger = createLogger({
  component: "error",
  logDir: config.logDir,
  silent: config.nodeEnv === "test",
});

const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

const persistErrorLog = async (err, req, statusCode) => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await ErrorLog.create({
      level: statusCode >= 500 ? "error" : "warn",
      message: err.message || "Internal Server Error",
      stack: err.stack || "",
      statusCode,
      path: req.originalUrl,
      method: req.method,
      requestId: req.requestId || "",
      userId: req.user?.id || null,
      meta: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "",
      },
    });
  } catch (loggingError) {
    if (
      loggingError?.name === "MongoClientClosedError" ||
      /client was closed/i.test(loggingError?.message || "")
    ) {
      return;
    }

    errorLogger.error("failed to persist error log", {
      requestId: req.requestId || "",
      error: loggingError,
    });
  }
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  errorLogger.error(err.message || "Unhandled error", {
    requestId: req.requestId || "",
    statusCode,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id || null,
    error: err,
  });

  void persistErrorLog(err, req, statusCode);

  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    requestId: req.requestId || null,
    stack: config.isProduction ? undefined : err.stack,
  });
};

module.exports = {
  errorHandler,
  notFound,
};
