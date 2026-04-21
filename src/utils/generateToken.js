const jwt = require("jsonwebtoken");

const config = require("../config/env");

const generateToken = (userId) =>
  jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

module.exports = generateToken;
