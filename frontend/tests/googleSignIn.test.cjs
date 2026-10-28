const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load({ sdk = {}, platform = "android", ownership = "standalone", clientId = "test-web-client", nativeAvailable = true } = {}) {
  const calls = [];
  const google = {
    configure: value => calls.push(["configure", value]),
    hasPlayServices: async () => { calls.push(["playServices"]); },
    hasPreviousSignIn: () => true,
    signOut: async () => { calls.push(["signOut"]); },
    signIn: async () => ({ type: "success", data: { idToken: "verified-by-backend-only" } }),
    ...sdk,
  };
  const module = { exports: {} };
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, "../src/services/googleSignIn.js"), "utf8"), {
    babelrc: false, configFile: false, plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  }).code;
  vm.runInNewContext(code, { module, exports: module.exports,
    process: { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: clientId } },
    require: name => {
      if (name === "expo-constants") return { appOwnership: ownership };
      if (name === "react-native") return { Platform: { OS: platform } };
      if (!nativeAvailable) throw new Error("Missing native module");
      return { GoogleSignin: google, statusCodes: { SIGN_IN_CANCELLED: "cancel", IN_PROGRESS: "busy", PLAY_SERVICES_NOT_AVAILABLE: "play" } };
    } });
  return { run: module.exports.getGoogleIdentityToken, calls };
}

test("Google native sign-in uses the Web audience and returns only the identity token", async () => {
  const app = load();
  assert.equal(await app.run(), "verified-by-backend-only");
  assert.equal(app.calls[0][1].webClientId, "test-web-client");
  assert.equal(app.calls[0][1].offlineAccess, false);
  assert.deepEqual(app.calls.slice(1).map(call => call[0]), ["playServices", "signOut"]);
});
test("account chooser cancellation returns safely without starting an app session", async () => {
  assert.equal(await load({ sdk: { signIn: async () => ({ type: "cancelled" }) } }).run(), null);
  assert.equal(await load({ sdk: { signIn: async () => { throw { code: "cancel" }; } } }).run(), null);
});
test("in-progress native sign-in does not create a second app session", async () => {
  assert.equal(await load({ sdk: { signIn: async () => { throw { code: "busy" }; } } }).run(), null);
});
test("native failures and missing identity tokens produce helpful errors", async () => {
  await assert.rejects(load({ sdk: { hasPlayServices: async () => { throw { code: "play" }; } } }).run(), /update Google Play Services/);
  await assert.rejects(load({ sdk: { signIn: async () => { throw new Error("offline"); } } }).run(), /Check your connection/);
  await assert.rejects(load({ sdk: { signIn: async () => ({ type: "success", data: {} }) } }).run(), /Google sign-in could not complete/);
});
test("missing configuration, old binaries and Expo Go are rejected before authentication", async () => {
  await assert.rejects(load({ clientId: "" }).run(), /not configured/);
  await assert.rejects(load({ nativeAvailable: false }).run(), /new SIGHTA Android build/);
  await assert.rejects(load({ ownership: "expo" }).run(), /not available in Expo Go/);
});
