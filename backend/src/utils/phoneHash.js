const crypto = require("crypto");

const config = require("../config/env");
const { normalizePhone } = require("./phone");

const hashPhone = (phone = "") => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return "";
  }

  return crypto.createHash("sha256").update(normalizedPhone).digest("hex");
};

const hashPhoneSecure = (phone = "") => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !config.phoneHashSecret) {
    return "";
  }

  return crypto
    .createHmac("sha256", config.phoneHashSecret)
    .update(normalizedPhone)
    .digest("hex");
};

module.exports = {
  hashPhone,
  hashPhoneSecure,
};
