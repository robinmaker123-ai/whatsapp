const crypto = require("crypto");

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

const randomHex = (bytes = 16) => crypto.randomBytes(bytes).toString("hex");

const hashPassword = (password) => {
  const normalizedPassword = String(password || "");
  const salt = randomHex(16);
  const derivedKey = crypto
    .scryptSync(normalizedPassword, salt, KEY_LENGTH)
    .toString("hex");

  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
};

const verifyPassword = (password, storedHash) => {
  const normalizedHash = String(storedHash || "").trim();
  const [prefix, salt, derivedKey] = normalizedHash.split("$");

  if (prefix !== HASH_PREFIX || !salt || !derivedKey) {
    return false;
  }

  const currentHash = crypto
    .scryptSync(String(password || ""), salt, KEY_LENGTH)
    .toString("hex");

  const currentBuffer = Buffer.from(currentHash, "hex");
  const storedBuffer = Buffer.from(derivedKey, "hex");

  if (currentBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(currentBuffer, storedBuffer);
};

module.exports = {
  hashPassword,
  verifyPassword,
};
