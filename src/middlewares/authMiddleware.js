const jwt = require("jsonwebtoken");

const config = require("../config/env");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized. Token is missing.");
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized. Token is invalid or expired.");
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    res.status(401);
    throw new Error("Not authorized. User does not exist.");
  }

  req.user = user;
  next();
});

module.exports = {
  protect,
};
