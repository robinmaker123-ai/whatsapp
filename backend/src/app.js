const fs = require("fs");
const path = require("path");

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config/env");
const { protect } = require("./middlewares/authMiddleware");
const { errorHandler, notFound } = require("./middlewares/errorMiddleware");
const { requestContext } = require("./middlewares/requestContextMiddleware");
const { createRateLimiter } = require("./middlewares/rateLimitMiddleware");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const callRoutes = require("./routes/callRoutes");
const communityRoutes = require("./routes/communityRoutes");
const contactRoutes = require("./routes/contactRoutes");
const downloadRoutes = require("./routes/downloadRoutes");
const groupRoutes = require("./routes/groupRoutes");
const mediaRoutes = require("./routes/uploadRoutes");
const messageRoutes = require("./routes/messageRoutes");
const siteRoutes = require("./routes/siteRoutes");
const statusRoutes = require("./routes/statusRoutes");
const userRoutes = require("./routes/userRoutes");
const { uploadsDir } = require("./middlewares/uploadMiddleware");

const app = express();
const allowedOrigins = new Set(config.corsOrigins);
const websiteRoutePrefixes = [
  "/admin/announcements",
  "/admin/auth",
  "/admin/logs",
  "/admin/overview",
  "/admin/releases",
  "/admin/reports",
  "/admin/users",
  "/auth",
  "/calls",
  "/community",
  "/contacts",
  "/downloads",
  "/groups",
  "/health",
  "/media",
  "/messages",
  "/site",
  "/status",
  "/uploads",
  "/user",
  "/users",
];

const isOriginAllowed = (origin) => {
  if (!origin || allowedOrigins.size === 0) {
    return true;
  }

  return allowedOrigins.has(origin);
};

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin is not allowed."));
  },
  credentials: true,
});

const apiLimiter = createRateLimiter({
  name: "api",
});

const authLimiter = createRateLimiter({
  name: "auth",
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  message: "Too many authentication attempts. Please slow down.",
  keyGenerator: (req) => `${req.ip}:${req.path}:${String(req.body.phone || "").trim()}`,
});

const uploadLimiter = createRateLimiter({
  name: "upload",
  windowMs: config.uploadRateLimitWindowMs,
  max: config.uploadRateLimitMax,
  message: "Upload rate limit reached. Please try again later.",
});

const adminLimiter = createRateLimiter({
  name: "admin",
  windowMs: config.adminRateLimitWindowMs,
  max: config.adminRateLimitMax,
  message: "Too many admin requests. Please try again later.",
});

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    contentSecurityPolicy: false,
  })
);
app.use(corsMiddleware);
app.options("*", corsMiddleware);
app.use(requestContext);
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(apiLimiter);
app.use(
  "/uploads",
  express.static(path.resolve(uploadsDir), {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "VideoApp backend is running.",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get("/health/ready", (req, res) => {
  res.status(200).json({
    status: "ready",
  });
});

app.use("/auth", authLimiter, authRoutes);
app.use("/admin", adminLimiter, adminRoutes);
app.use("/site", siteRoutes);
app.use("/contacts", protect, contactRoutes);
app.use("/downloads", downloadRoutes);
app.use("/media", uploadLimiter, mediaRoutes);
app.use("/messages", messageRoutes);
app.use("/status", statusRoutes);
app.use("/calls", callRoutes);
app.use("/groups", groupRoutes);
app.use("/community", communityRoutes);
app.use("/users", userRoutes);
app.use("/user", userRoutes);

const websiteDistDir = path.resolve(config.websiteDistDir);

if (fs.existsSync(websiteDistDir)) {
  app.use(
    express.static(websiteDistDir, {
      fallthrough: true,
      setHeaders: (res, filePath) => {
        const extension = path.extname(filePath).toLowerCase();

        if (extension === ".apk") {
          res.setHeader("Content-Type", "application/vnd.android.package-archive");
          res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
          res.setHeader("X-Content-Type-Options", "nosniff");
        }

        if (filePath.endsWith(`${path.sep}release.json`)) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    const normalizedPath = String(req.path || "/");
    const isKnownBackendRoute = websiteRoutePrefixes.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    );

    if (isKnownBackendRoute) {
      next();
      return;
    }

    const acceptsHtml = String(req.headers.accept || "").includes("text/html");

    if (!acceptsHtml) {
      next();
      return;
    }

    res.sendFile(path.join(websiteDistDir, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
