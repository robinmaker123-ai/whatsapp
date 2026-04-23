const fs = require("fs");
const path = require("path");
const util = require("util");

const ensureLogDirectory = (targetDir) => {
  if (!targetDir) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
};

const serializeError = (error) => {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
};

const normalizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  return Object.entries(meta).reduce((accumulator, [key, value]) => {
    accumulator[key] = value instanceof Error ? serializeError(value) : value;
    return accumulator;
  }, {});
};

const writeLogLine = (logDir, fileName, payload) => {
  if (!logDir) {
    return;
  }

  ensureLogDirectory(logDir);
  fs.appendFileSync(path.join(logDir, fileName), `${JSON.stringify(payload)}\n`, "utf8");
};

const createLogger = (options = {}) => {
  const component = String(options.component || "app").trim() || "app";
  const logDir = options.logDir || "";
  const isSilent = Boolean(options.silent);

  const log = (level, message, meta = {}) => {
    const payload = {
      level,
      component,
      message,
      timestamp: new Date().toISOString(),
      ...normalizeMeta(meta),
    };

    writeLogLine(logDir, level === "error" ? "error.log" : "app.log", payload);

    if (!isSilent) {
      const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      consoleMethod(`[${payload.timestamp}] [${level.toUpperCase()}] [${component}] ${message}`);

      const metaKeys = Object.keys(meta || {});
      if (metaKeys.length > 0) {
        consoleMethod(util.inspect(normalizeMeta(meta), { depth: 5, colors: false }));
      }
    }
  };

  return {
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
    child: (nextComponent) =>
      createLogger({
        component: `${component}:${nextComponent}`,
        logDir,
        silent: isSilent,
      }),
  };
};

module.exports = {
  createLogger,
};
