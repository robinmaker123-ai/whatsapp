const path = require("path");

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config/env");
const { errorHandler, notFound } = require("./middlewares/errorMiddleware");
const authRoutes = require("./routes/authRoutes");
const callRoutes = require("./routes/callRoutes");
const downloadRoutes = require("./routes/downloadRoutes");
const mediaRoutes = require("./routes/uploadRoutes");
const messageRoutes = require("./routes/messageRoutes");
const statusRoutes = require("./routes/statusRoutes");
const userRoutes = require("./routes/userRoutes");
const { uploadsDir } = require("./middlewares/uploadMiddleware");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
  })
);
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(uploadsDir)));

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Chat backend is running.",
  });
});

app.use("/auth", authRoutes);
app.use("/downloads", downloadRoutes);
app.use("/media", mediaRoutes);
app.use("/messages", messageRoutes);
app.use("/status", statusRoutes);
app.use("/calls", callRoutes);
app.use("/users", userRoutes);
app.use("/user", userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
