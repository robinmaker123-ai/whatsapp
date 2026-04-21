const asyncHandler = require("../utils/asyncHandler");

const getMediaType = (mimeType) =>
  mimeType.startsWith("video/")
    ? "video"
    : mimeType.startsWith("audio/")
      ? "audio"
      : mimeType.startsWith("image/")
        ? "image"
        : "file";

const buildPublicUrl = (req, filename) =>
  `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(filename)}`;

const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Media file is required.");
  }

  const mediaType = getMediaType(req.file.mimetype || "image/*");

  res.status(201).json({
    upload: {
      url: buildPublicUrl(req, req.file.filename),
      mediaType,
      fileName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

module.exports = {
  uploadMedia,
};
