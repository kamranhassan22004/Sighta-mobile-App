const { test } = require("node:test");
const assert = require("node:assert/strict");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { install } = require("./modelDouble");
const User = require("../models/User");
const Device = require("../models/Device");
const rows = install(User);
install(Device);
const { googleLogin } = require("../controllers/googleAuthController");
const { loginUser, registerUser } = require("../controllers/authController");
const { verifyGoogleToken } = require("../services/googleAuthService");
process.env.JWT_SECRET = "test-only-google-session-key";
process.env.GOOGLE_WEB_CLIENT_ID = "test-audience";
const identity = { sub: "google-subject", email: "guardian@example.test", email_verified: true,
  iss: "https://accounts.google.com", name: "Guardian", picture: "https://example.test/photo" };
let claims = identity;
OAuth2Client.prototype.verifyIdToken = async function (options) {
  assert.equal(options.audience, "test-audience");
  if (options.idToken !== "verified-test-token") throw new Error("Invalid signature or expired token");
  return { getPayload: () => claims };
};
async function call(controller, body) {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await controller({ body }, res);
  return res;
}
test("Google account lifecycle, conflicts, token rejection and password regression", async () => {
  assert.equal((await call(googleLogin, {})).code, 400);
  assert.equal((await call(googleLogin, { idToken: "invalid" })).code, 401);
  for (const change of [{ email_verified: false }, { iss: "attacker" }, { sub: "" }]) {
    claims = { ...identity, ...change };
    await assert.rejects(verifyGoogleToken("verified-test-token"), /could not be verified/);
  }
  claims = identity;
  const first = await call(googleLogin, { idToken: "verified-test-token", email: "spoof@example.test" });
  assert.equal(first.code, 200);
  assert.equal(first.body.email, identity.email);
  assert.equal(first.body.picture, identity.picture);
  assert.equal(String(jwt.verify(first.body.token, process.env.JWT_SECRET).id), String(first.body._id));
  const second = await call(googleLogin, { idToken: "verified-test-token" });
  assert.equal(String(second.body._id), String(first.body._id));
  assert.equal(rows.length, 1);
  assert.equal((await call(loginUser, { email: identity.email, password: "wrong" })).code, 401);
  const registered = await call(registerUser, { name: "Password Guardian", email: "password@example.test", password: "password123" });
  assert.equal(registered.code, 201);
  assert.equal((await call(loginUser, { email: "password@example.test", password: "password123" })).code, 200);
  claims = { ...identity, sub: "different-subject", email: "password@example.test" };
  const conflict = await call(googleLogin, { idToken: "verified-test-token" });
  assert.equal(conflict.code, 409);
  assert.equal(conflict.body.code, "ACCOUNT_LINK_REQUIRED");
  assert.equal(rows.length, 2);
  delete process.env.GOOGLE_WEB_CLIENT_ID;
  assert.equal((await call(googleLogin, { idToken: "verified-test-token" })).code, 503);
});
