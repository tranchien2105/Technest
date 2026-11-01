import test from "node:test";
import assert from "node:assert/strict";

for (const role of ["CUSTOMER", "ADMIN"]) {
  test(`reload restores the ${role} session in the shape consumed by App`, async (t) => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "technest_csrf=test-csrf-cookie" },
    });
    t.after(() => {
      if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
      else delete globalThis.document;
    });

    const user = { id: 42, email: "session@example.test", fullName: "Test User", role, status: "ACTIVE" };
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
      calls.push({ url, options });
      assert.equal(options.credentials, "include");
      if (url.endsWith("/auth/refresh")) {
        assert.equal(options.method, "POST");
        assert.equal(options.headers["X-CSRF-Token"], "test-csrf-cookie");
        return Response.json({ success: true, data: { accessToken: "restored-access-token", csrfToken: "rotated-csrf-token", user } });
      }
      assert.ok(url.endsWith("/auth/me"));
      assert.equal(options.headers.Authorization, "Bearer restored-access-token");
      return Response.json({ success: true, data: user });
    });

    // A fresh module models F5: memory is empty, the browser cookie remains.
    const auth = await import(`../src/api/authClient.js?reload=${role}`);
    assert.equal(auth.getAccessToken(), null);
    assert.equal(auth.hasRefreshSession(), true);
    const pending = auth.restoreSession();
    assert.equal(auth.restoreSession(), pending);
    const session = await pending;
    assert.deepEqual(session?.user, user);
    assert.equal(auth.getAccessToken(), "restored-access-token");
    assert.equal(calls.length, 2);
  });
}
