const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ENABLE_DEV_OTP_PREVIEW = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";
process.env.ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "test-admin-secret";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://example.invalid:27017/videoapp_test";

const { startServer } = require("../backend/src/server");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const requestJson = async (baseUrl, targetPath, options = {}) => {
  const response = await fetch(`${baseUrl}${targetPath}`, options);
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

test("community creation feeds site overview and community listings", async () => {
  const runtime = await startServer({
    port: 0,
    host: "::1",
    enableSignalHandlers: false,
    forceInMemoryMongo: true,
    mongoDbName: "videoapp_test_community_site",
  });

  const baseUrl = `http://[::1]:${runtime.port}`;
  const uniqueSeed = `${Date.now()}`.slice(-6);

  try {
    const session = await createSession(baseUrl, "Community Admin", `+9177${uniqueSeed}`);

    const createResponse = await requestJson(baseUrl, "/community", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        name: "Launch Team",
        description: "Announcements, builders, and rollout planning.",
      }),
    });

    assert.equal(createResponse.community.name, "Launch Team");
    assert.equal(createResponse.community.groupsCount, 1);
    assert.ok(createResponse.community.announcementGroupId);

    const listResponse = await requestJson(baseUrl, "/community", {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    assert.equal(listResponse.communities.length, 1);
    assert.equal(listResponse.communities[0].name, "Launch Team");

    const siteOverview = await requestJson(baseUrl, "/site/overview");
    assert.ok(siteOverview.product?.app?.name);
    assert.equal(siteOverview.stats.communitiesCount, 1);
    assert.equal(siteOverview.stats.groupsCount, 1);
    assert.ok(siteOverview.release);
  } finally {
    await runtime.shutdown();
  }
});
