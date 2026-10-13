const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const transform = file => babel.transformSync(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
  babelrc: false, configFile: false,
  plugins: [
    require.resolve("@babel/plugin-transform-modules-commonjs"),
    require.resolve("@babel/plugin-transform-react-jsx"),
  ],
}).code;
const account = id => ({ _id: id, name: id, email: `${id}@example.test`, phone: id === "A" ? "+923001234567" : "+923009876543",
  dependent: { name: "Child", relationship: id === "A" ? "Mother" : "Father" },
  notificationSettings: { sosAlerts: id === "A", dailySummary: false }, device: { _id: "device", status: "offline" } });

// Lightweight hook harness exercises the actual AuthProvider with async service/storage doubles.
const mount = async (saved = {}, configure = () => {}) => {
  const slots = [], effects = [], pending = [], storage = new Map(Object.entries(saved));
  let cursor = 0, rendering = false, scheduled = false, provider, exported;
  const timers = [], logs = [], calls = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; render(); });
  };
  const React = {
    createContext: () => ({ Provider: "Provider" }),
    createElement: (type, props) => ({ type, props }),
    useContext: () => null,
    useState: initial => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, next => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (Object.is(value, slots[index].value)) return;
        slots[index].value = value; schedule();
      }];
    },
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: (callback, deps) => {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect: (callback, deps) => {
      const index = cursor++;
      if (!effects[index] || !same(effects[index].deps, deps)) pending.push(() => {
        effects[index]?.cleanup?.();
        effects[index] = { deps, cleanup: callback() };
      });
    },
  };
  const asyncStorage = {
    getItem: async key => storage.get(key) || null,
    setItem: async (key, value) => { storage.set(key, value); },
    multiSet: async pairs => { for (const [key, value] of pairs) storage.set(key, value); },
    multiRemove: async keys => { for (const key of keys) storage.delete(key); },
  };
  const services = {
    __esModule: true,
    login: async email => ({ _id: email, token: `token-${email}` }),
    register: async payload => ({ _id: payload.name, token: `token-${payload.name}` }),
    getProfile: async token => { calls.push(["profile", token]); return account(token.replace("token-", "")); },
    updateProfile: async (payload, token) => { calls.push(["update", payload, token]); },
  };
  const sessions = { changeSession() {}, setSessionToken() {} };
  configure(services);
  const module = { exports: {} };
  vm.runInNewContext(transform("src/context/AuthContext.js"), {
    module, exports: module.exports,
    require: name => {
      if (name === "react") return React;
      if (name.includes("async-storage")) return asyncStorage;
      if (name.includes("authService")) return services;
      if (name.includes("sessionState")) return sessions;
      if (name.includes("pushNotificationService")) return { registerPushNotifications: async () => null };
      throw new Error(`Unexpected module ${name}`);
    },
    console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    requestAnimationFrame: fn => { queueMicrotask(fn); return 1; }, cancelAnimationFrame() {},
    setInterval: fn => { timers.push(fn); return timers.length; }, clearInterval() {},
  });
  exported = module.exports;
  const render = () => {
    if (rendering) return;
    rendering = true; cursor = 0;
    provider = exported.AuthProvider({ children: null }).props.value;
    rendering = false;
    while (pending.length) pending.shift()();
  };
  render(); await flush();
  return { get context() { return provider; }, storage, services, asyncStorage, calls, timers, cleanup() { effects.forEach(effect => effect?.cleanup?.()); } };
};

test("fresh login waits for the full profile before publishing context and storage", async () => {
  const app = await mount();
  const profile = deferred(); app.services.getProfile = () => profile.promise;
  const login = app.context.login("A", "password"); await flush();
  assert.equal(app.context.user, null); assert.equal(app.storage.has("token"), false);
  profile.resolve(account("A")); await login; await flush();
  assert.equal(app.context.user.phone, "+923001234567");
  assert.equal(app.context.user.dependent.relationship, "Mother");
  assert.equal(JSON.parse(app.storage.get("user")).email, "A@example.test");
  assert.equal(app.storage.get("token"), "token-A"); app.cleanup();
});

test("A/logout/B/logout/A isolates all profile fields and uses explicit logout token", async () => {
  const app = await mount();
  for (const id of ["A", "B", "A"]) {
    await app.context.login(id, "password"); await flush();
    assert.equal(app.context.user._id, id); assert.equal(app.context.user.phone, account(id).phone);
    assert.equal(app.context.user.dependent.relationship, account(id).dependent.relationship);
    await app.context.logout(); await flush();
    assert.equal(app.context.user, null); assert.equal(app.storage.has("user"), false);
    assert.equal(app.storage.has("token"), false);
    const last = app.calls.at(-1); assert.equal(last[0], "update"); assert.equal(last[2], `token-${id}`);
  }
  app.cleanup();
});

test("late Account A refresh cannot overwrite Account B or restore cleared storage", async () => {
  const app = await mount(); await app.context.login("A", "password"); await flush();
  const old = deferred(); app.services.getProfile = token => token === "token-A" ? old.promise : Promise.resolve(account("B"));
  const refresh = app.context.refreshProfile();
  await app.context.logout(); await app.context.login("B", "password"); await flush();
  old.resolve(account("A")); await refresh; await flush();
  assert.equal(app.context.user._id, "B"); assert.equal(JSON.parse(app.storage.get("user"))._id, "B");
  assert.equal(app.storage.get("token"), "token-B"); app.cleanup();
});

test("overlapping logins only publish the latest requested account", async () => {
  const app = await mount(), old = deferred();
  app.services.getProfile = token => token === "token-A" ? old.promise : Promise.resolve(account("B"));
  const loginA = app.context.login("A", "password"); const rejected = assert.rejects(loginA, /session changed/);
  await flush(); await app.context.login("B", "password");
  old.resolve(account("A")); await rejected; await flush();
  assert.equal(app.context.user._id, "B"); assert.equal(JSON.parse(app.storage.get("user"))._id, "B"); app.cleanup();
});

test("signup fetches complete profile; refresh callback stays stable across account updates", async () => {
  const app = await mount(); const refresh = app.context.refreshProfile;
  await app.context.register({ name: "B", phone: account("B").phone }); await flush();
  assert.equal(app.context.user.phone, account("B").phone); assert.equal(app.context.refreshProfile, refresh);
  await refresh(); await flush(); assert.equal(app.context.refreshProfile, refresh); app.cleanup();
});

test("a refresh started after an edit wins over an older in-flight refresh", async () => {
  const app = await mount(); await app.context.login("A", "password"); await flush();
  const old = deferred(), latest = { ...account("A"), phone: "+923003333333" };
  let number = 0; app.services.getProfile = () => ++number === 1 ? old.promise : Promise.resolve(latest);
  const first = app.context.refreshProfile(); await app.context.refreshProfile();
  old.resolve(account("A")); await first; await flush();
  assert.equal(app.context.user.phone, latest.phone); assert.equal(JSON.parse(app.storage.get("user")).phone, latest.phone); app.cleanup();
});

test("restored session loads the server profile rather than merging cached personal fields", async () => {
  const app = await mount({ token: "token-B", user: JSON.stringify({ ...account("A"), stalePrivateField: "old" }) });
  assert.equal(app.context.user._id, "B"); assert.equal(app.context.user.stalePrivateField, undefined);
  assert.equal(app.context.isLoading, false); assert.equal(app.context.loadingProgress, 100); app.cleanup();
});

test("Axios honors explicit credentials and rejects late successful responses after account changes", async () => {
  const sessionsModule = { exports: {} };
  vm.runInNewContext(transform("src/api/sessionState.js"), { module: sessionsModule, exports: sessionsModule.exports });
  const sessions = sessionsModule.exports;
  let request, response, failure;
  class CanceledError extends Error {}
  const fakeAxios = { CanceledError, create: () => ({ interceptors: {
    request: { use: fn => { request = fn; } }, response: { use: (fn, error) => { response = fn; failure = error; } },
  } }) };
  const module = { exports: {} };
  vm.runInNewContext(transform("src/api/axiosConfig.js"), {
    module, exports: module.exports,
    require: name => name === "axios" ? fakeAxios : name.includes("sessionState") ? sessions : { getItem: async () => null },
  });
  sessions.changeSession("token-A");
  const config = await request({ headers: { Authorization: "Bearer token-B" } });
  assert.equal(config.headers.Authorization, "Bearer token-B");
  sessions.changeSession("token-B"); await assert.rejects(response({ config, data: account("A") }), /session changed/);
  await assert.rejects(failure({ config, response: { status: 401 } }), /session changed/);
  const fresh = await request({ headers: {} }); assert.equal(fresh.headers.Authorization, "Bearer token-B");
});

test("expired restored sessions clear storage while transient failures never trust cached online status", async () => {
  const saved = { token: "token-A", user: JSON.stringify({ ...account("A"), token: "token-A", device: { _id: "device", status: "online", connectivity: { wifi: true } } }) };
  const expired = await mount(saved, service => { service.getProfile = async () => { throw { response: { status: 401 } }; }; });
  assert.equal(expired.context.user, null); assert.equal(expired.storage.size, 0); expired.cleanup();
  const offline = await mount(saved, service => { service.getProfile = async () => { throw new Error("Network unavailable"); }; });
  assert.equal(offline.context.user.device.status, "offline"); assert.equal(offline.context.user.device.connectivity.wifi, false);
  offline.cleanup();
  const mismatch = await mount({ ...saved, token: "token-B" }, service => { service.getProfile = async () => { throw new Error("Network unavailable"); }; });
  assert.equal(mismatch.context.user, null); assert.equal(mismatch.storage.size, 0); mismatch.cleanup();
});

test("logout serializes against an already-started storage write and prevents session resurrection", async () => {
  const app = await mount(); await app.context.login("A", "password"); await flush();
  const write = deferred(); let started = false;
  const original = app.asyncStorage.setItem;
  app.asyncStorage.setItem = async (key, value) => { started = true; await write.promise; await original(key, value); };
  const refresh = app.context.refreshProfile(); await flush(); assert.equal(started, true);
  const logout = app.context.logout(); await flush(); assert.equal(app.context.user, null);
  write.resolve(); await Promise.all([refresh, logout]); await flush();
  assert.equal(app.storage.size, 0); assert.equal(app.context.user, null); app.cleanup();
});

test("late unauthorized refresh from a previous session cannot log out the new account", async () => {
  const app = await mount(); await app.context.login("A", "password"); await flush();
  const old = deferred(); app.services.getProfile = token => token === "token-A" ? old.promise : Promise.resolve(account("B"));
  const refresh = app.context.refreshProfile();
  await app.context.logout(); await app.context.login("B", "password");
  old.reject({ response: { status: 401 } }); assert.equal(await refresh, null); await flush();
  assert.equal(app.context.user._id, "B"); app.cleanup();
});
