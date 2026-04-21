const fs = require("fs");
const path = require("path");

const multer = require("multer");

const uploadsDir = path.resolve(process.cwd(), "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

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
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/") ||
    file.mimetype.startsWith("audio/") ||
    file.mimetype === "application/pdf" ||
    file.mimetype.includes("document") ||
    file.mimetype.includes("sheet") ||
    file.mimetype.includes("presentation") ||
    file.mimetype.startsWith("text/")
  ) {
    callback(null, true);
    return;
  }

  callback(new Error("Only media and common document files are allowed."));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

module.exports = {
  upload,
  uploadsDir,
};
