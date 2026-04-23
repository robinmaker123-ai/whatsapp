const mongoose = require("mongoose");

const trimmedString = (value) => String(value || "").trim();

const optionalString = (value, maxLength = 5000) => trimmedString(value).slice(0, maxLength);

const requiredString = (value, message, maxLength = 5000) => {
  const normalizedValue = optionalString(value, maxLength);

  if (!normalizedValue) {
    throw new Error(message);
  }

  return normalizedValue;
};

const optionalBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
};

const optionalInteger = (value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < min || parsedValue > max) {
    throw new Error("A valid number is required.");
  }

  return parsedValue;
};

const requireObjectId = (value, label = "id") => {
  const normalizedValue = trimmedString(value);

  if (!mongoose.Types.ObjectId.isValid(normalizedValue)) {
    throw new Error(`A valid ${label} is required.`);
  }

  return normalizedValue;
};

const optionalUrl = (value) => {
  const normalizedValue = trimmedString(value);

  if (!normalizedValue) {
    return "";
  }

  try {
    return new URL(normalizedValue).toString();
  } catch (error) {
    throw new Error("A valid absolute URL is required.");
  }
};

const ensureAllowedValue = (value, allowedValues, label = "value") => {
  if (!allowedValues.includes(value)) {
    throw new Error(`A valid ${label} is required.`);
  }

  return value;
};

module.exports = {
  ensureAllowedValue,
  optionalBoolean,
  optionalInteger,
  optionalString,
  optionalUrl,
  requireObjectId,
  requiredString,
  trimmedString,
};
