const fs = require("fs");
const path = require("path");

const multer = require("multer");

const config = require("../config/env");

const uploadsDir = path.resolve(process.cwd(), "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const sanitizeName = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "media";

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const baseName = sanitizeName(path.basename(file.originalname || "media", extension));
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    callback(null, `${baseName}-${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req, file, callback) => {
  const mimeType = String(file.mimetype || "").trim().toLowerCase();

  if (!allowedMimeTypes.has(mimeType)) {
    callback(new Error("Unsupported file type."));
    return;
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.uploadMaxFileSizeBytes,
    files: 1,
  },
});

module.exports = {
  allowedMimeTypes,
  upload,
  uploadsDir,
};
