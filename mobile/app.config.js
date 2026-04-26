const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

const baseConfig = appJson.expo || appJson;
const mobileDir = __dirname;

const trimValue = (value = "") => String(value || "").trim();

const stripWrappingQuotes = (value = "") => {
  const normalizedValue = trimValue(value);

  if (
    (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) ||
    (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
  ) {
    return normalizedValue.slice(1, -1);
  }

  return normalizedValue;
};

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const fileContents = fs.readFileSync(filePath, "utf8");

  return fileContents.split(/\r?\n/).reduce((collectedValues, line) => {
    const normalizedLine = trimValue(line);

    if (!normalizedLine || normalizedLine.startsWith("#")) {
      return collectedValues;
    }

    const sanitizedLine = normalizedLine.replace(/^export\s+/, "");
    const separatorIndex = sanitizedLine.indexOf("=");

    if (separatorIndex <= 0) {
      return collectedValues;
    }

    const key = trimValue(sanitizedLine.slice(0, separatorIndex));
    const rawValue = sanitizedLine.slice(separatorIndex + 1);

    if (!key) {
      return collectedValues;
    }

    collectedValues[key] = stripWrappingQuotes(rawValue);
    return collectedValues;
  }, {});
};

const normalizeAppEnv = (value = "") => {
  const normalizedValue = trimValue(value).toLowerCase();

  if (normalizedValue === "production") {
    return "production";
  }

  return "development";
};

const resolveEnvFileValues = (appEnv) => {
  const envFiles = [
    ".env",
    ".env.local",
    `.env.${appEnv}`,
    `.env.${appEnv}.local`,
  ];

  return envFiles.reduce((resolvedValues, fileName) => {
    const filePath = path.join(mobileDir, fileName);
    return {
      ...resolvedValues,
      ...parseEnvFile(filePath),
    };
  }, {});
};

const readResolvedValue = (sources, ...names) =>
  names
    .map((name) => trimValue(sources[name]))
    .find(Boolean) || "";

const initialAppEnv = normalizeAppEnv(
  process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || process.env.NODE_ENV
);
const fileValues = resolveEnvFileValues(initialAppEnv);
const resolvedValues = {
  ...fileValues,
  ...process.env,
};
const resolvedAppEnv = normalizeAppEnv(
  readResolvedValue(resolvedValues, "EXPO_PUBLIC_APP_ENV", "APP_ENV") || initialAppEnv
);
const resolvedApiUrl = readResolvedValue(
  resolvedValues,
  "EXPO_PUBLIC_API_URL",
  resolvedAppEnv === "production" ? "EXPO_PUBLIC_PRODUCTION_API_BASE_URL" : "",
  "EXPO_PUBLIC_API_BASE_URL"
);
const resolvedSocketUrl = readResolvedValue(
  resolvedValues,
  "EXPO_PUBLIC_SOCKET_URL",
  resolvedAppEnv === "production" ? "EXPO_PUBLIC_PRODUCTION_SOCKET_URL" : "",
  "EXPO_PUBLIC_API_URL",
  resolvedAppEnv === "production" ? "EXPO_PUBLIC_PRODUCTION_API_BASE_URL" : "",
  "EXPO_PUBLIC_API_BASE_URL"
);

module.exports = () => ({
  ...baseConfig,
  extra: {
    ...(baseConfig.extra || {}),
    publicAppEnv: resolvedAppEnv,
    publicApiUrl: resolvedApiUrl,
    publicSocketUrl: resolvedSocketUrl,
  },
});
