const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sharedConfigDir = path.join(rootDir, "shared", "config");
const sharedReleaseDir = path.join(rootDir, "shared", "releases", "android");
const websiteDataDir = path.join(rootDir, "website", "public", "data");
const websiteDownloadDir = path.join(rootDir, "website", "public", "downloads");

const ensureDir = (targetDir) => {
  fs.mkdirSync(targetDir, { recursive: true });
};

const copyIfExists = (sourcePath, destinationPath) => {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  fs.copyFileSync(sourcePath, destinationPath);
  return true;
};

const loadJson = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(targetPath, "utf8"));
};

const writeJson = (targetPath, payload) => {
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const syncSharedAssets = () => {
  ensureDir(websiteDataDir);
  ensureDir(websiteDownloadDir);

  const productSource = path.join(sharedConfigDir, "product.json");
  const productTarget = path.join(websiteDataDir, "product.json");
  copyIfExists(productSource, productTarget);

  const releaseSource = path.join(sharedReleaseDir, "release.json");
  const releaseTarget = path.join(websiteDownloadDir, "release.json");
  const releasePayload = loadJson(releaseSource) || {};

  const apkFileName = String(releasePayload.fileName || "videoapp-latest.apk").trim();
  const apkSource = path.join(sharedReleaseDir, apkFileName);
  const apkTarget = path.join(websiteDownloadDir, apkFileName);
  const hasBundledApk = copyIfExists(apkSource, apkTarget);

  if (!hasBundledApk && fs.existsSync(apkTarget)) {
    fs.unlinkSync(apkTarget);
  }

  writeJson(releaseTarget, {
    ...releasePayload,
    fileName: apkFileName,
    apkAvailable: hasBundledApk,
    downloadUrl: hasBundledApk ? `/downloads/${apkFileName}` : String(releasePayload.apkUrl || "").trim(),
    relativeWebsiteDownloadPath: hasBundledApk ? `/downloads/${apkFileName}` : "",
  });

  console.log(`Shared assets synced. APK bundled: ${hasBundledApk ? "yes" : "no"}`);
};

syncSharedAssets();
