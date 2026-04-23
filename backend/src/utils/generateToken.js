const { generateAccessToken } = require("./authTokens");

const generateToken = (userId, sessionId) => generateAccessToken(userId, sessionId);

module.exports = generateToken;
