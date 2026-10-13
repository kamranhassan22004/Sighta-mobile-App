const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const { install } = require("./modelDouble");
const User = require("../models/User");
const Device = require("../models/Device");
const Location = require("../models/Location");
const LiveLocation = require("../models/LiveLocation");
const Alert = require("../models/Alert");
const DeviceEvent = require("../models/DeviceEvent");
const auth = require("../controllers/authController");
const sharing = require("../controllers/deviceSharingController");
const devices = require("../controllers/deviceController");
const locations = require("../controllers/locationController");
const alerts = require("../controllers/alertController");
const events = require("../controllers/deviceEventController");
const { deviceSOS } = require("../controllers/deviceSOSController");
const { notifyDeviceGuardians } = require("../services/pushNotificationService");
const { getAuthorizedDevice, deviceView } = require("../services/deviceAccessService");

process.env.JWT_SECRET = "isolated-test-signing-key";
process.env.CRON_SECRET = "isolated-test-scheduler";
const stores = new Map([User, Device, Location, LiveLocation, Alert, DeviceEvent].map(Model => [Model.modelName, install(Model)]));
const nativeFetch = global.fetch;
const pushes = [];
let failedToken = null;
global.fetch = async (url, options) => {
  if (url !== "https://exp.host/--/api/v2/push/send") throw new Error("Unexpected external network call");
  const payload = JSON.parse(options.body);
  pushes.push(payload);
  if (payload.to === failedToken) throw new Error("Simulated delivery failure");
  return { ok: true, json: async () => ({ data: { status: "ok", id: "test-ticket" } }) };
};
const call = async (handler, user, body = {}, params = {}, headers = {}) => {
  const req = { user, body, params, query: {}, headers, get: name => headers[name.toLowerCase()] };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = JSON.parse(JSON.stringify(data)); return this; } };
  await handler(req, res);
  return res;
};
const read = (handler, user) => call(handler, user, {}, { userId: String(user._id) });
const createAccount = async (name, phone) => {
  const result = await call(auth.registerUser, null, { name, email: `${name.toLowerCase()}@example.test`, phone, password: "test-password" });
  assert.equal(result.code, 201);
  assert.equal(result.data.phone, phone.trim());
  return User.findById(result.data._id);
};
let mother, father, stranger, device, server, origin;
const deviceKey = "synthetic-device-key";

before(async () => {
  mother = await createAccount("Mother", " +923001234567 ");
  father = await createAccount("Father", "+923009876543");
  stranger = await createAccount("Stranger", "+923001111111");
  mother.dependent = { name: "Child", relationship: "Mother" };
  father.dependent = { name: "Child", relationship: "Father" };
  mother.fcmToken = "ExpoPushToken[test-mother]";
  father.fcmToken = "ExpoPushToken[test-father]";
  stranger.fcmToken = "ExpoPushToken[test-stranger]";
  await mother.save(); await father.save(); await stranger.save();
  device = await Device.create({ deviceId: "TEST-PI-001", owner: mother._id,
    apiKeyHash: crypto.createHash("sha256").update(deviceKey).digest("hex") });
  mother.device = device._id; await mother.save();
  const app = express(); app.use(express.json());
  app.use("/auth", require("../routes/authRoutes"));
  app.use("/device", require("../routes/deviceRoutes"));
  app.use("/location", require("../routes/locationRoutes"));
  app.use("/alerts", require("../routes/alertRoutes"));
  app.use("/offline", require("../routes/deviceOfflineRoutes"));
  app.use("/summary", require("../routes/dailySummaryRoutes"));
  for (const name of ["OfflineAlert", "OfflineGuardianDelivery", "DailySummaryLog"]) stores.set(name, install(mongoose.model(name)));
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { global.fetch = nativeFetch; await new Promise(resolve => server.close(resolve)); });
const http = async (path, token, method = "GET", body) => {
  const response = await nativeFetch(origin + path, { method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { code: response.status, data: await response.json() };
};

test("registration, phone validation, edit persistence and complete private profiles", async () => {
  const invalid = await call(auth.registerUser, null, { name: "Bad", email: "bad@example.test", password: "test", phone: "invalid" });
  assert.equal(invalid.code, 400);
  const updated = await call(auth.updateProfile, father, { phone: " +923002222222 " });
  assert.equal(updated.code, 200); assert.equal(updated.data.phone, "+923002222222");
  assert.equal((await User.findById(mother._id)).phone, "+923001234567");
  const a = await call(auth.getProfile, mother), b = await call(auth.getProfile, father);
  assert.equal(a.data.dependent.relationship, "Mother");
  assert.equal(b.data.dependent.relationship, "Father");
  assert.equal(b.data.phone, "+923002222222"); assert.equal(b.data.device, null);
  for (const profile of [a.data, b.data]) {
    for (const secret of ["password", "fcmToken", "resetCodeHash", "resetCodeExpires"]) assert.equal(profile[secret], undefined);
  }
});

test("authenticated login A/B/A returns the correct complete profile", async () => {
  for (const account of [mother, father, mother]) {
    const login = await http("/auth/login", null, "POST", { email: account.email, password: "test-password" });
    assert.equal(login.code, 200);
    assert.equal(login.data.phone, (await User.findById(account._id)).phone);
    const profile = await http("/auth/profile", login.data.token);
    assert.equal(profile.data._id, String(account._id));
    assert.equal(profile.data.email, account.email);
    assert.equal(profile.data.phone, (await User.findById(account._id)).phone);
  }
});

test("secure owner invitation requires recipient acceptance; knowing device ID grants no access", async () => {
  assert.equal((await call(devices.getDeviceStatus, father, {}, { deviceId: device.deviceId })).code, 404);
  assert.equal((await call(sharing.inviteGuardian, father, { email: stranger.email }, { deviceId: device.deviceId })).code, 404);
  assert.equal((await call(sharing.inviteGuardian, mother, { email: father.email }, { deviceId: device.deviceId })).code, 201);
  assert.equal((await call(sharing.acceptInvitation, stranger, {}, { deviceId: String(device._id) })).code, 404);
  assert.equal(await getAuthorizedDevice(father), null);
  assert.equal((await call(sharing.acceptInvitation, father, {}, { deviceId: String(device._id) })).code, 200);
  assert.equal(String((await getAuthorizedDevice(father))._id), String(device._id));
  assert.equal(stores.get("Device").length, 1);
});

test("one authenticated Pi GPS update is shared without duplicate physical records", async () => {
  const headers = { "x-device-key": deviceKey };
  const payload = { deviceId: device.deviceId, latitude: 31.5, longitude: 74.3 };
  assert.equal((await call(locations.deviceUpdateLocation, null, payload, {}, { "x-device-key": "wrong" })).code, 401);
  assert.equal((await call(locations.deviceUpdateLocation, null, { ...payload, latitude: 1000 }, {}, headers)).code, 400);
  assert.equal((await call(locations.deviceUpdateLocation, null, payload, {}, headers)).code, 200);
  assert.equal((await call(locations.deviceUpdateLocation, null, payload, {}, headers)).code, 200);
  assert.equal(stores.get("LiveLocation").length, 1); assert.equal(stores.get("Location").length, 1);
  for (const account of [mother, father]) {
    const location = await read(locations.getCurrentLocation, account);
    assert.equal(location.code, 200); assert.equal(location.data.latitude, 31.5);
    assert.equal((await read(locations.getLocationHistory, account)).data.length, 1);
    assert.equal((await read(events.getDeviceEvents, account)).data.length, 1);
  }
  assert.equal((await read(locations.getCurrentLocation, stranger)).code, 404);
  assert.deepEqual((await read(locations.getLocationHistory, stranger)).data, []);
  assert.equal((await call(locations.getCurrentLocation, stranger, {}, { userId: String(mother._id) })).code, 403);
});

test("heartbeat expiration and reconnection preserve guardian membership and hide cached online status", async () => {
  const row = stores.get("Device")[0];
  row.lastSyncedAt = new Date(Date.now() - 16000);
  for (const account of [mother, father]) {
    const result = await call(devices.getDeviceStatus, account, {}, { deviceId: device.deviceId });
    assert.equal(result.data.status, "offline"); assert.equal(result.data.apiKeyHash, undefined);
    assert.equal(result.data.guardians, undefined); assert.equal(result.data.invitations, undefined);
    assert.equal((await call(auth.getProfile, account)).data.device.status, "offline");
  }
  assert.equal(row.guardians.length, 1);
  row.lastSyncedAt = new Date(); row.status = "online";
  assert.equal(deviceView(await Device.findById(device._id)).status, "online");
  row.lastSyncedAt = new Date(Date.now() + 60000);
  assert.equal(deviceView(await Device.findById(device._id)).status, "offline");
  row.lastSyncedAt = new Date();
});

test("one SOS event fans out to authorized guardians; read status is individual", async () => {
  pushes.length = 0;
  assert.equal((await call(deviceSOS, null, { deviceId: device.deviceId }, {}, { "x-device-key": "wrong" })).code, 401);
  const result = await call(deviceSOS, null, { deviceId: device.deviceId }, {}, { "x-device-key": deviceKey });
  assert.equal(result.code, 201); assert.equal(result.data.locationAvailable, true);
  assert.equal(pushes.length, 2); assert.equal(stores.get("Alert").length, 1);
  assert.ok(pushes.every(push => push.to !== stranger.fcmToken));
  const a = await read(alerts.getAlerts, mother), b = await read(alerts.getAlerts, father);
  assert.equal(a.data[0]._id, b.data[0]._id); assert.deepEqual((await read(alerts.getAlerts, stranger)).data, []);
  assert.equal((await call(alerts.markAlertRead, father, {}, { alertId: result.data.alertId })).data.isRead, true);
  assert.equal((await read(alerts.getAlerts, mother)).data[0].isRead, false);
  assert.equal((await call(alerts.markAlertRead, stranger, {}, { alertId: result.data.alertId })).code, 404);
});

test("SOS opt-out preserves visible history; one failed delivery does not block another", async () => {
  await User.updateOne({ _id: father._id }, { $set: { "notificationSettings.sosAlerts": false } });
  pushes.length = 0;
  await call(deviceSOS, null, { deviceId: device.deviceId }, {}, { "x-device-key": deviceKey });
  assert.equal(pushes.length, 1); assert.equal(pushes[0].to, mother.fcmToken);
  assert.equal((await read(alerts.getAlerts, father)).data.length, 2);
  await User.updateOne({ _id: father._id }, { $set: { "notificationSettings.sosAlerts": true } });
  failedToken = mother.fcmToken; pushes.length = 0;
  const result = await call(deviceSOS, null, { deviceId: device.deviceId }, {}, { "x-device-key": deviceKey });
  assert.equal(result.code, 201); assert.equal(result.data.pushAccepted, true); assert.equal(pushes.length, 2);
  failedToken = null;
});

test("low battery uses existing crossing threshold and owner-only update rights", async () => {
  pushes.length = 0;
  assert.equal((await call(devices.updateDevice, father, { batteryPercentage: 19 }, { deviceId: device.deviceId })).code, 404);
  assert.equal((await call(devices.updateDevice, mother, { batteryPercentage: 20 }, { deviceId: device.deviceId })).code, 200);
  assert.equal(pushes.length, 0);
  assert.equal((await call(devices.updateDevice, mother, { batteryPercentage: 19 }, { deviceId: device.deviceId })).code, 200);
  assert.equal(pushes.length, 2);
  await call(devices.updateDevice, mother, { batteryPercentage: 18 }, { deviceId: device.deviceId });
  assert.equal(pushes.length, 2);
});

test("daily activity is shared; scheduler respects preferences, auth and daily deduplication", async () => {
  for (const account of [mother, father]) {
    const login = await call(auth.loginUser, null, { email: account.email, password: "test-password" });
    const result = await http("/summary/activity", login.data.token);
    assert.equal(result.code, 200); assert.equal(result.data.gpsUpdates, 1); assert.equal(result.data.sosAlerts, 3);
    await User.updateOne({ _id: account._id }, { $set: { "notificationSettings.dailySummary": true } });
  }
  assert.equal((await http("/summary/run")).code, 401);
  pushes.length = 0;
  const first = await http("/summary/run", process.env.CRON_SECRET);
  assert.equal(first.data.notificationsSent, 2); assert.equal(pushes.length, 2);
  const second = await http("/summary/run", process.env.CRON_SECRET);
  assert.equal(second.data.notificationsSent, 0); assert.equal(pushes.length, 2);
});

test("offline scheduler preserves two-minute timeout and deduplicates per guardian with retries", async () => {
  assert.equal((await http("/offline/offline")).code, 401);
  const row = stores.get("Device")[0]; row.lastSyncedAt = new Date(Date.now() - 119000);
  pushes.length = 0;
  assert.equal((await http("/offline/offline", process.env.CRON_SECRET)).data.notificationsSent, 0);
  row.lastSyncedAt = new Date(Date.now() - 121000);
  failedToken = mother.fcmToken;
  const first = await http("/offline/offline", process.env.CRON_SECRET);
  assert.equal(first.data.notificationsSent, 1); assert.equal(pushes.length, 2);
  failedToken = null;
  const second = await http("/offline/offline", process.env.CRON_SECRET);
  assert.equal(second.data.notificationsSent, 1); assert.equal(pushes.length, 3);
  assert.equal((await http("/offline/offline", process.env.CRON_SECRET)).data.notificationsSent, 0);
});

test("revocation blocks protected reads and future pushes without changing Pi credentials", async () => {
  assert.equal((await call(sharing.revokeGuardian, father, {}, { deviceId: device.deviceId, guardianId: String(mother._id) })).code, 404);
  const hash = stores.get("Device")[0].apiKeyHash;
  assert.equal((await call(sharing.revokeGuardian, mother, {}, { deviceId: device.deviceId, guardianId: String(father._id) })).code, 200);
  assert.equal((await call(auth.getProfile, father)).data.device, null);
  assert.equal((await call(devices.getDeviceStatus, father, {}, { deviceId: device.deviceId })).code, 404);
  assert.equal((await read(locations.getCurrentLocation, father)).code, 404);
  assert.deepEqual((await read(locations.getLocationHistory, father)).data, []);
  assert.deepEqual((await read(events.getDeviceEvents, father)).data, []);
  assert.deepEqual((await read(alerts.getAlerts, father)).data, []);
  assert.equal((await call(sharing.acceptInvitation, father, {}, { deviceId: String(device._id) })).code, 404);
  pushes.length = 0;
  await call(deviceSOS, null, { deviceId: device.deviceId }, {}, { "x-device-key": deviceKey });
  assert.equal(pushes.length, 1); assert.equal(pushes[0].to, mother.fcmToken);
  assert.equal(stores.get("Device")[0].apiKeyHash, hash);
});

test("registration stays owner-only and never duplicates an existing physical device", async () => {
  assert.equal((await call(devices.registerDevice, stranger, { deviceId: device.deviceId })).code, 409);
  assert.equal((await call(devices.rotateDeviceKey, father, {}, { deviceId: device.deviceId })).code, 404);
  assert.equal(stores.get("Device").length, 1);
  const result = await call(devices.registerDevice, stranger, { deviceId: "TEST-NEW-PI" });
  assert.equal(result.code, 201); assert.ok(result.data.deviceKey); assert.equal(result.data.apiKeyHash, undefined);
});

test("push registration transfers a phone token and logout cleanup preserves other accounts", async () => {
  await call(auth.updateProfile, father, { fcmToken: mother.fcmToken });
  assert.equal((await User.findById(mother._id)).fcmToken, null);
  await call(auth.updateProfile, father, { fcmToken: null });
  assert.equal((await User.findById(father._id)).fcmToken, null);
  assert.equal((await User.findById(stranger._id)).fcmToken, stranger.fcmToken);
});

test("expired and revoked pending invitations cannot authorize an account", async () => {
  assert.equal((await call(sharing.inviteGuardian, mother, { email: father.email }, { deviceId: device.deviceId })).code, 201);
  const invitation = stores.get("Device")[0].invitations.find(i => String(i.guardian) === String(father._id));
  invitation.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await call(sharing.acceptInvitation, father, {}, { deviceId: String(device._id) })).code, 404);
  assert.equal((await call(sharing.inviteGuardian, mother, { email: father.email }, { deviceId: device.deviceId })).code, 201);
  await call(sharing.revokeGuardian, mother, {}, { deviceId: device.deviceId, guardianId: String(father._id) });
  assert.equal((await call(sharing.acceptInvitation, father, {}, { deviceId: String(device._id) })).code, 404);
});

test("legacy owner history and alert read status are preserved without sharing personal info alerts", async () => {
  await Location.create({ user: mother._id, latitude: 30, longitude: 70, address: "Test legacy address" });
  assert.equal((await read(locations.getLocationHistory, mother)).data.length, 2);
  const legacy = await Alert.create({ user: mother._id, device: device._id, type: "sos", message: "Legacy SOS", isRead: true });
  const personal = await Alert.create({ user: mother._id, device: device._id, type: "info", message: "Private account information" });
  await call(sharing.inviteGuardian, mother, { email: father.email }, { deviceId: device.deviceId });
  await call(sharing.acceptInvitation, father, {}, { deviceId: String(device._id) });
  assert.equal((await read(locations.getLocationHistory, father)).data.length, 2);
  const own = (await read(alerts.getAlerts, mother)).data, shared = (await read(alerts.getAlerts, father)).data;
  assert.equal(own.find(a => a._id === String(legacy._id)).isRead, true);
  assert.equal(shared.find(a => a._id === String(legacy._id)).isRead, false);
  assert.equal(shared.some(a => a._id === String(personal._id)), false);
});

test("password-reset JWTs cannot be used as normal authenticated guardian sessions", async () => {
  const jwt = require("jsonwebtoken");
  const token = jwt.sign({ id: String(mother._id), purpose: "reset" }, process.env.JWT_SECRET);
  assert.equal((await http("/auth/profile", token)).code, 401);
});
