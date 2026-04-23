const config = require("../config/env");

const stores = new Map();

const getStore = (name) => {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }

  return stores.get(name);
};

const getClientIp = (req) =>
  String(
    req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      "unknown"
  )
    .split(",")[0]
    .trim();

const cleanupExpiredEntries = (store, now) => {
  store.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  });
};

const createRateLimiter = ({
  name,
  windowMs = config.defaultRateLimitWindowMs,
  max = config.defaultRateLimitMax,
  message = "Too many requests. Please try again later.",
  keyGenerator,
}) => {
  const store = getStore(name);

  return (req, res, next) => {
    const now = Date.now();

    cleanupExpiredEntries(store, now);

    const bucketKey = keyGenerator ? keyGenerator(req) : `${getClientIp(req)}:${req.path}`;

    if (!bucketKey) {
      next();
      return;
    }

    const existingBucket = store.get(bucketKey);
    const bucket =
      existingBucket && existingBucket.resetAt > now
        ? existingBucket
        : {
            count: 0,
            resetAt: now + windowMs,
          };

    bucket.count += 1;
    store.set(bucketKey, bucket);

    const remaining = Math.max(max - bucket.count, 0);
    res.setHeader("x-ratelimit-limit", String(max));
    res.setHeader("x-ratelimit-remaining", String(remaining));
    res.setHeader("x-ratelimit-reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader("retry-after", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        message,
      });
      return;
    }

    next();
  };
};

module.exports = {
  createRateLimiter,
  getClientIp,
};
