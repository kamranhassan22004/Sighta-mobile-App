const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

// Exercise the real exported Vercel entry point without loading local secrets,
// connecting to Atlas, sending notifications, or changing production records.
const dotenv = require("dotenv");
const originalConfig = dotenv.config;
const dbPath = require.resolve("../config/db");
const originalDBModule = require.cache[dbPath];
let databaseChecks = 0;
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: async () => { databaseChecks++; } };
dotenv.config = () => ({ parsed: {} });
let app;
try { app = require("../server"); }
finally {
  dotenv.config = originalConfig;
  if (originalDBModule) require.cache[dbPath] = originalDBModule;
  else delete require.cache[dbPath];
}

let server, origin;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
async function request(path, method = "GET", body) {
  const response = await fetch(origin + path, { method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

test("Vercel export serves Google POST at the exact production API path", async () => {
  assert.equal(typeof app, "function");
  const root = await request("/");
  assert.equal(root.body.message, "SIGHTA Guardian API is running");
  const result = await request("/api/auth/google", "POST", {});
  assert.equal(result.status, 400);
  assert.equal(result.body.message, "A Google identity token is required.");
  assert.ok(databaseChecks > 0, "request traverses real database middleware");
});

test("existing password registration/login routes remain mounted", async () => {
  const login = await request("/api/auth/login", "POST", {});
  assert.equal(login.status, 400);
  assert.equal(login.body.message, "Email and password are required");
  const register = await request("/api/auth/register", "POST", {});
  assert.equal(register.status, 400);
  assert.equal(register.body.message, "Name, email and password are required");
});

test("device, guardian, GPS, alert and activity routes retain authentication", async () => {
  for (const [path, method] of [
    ["/api/auth/profile", "GET"],
    ["/api/device/status/test-device", "GET"],
    ["/api/device/sharing", "GET"],
    ["/api/device/sharing/test-device/invite", "POST"],
    ["/api/device/sharing/test-device/accept", "POST"],
    ["/api/location/current/test-user", "GET"],
    ["/api/location/history/test-user", "GET"],
    ["/api/alerts/test-user", "GET"],
    ["/api/device-events/test-user", "GET"],
    ["/api/daily-summary/activity", "GET"],
    ["/api/device-monitor/offline", "GET"],
  ]) {
    const result = await request(path, method, method === "POST" ? {} : undefined);
    assert.equal(result.status, 401, `${method} ${path}`);
  }
});

test("unregistered paths still use the Express JSON 404 handler", async () => {
  const result = await request("/api/auth/route-audit-missing", "POST", {});
  assert.equal(result.status, 404);
  assert.equal(result.body.message, "Route not found");
});
