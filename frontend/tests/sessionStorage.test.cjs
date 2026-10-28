const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const load = (saved = {}, secureSaved = {}) => {
  const cache = new Map(Object.entries(saved)), secure = new Map(Object.entries(secureSaved));
  const asyncStorage = {
    getItem: async key => cache.get(key) ?? null,
    setItem: async (key, value) => { cache.set(key, value); },
    removeItem: async key => { cache.delete(key); },
    multiRemove: async keys => { keys.forEach(key => cache.delete(key)); },
  };
  const secureStore = {
    __esModule: true,
    getItemAsync: async key => secure.get(key) ?? null,
    setItemAsync: async (key, value) => { secure.set(key, value); },
    deleteItemAsync: async key => { secure.delete(key); },
  };
  const module = { exports: {} };
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, "../src/api/sessionStorage.js"), "utf8"), {
    babelrc: false, configFile: false, plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  }).code;
  vm.runInNewContext(code, { module, exports: module.exports,
    require: name => name === "expo-secure-store" ? secureStore : asyncStorage });
  return { storage: module.exports.default, cache, secure, secureStore };
};
test("migrates legacy tokens and removes every profile token copy", async () => {
  const app = load({ token: "legacy", user: JSON.stringify({ _id: "A", token: "legacy" }) });
  const [token, user] = await Promise.all([app.storage.getItem("token"), app.storage.getItem("user")]);
  assert.equal(token, "legacy");
  assert.equal(JSON.parse(user).token, "legacy");
  assert.equal(app.cache.has("token"), false);
  assert.equal(JSON.parse(app.cache.get("user")).token, undefined);
  await app.storage.multiSet([["token", "new"], ["user", JSON.stringify({ _id: "B", token: "new" })]]);
  assert.equal(JSON.parse(app.cache.get("user")).token, undefined);
  assert.equal(await app.storage.getItem("token"), "new");
  await app.storage.multiRemove(["token", "user"]);
  assert.equal(app.secure.size, 0);
  assert.equal(app.cache.size, 0);
});
test("failed migration preserves the old token and retries; secure identity wins over stale cache", async () => {
  const app = load({ token: "legacy" });
  const write = app.secureStore.setItemAsync;
  app.secureStore.setItemAsync = async () => { throw new Error("Keystore unavailable"); };
  await assert.rejects(app.storage.getItem("token"), /Keystore unavailable/);
  assert.equal(app.cache.get("token"), "legacy");
  app.secureStore.setItemAsync = write;
  assert.equal(await app.storage.getItem("token"), "legacy");
  const newer = load({ token: "stale", user: JSON.stringify({ _id: "old", token: "stale" }) }, { "sighta.session.token": "current" });
  assert.equal(await newer.storage.getItem("token"), "current");
  assert.equal(newer.cache.has("token"), false);
  assert.equal(await newer.storage.getItem("user"), null);
});
