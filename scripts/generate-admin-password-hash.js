const { hashPassword } = require("../backend/src/utils/passwordHash");

const password = String(process.argv[2] || "").trim();

if (!password) {
  console.error("Usage: node scripts/generate-admin-password-hash.js <password>");
  process.exit(1);
}

console.log(hashPassword(password));
