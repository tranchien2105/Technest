import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { openBrowser, pause } from "./browser-cdp.mjs";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const { config } = require("dotenv");
const { Pool } = require("pg");
config({ path: new URL("../.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Local development only");
if (
  !["127.0.0.1", "localhost"].includes(process.env.SMTP_HOST || "127.0.0.1") ||
  Number(process.env.SMTP_PORT || 1025) !== 1025
)
  throw new Error("Browser verification requires local Mailpit SMTP on port 1025");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const origin = process.env.RESET_BROWSER_ORIGIN || "http://localhost:5173";
const api = process.env.RESET_BROWSER_API || "http://localhost:3000/api/v1";
const inbox = "http://127.0.0.1:8025";
const email = `reset-browser-${crypto.randomUUID()}@example.test`;
const password = "browser-old-password-123";
const nextPassword = "browser-new-password-456";
let browser;
let userId;
const messageIds = new Set();
async function post(path, body) {
  return fetch(api + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function messages() {
  const data = await (await fetch(`${inbox}/api/v1/messages`)).json();
  return (data.messages || []).filter((message) => message.To?.some((to) => to.Address === email));
}
try {
  const registered = await post("/auth/register", { email, password });
  assert.equal(registered.status, 201);
  const credentials = (await registered.json()).data;
  userId = credentials.user.id;
  browser = await openBrowser({ port: 19231 });
  await browser.navigate(origin + "/forgot-password");
  await browser.wait('Boolean(document.querySelector("input[name=email]"))');
  await browser.fill('input[name="email"]', email);
  await browser.click(".auth-submit");
  await browser.wait('document.querySelector(".form-success")?.textContent.includes("15")');
  let resetMessage;
  for (let i = 0; i < 30; i++) {
    const found = await messages();
    found.forEach((message) => messageIds.add(message.ID));
    resetMessage = found.find((message) => message.Subject.includes("Đặt lại"));
    if (resetMessage) break;
    await pause(200);
  }
  assert.ok(resetMessage, "Reset email captured in Mailpit");
  const message = await (await fetch(`${inbox}/api/v1/message/${resetMessage.ID}`)).json();
  const link = message.Text.match(/http[^\s]+\/reset-password#token=[A-Za-z0-9_-]+/)?.[0];
  assert.ok(link, "Reset link uses a fragment");
  await browser.navigate(link);
  await browser.wait('Boolean(document.querySelector("input[name=confirmPassword]"))');
  assert.ok(!(await browser.evaluate('document.querySelector(".auth-submit").disabled')));
  await browser.fill('input[name="password"]', nextPassword);
  await browser.fill('input[name="confirmPassword"]', "different-password-123");
  await browser.click(".auth-submit");
  await browser.wait('document.querySelector(".form-error")?.textContent.includes("khớp")');
  await browser.fill('input[name="confirmPassword"]', nextPassword);
  await browser.click(".auth-submit");
  await browser.wait('document.querySelector(".form-success")?.textContent.includes("cập nhật")');
  assert.ok(await browser.evaluate('Boolean(document.querySelector(".auth-reset-success"))'));
  assert.equal(
    await browser.evaluate('document.querySelectorAll("input[type=password]").length'),
    0,
  );
  assert.equal((await post("/auth/login", { email, password })).status, 401);
  assert.equal(
    (
      await fetch(api + "/auth/me", {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      })
    ).status,
    401,
  );
  await browser.click(".auth-reset-success .auth-submit");
  await browser.wait('Boolean(document.querySelector("input[name=email]"))');
  await browser.fill('input[name="email"]', email);
  await browser.fill('input[name="password"]', nextPassword);
  await browser.click(".auth-submit");
  await browser.wait('location.pathname === "/account"');
  await browser.navigate(link);
  await browser.wait('Boolean(document.querySelector("input[name=confirmPassword]"))');
  await browser.fill('input[name="password"]', nextPassword);
  await browser.fill('input[name="confirmPassword"]', nextPassword);
  await browser.click(".auth-submit");
  await browser.wait('document.querySelector(".form-error")?.textContent.includes("hết hạn")');
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token");
  const escapedRequests = browser.responses.filter(
    (response) =>
      !response.url.startsWith(origin + "/reset-password#") && response.url.includes(token),
  );
  assert.equal(escapedRequests.length, 0, "Token does not appear in HTTP request URLs");
  assert.equal(browser.errors.length, 0, "No browser runtime exceptions");
  console.log(
    "PASS: forgot-password UI → SMTP/Mailpit → reset UI → mismatch → reset → old password/access rejection → new login → link reuse rejection; no token in HTTP URLs.",
  );
} finally {
  if (browser) await browser.close();
  if (userId) await pool.query("DELETE FROM users WHERE id=$1", [userId]);
  for (const message of await messages()) messageIds.add(message.ID);
  for (const id of messageIds)
    await fetch(`${inbox}/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: [id] }),
    });
  await pool.end();
}
