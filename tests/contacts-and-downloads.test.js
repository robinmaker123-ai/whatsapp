const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.ENABLE_DEV_OTP_PREVIEW = "true";
process.env.ALLOW_IN_MEMORY_MONGO = "true";
process.env.DOWNLOAD_ADMIN_TOKEN = "test-admin-token";

const { startServer } = require("../backend/src/server");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const normalizePhone = (phone = "") => {
  const rawPhone = String(phone).trim();

  if (!rawPhone) {
    return "";
  }

  if (rawPhone.startsWith("+")) {
    return `+${rawPhone.slice(1).replace(/\D/g, "")}`;
  }

  return rawPhone.replace(/\D/g, "");
};

const hashPhone = (phone = "") =>
  crypto.createHash("sha256").update(normalizePhone(phone)).digest("hex");

const requestJson = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed with ${response.status}`);
  }

  return data;
};

const createSession = async (baseUrl, name, phone) => {
  const sendOtpResponse = await requestJson(baseUrl, "/auth/send-otp", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ phone }),
  });

  assert.ok(sendOtpResponse.mockOtp, "Expected mock OTP in development mode");

  return requestJson(baseUrl, "/auth/verify-otp", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      phone,
      otp: sendOtpResponse.mockOtp,
      name,
    }),
  });
};

test("contact sync matches hashed numbers and APK downloads are tracked", async () => {
  const runtime = await startServer({
    port: 0,
    host: "127.0.0.1",
    enableSignalHandlers: false,
    forceInMemoryMongo: true,
    mongoDbName: "videoapp_test_contacts_downloads",
  });

  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  const uniqueSeed = `${Date.now()}`.slice(-6);
  const phoneA = `+9181${uniqueSeed}`;
  const phoneB = `+9182${uniqueSeed}`;
  const phoneInvite = `+9183${uniqueSeed}`;

  try {
    const sessionA = await createSession(baseUrl, "User A", phoneA);
    const sessionB = await createSession(baseUrl, "User B", phoneB);

    const matchedResponse = await requestJson(baseUrl, "/users/matched-contacts/sync", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${sessionA.token}`,
      },
      body: JSON.stringify({
        contacts: [
          {
            hash: hashPhone(sessionB.user.phone),
            displayName: "User B",
            phone: sessionB.user.phone,
          },
          {
            hash: hashPhone(phoneInvite),
            displayName: "Future User",
            phone: phoneInvite,
          },
        ],
      }),
    });

    assert.equal(matchedResponse.users.length, 1);
    assert.equal(matchedResponse.users[0].id, sessionB.user.id);
    assert.equal(matchedResponse.inviteCandidates.length, 1);
    assert.equal(matchedResponse.syncedCount, 2);
    assert.equal(matchedResponse.matchedCount, 1);

    const releaseResponse = await requestJson(baseUrl, "/downloads/releases", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        "x-admin-token": process.env.DOWNLOAD_ADMIN_TOKEN,
      },
      body: JSON.stringify({
        version: "1.0.99",
        buildNumber: 99,
        apkUrl: "https://example.com/videoapp-release.apk",
        releaseNotes: ["Initial production release", "Tracked APK redirect"],
      }),
    });

    assert.equal(releaseResponse.release.version, "1.0.99");
    assert.equal(releaseResponse.release.downloadCount, 0);

    const latestReleaseResponse = await requestJson(baseUrl, "/downloads/latest");
    assert.equal(latestReleaseResponse.release.version, "1.0.99");
    assert.equal(latestReleaseResponse.release.downloadCount, 0);

    const downloadResponse = await fetch(`${baseUrl}/downloads/latest.apk`, {
      redirect: "manual",
    });

    assert.equal(downloadResponse.status, 302);
    assert.equal(downloadResponse.headers.get("location"), "https://example.com/videoapp-release.apk");

    const trackedReleaseResponse = await requestJson(baseUrl, "/downloads/latest");
    assert.equal(trackedReleaseResponse.release.downloadCount, 1);
  } finally {
    await runtime.shutdown();
  }
});
