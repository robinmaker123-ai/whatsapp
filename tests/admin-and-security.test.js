const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ENABLE_DEV_OTP_PREVIEW = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";
process.env.ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "test-admin-secret";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/videoapp_test";
process.env.ADMIN_EMAIL = "admin@videoapp.local";

const { hashPassword } = require("../backend/src/utils/passwordHash");

process.env.ADMIN_PASSWORD_HASH = hashPassword("AdminPass123!");

const { startServer } = require("../backend/src/server");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const requestJson = async (baseUrl, targetPath, options = {}) => {
  const response = await fetch(`${baseUrl}${targetPath}`, options);
  const data = await response.json().catch(() => ({}));

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

test("refresh tokens, reports, and admin moderation work together", async () => {
  const runtime = await startServer({
    port: 0,
    host: "127.0.0.1",
    enableSignalHandlers: false,
    forceInMemoryMongo: true,
    mongoDbName: "videoapp_test_admin_security",
  });

  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  const uniqueSeed = `${Date.now()}`.slice(-6);

  try {
    const alice = await createSession(baseUrl, "Alice", `+9190${uniqueSeed}`);
    const bob = await createSession(baseUrl, "Bob", `+9191${uniqueSeed}`);

    assert.ok(alice.refreshToken, "Expected refresh token to be issued");

    const refreshedAlice = await requestJson(baseUrl, "/auth/refresh", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        refreshToken: alice.refreshToken,
      }),
    });

    assert.ok(refreshedAlice.token);
    assert.ok(refreshedAlice.refreshToken);

    const reportResponse = await requestJson(baseUrl, `/user/reports/${bob.user.id}`, {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${refreshedAlice.token}`,
      },
      body: JSON.stringify({
        reason: "spam",
        details: "Repeated unsolicited messages",
      }),
    });

    assert.equal(reportResponse.report.reason, "spam");

    const adminLogin = await requestJson(baseUrl, "/admin/auth/login", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: "AdminPass123!",
      }),
    });

    assert.ok(adminLogin.token);

    const adminOverview = await requestJson(baseUrl, "/admin/overview", {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
      },
    });

    assert.ok(adminOverview.stats.totalUsers >= 2);
    assert.ok(adminOverview.stats.openReports >= 1);

    const reportsPayload = await requestJson(baseUrl, "/admin/reports", {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
      },
    });

    assert.equal(reportsPayload.reports.length, 1);
    assert.equal(reportsPayload.reports[0].reportedUserId.id, bob.user.id);

    const banPayload = await requestJson(baseUrl, `/admin/users/${bob.user.id}/ban`, {
      method: "PATCH",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({
        reason: "Spam account",
      }),
    });

    assert.equal(banPayload.user.isBanned, true);

    const bannedProfileResponse = await fetch(`${baseUrl}/user/profile`, {
      headers: {
        Authorization: `Bearer ${bob.token}`,
      },
    });

    assert.equal(bannedProfileResponse.status, 403);
  } finally {
    await runtime.shutdown();
  }
});
