import assert from "node:assert/strict";
import { openBrowser, pause } from "./browser-cdp.mjs";

const base = process.env.TECHNEST_DEV_URL || "http://localhost:5173";
const failures = [];

// Exercise the real App, Header and AdminApp without creating database sessions.
// Only authentication and private requests are stubbed; public pages use the dev API.
function installAuthFixture(role) {
  const user = {
    id: 42,
    fullName: "Logout Fixture",
    email: "logout@example.test",
    role,
    status: "ACTIVE",
  };
  const csrf = "logout-fixture-csrf";
  const signedOutKey = "technest-logout-fixture-signed-out";
  if (!sessionStorage.getItem(signedOutKey)) {
    document.cookie = `technest_csrf=${csrf}; Path=/; SameSite=Lax`;
  }
  window.__logoutRequests = 0;
  const originalFetch = window.fetch.bind(window);
  const csrfCookie = () =>
    document.cookie.split(";").some((part) => part.trim() === `technest_csrf=${csrf}`);
  const rejected = (status = 401) =>
    Response.json(
      {
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Fixture session unavailable" },
      },
      { status },
    );
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.pathname === "/api/v1/auth/refresh") {
      if (!csrfCookie()) return rejected();
      return Response.json({
        success: true,
        data: { accessToken: "logout-fixture-access", csrfToken: csrf, user },
      });
    }
    if (url.pathname === "/api/v1/auth/me")
      return csrfCookie() ? Response.json({ success: true, data: user }) : rejected();
    if (url.pathname === "/api/v1/auth/logout") {
      window.__logoutRequests += 1;
      if (!csrfCookie() || new Headers(options.headers).get("X-CSRF-Token") !== csrf)
        return rejected(403);
      document.cookie = "technest_csrf=; Max-Age=0; Path=/";
      sessionStorage.setItem(signedOutKey, "true");
      return Response.json({ success: true, data: { loggedOut: true } });
    }
    // Private screens may display an error; they must still allow signing out.
    if (/^\/api\/v1\/(admin|account|notifications)(\/|$)/.test(url.pathname)) return rejected(403);
    return originalFetch(input, options);
  };
}

const scenarios = [
  { name: "Customer header", role: "CUSTOMER", path: "/", menu: true },
  { name: "Admin storefront header", role: "ADMIN", path: "/", menu: true },
  { name: "Admin sidebar", role: "ADMIN", path: "/admin/products", menu: false },
];
const browser = await openBrowser({ port: 19235 });
try {
  await browser.viewport(1440);
  for (const scenario of scenarios) {
    let fixtureScript;
    try {
      await browser.evaluate("if (location.origin !== 'null') sessionStorage.clear()");
      await browser.send("Network.clearBrowserCookies");
      browser.errors.length = 0;
      fixtureScript = await browser.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `(${installAuthFixture})(${JSON.stringify(scenario.role)})`,
      });
      await browser.navigate(`${base}${scenario.path}`);
      if (scenario.menu) {
        await browser.wait(
          "!!document.querySelector('.account-signed-in-dot')",
          "signed-in header",
        );
        await browser.click(".account-action");
        await browser.wait("!!document.querySelector('.account-menu-logout')", "account dropdown");
        await browser.click(".account-menu-logout");
      } else {
        await browser.wait(
          "!!document.querySelector('.admin-sidebar-bottom button')",
          "signed-in admin sidebar",
        );
        await browser.click(".admin-sidebar-bottom button");
      }
      await pause(500);
      assert.equal(
        await browser.evaluate("window.__logoutRequests"),
        1,
        `${scenario.name} must send exactly one logout request`,
      );
      await browser.wait(
        "location.pathname==='/' && !!document.querySelector('.account-action') && !document.querySelector('.account-signed-in-dot')",
        "anonymous home after logout",
      );
      assert.equal(
        await browser.evaluate("document.cookie.includes('technest_csrf=')"),
        false,
        "Logout clears the session cookie",
      );
      assert.equal(
        await browser.evaluate(
          "document.body.textContent.includes('Không thể xác nhận đăng xuất')",
        ),
        false,
        "Successful logout must not show an error",
      );
      await browser.send("Page.reload");
      await browser.wait(
        "!!document.querySelector('.account-action') && !document.querySelector('.account-signed-in-dot')",
        "reload stays signed out",
      );
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await pause(200);
      assert.equal(
        await browser.evaluate("!!document.querySelector('.account-signed-in-dot')"),
        false,
        "Focus must not restore the logged-out session",
      );
      assert.deepEqual(browser.errors, [], "No uncaught browser errors");
      console.log(
        `PASS ${scenario.name}: one logout request; stays signed out after reload and focus`,
      );
    } catch (error) {
      failures.push(`${scenario.name}: ${error.message}`);
      console.error(`FAIL ${failures.at(-1)}`);
    } finally {
      if (fixtureScript)
        await browser.send("Page.removeScriptToEvaluateOnNewDocument", {
          identifier: fixtureScript.identifier,
        });
    }
  }
} finally {
  await browser.close();
}

assert.deepEqual(failures, [], "Logout browser regressions");
