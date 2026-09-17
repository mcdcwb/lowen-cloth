import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createAuthApi, validateLogin, validateRegistration } from "../src/app/lib/auth.ts";
import { createAuthSession, AUTH_STORAGE_KEY, LEGACY_USER_KEY } from "../src/app/lib/auth-session.ts";

const account = { id: 1, name: "Cliente", email: "test@example.test", role: "USER" };
const token = randomBytes(24).toString("hex");
const session = { accessToken: token, expiresAt: Date.now() + 900000, account };
const loginBody = { accessToken: token, tokenType: "Bearer", expiresIn: 900, account };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test("login and registration validation match backend boundaries", () => {
  assert.ok(validateLogin(account.email, ""));
  assert.equal(validateLogin(account.email, "a"), null);
  assert.equal(validateLogin(account.email, "a".repeat(128)), null);
  assert.ok(validateLogin(account.email, "a".repeat(129)));
  assert.ok(validateRegistration({ name: "A", email: account.email, password: "12345" }));
  assert.ok(validateRegistration({ name: "Cliente", email: account.email, password: "1234" }));
  assert.equal(validateRegistration({ name: "Cliente", email: account.email, password: "12345" }), null);
});

test("shared login validates the returned role and token with /auth/me", async () => {
  const calls = [];
  const api = createAuthApi("/api", async (url, init) => {
    calls.push({ url, init });
    return json(url.endsWith("/login") ? loginBody : { account });
  });
  const result = await api.login(" TEST@example.test ", "password");
  assert.deepEqual(result.account, account);
  assert.equal(calls[0].url, "/api/auth/login");
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: account.email, password: "password" });
  assert.equal(calls[1].init.headers.Authorization, "Bearer " + token);
});

test("registration posts only public account fields and does not create a session", async () => {
  let sent;
  const api = createAuthApi("/api", async (_url, init) => {
    sent = JSON.parse(init.body);
    return json({ account }, 201);
  });
  assert.deepEqual(await api.register({ name: " Cliente ", email: " TEST@example.test ", password: "12345" }), account);
  assert.deepEqual(sent, { name: "Cliente", email: account.email, password: "12345" });
});

test("connection refusal never becomes a successful login", async () => {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  await assert.rejects(createAuthApi("http://127.0.0.1:" + port).login(account.email, "x"), { code: "unavailable" });
});

test("credential, conflict, service and rate-limit failures are distinguished", async () => {
  for (const [status, code] of [[401, "unauthorized"], [409, "conflict"], [500, "unavailable"], [429, "rate_limit"], [403, "forbidden"]]) {
    await assert.rejects(createAuthApi("/api", async () => json({}, status)).login(account.email, "x"), { code });
  }
});

test("malformed identities and mismatched /me roles are rejected", async () => {
  for (const invalid of [{}, { ...account, role: "OWNER" }, { ...account, name: "" }]) {
    await assert.rejects(createAuthApi("/api", async () => json({ ...loginBody, account: invalid })).login(account.email, "x"), { code: "invalid_response" });
  }
  await assert.rejects(createAuthApi("/api", async url => json(url.endsWith("/login") ? loginBody : { account: { ...account, role: "ADMIN" } })).login(account.email, "x"), { code: "invalid_response" });
});

test("local mock users are removed and never restore a session", async () => {
  const storage = memoryStorage(); const legacy = memoryStorage();
  legacy.setItem(LEGACY_USER_KEY, JSON.stringify(account));
  const auth = createAuthSession({ me: async () => { throw new Error("Must not run"); } }, () => storage, () => legacy);
  await auth.restore();
  assert.equal(auth.getSnapshot().session, null);
  assert.equal(legacy.getItem(LEGACY_USER_KEY), null);
});

test("restoration requires /auth/me and gets identity from the server", async () => {
  const storage = memoryStorage();
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, account: { ...account, role: "ADMIN" } }));
  const auth = createAuthSession({ me: async received => { assert.equal(received, token); return account; } }, () => storage, () => memoryStorage());
  await auth.restore();
  assert.deepEqual(auth.getSnapshot().session.account, account);
});

test("failed restoration and logout clear persisted token", async () => {
  const storage = memoryStorage(); storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  const auth = createAuthSession({ me: async () => { throw new Error("Connection failed"); } }, () => storage, () => memoryStorage());
  await auth.restore();
  assert.equal(auth.getSnapshot().session, null);
  assert.equal(storage.getItem(AUTH_STORAGE_KEY), null);
});

test("login persists only token and expiry", async () => {
  const storage = memoryStorage();
  const auth = createAuthSession({ login: async () => session }, () => storage, () => memoryStorage());
  assert.equal(await auth.login(account.email, "x"), true);
  assert.deepEqual(JSON.parse(storage.getItem(AUTH_STORAGE_KEY)), { accessToken: token, expiresAt: session.expiresAt });
});
