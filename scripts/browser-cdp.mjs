import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import process from "node:process";

export const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

/** Dependency-free browser harness. Assertions use rendered DOM, never a mock React tree. */
export async function openBrowser({ port = 19223 } = {}) {
  const chrome = process.env.CHROME_PATH || "/home/minhchien/.cache/ms-playwright/chromium-1140/chrome-linux/chrome";
  const profile = await mkdtemp("/tmp/technest-browser-");
  const child = spawn(chrome, ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let socket;
  const errors = [];
  const responses = [];
  const networkFailures = [];
  const requestUrls = new Map();
  try {
    let target;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((entry) => entry.type === "page"); if (target) break; } catch { /* Chrome is starting. */ }
      await pause(100);
    }
    if (!target) throw new Error("Chromium did not expose CDP; check CHROME_PATH and LD_LIBRARY_PATH");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (!request) return;
        clearTimeout(request.timeout);
        if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
      } else if (message.method === "Runtime.exceptionThrown") {
        errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      } else if (message.method === "Network.responseReceived") {
        responses.push({ url: message.params.response.url, status: message.params.response.status });
      } else if (message.method === "Network.requestWillBeSent") {
        requestUrls.set(message.params.requestId, message.params.request.url);
      } else if (message.method === "Network.loadingFailed") {
        networkFailures.push({ url: requestUrls.get(message.params.requestId), error: message.params.errorText, canceled: message.params.canceled });
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      pending.set(requestId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = async (expression, description = expression, timeout = 30000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await pause(100); }
      throw new Error(`Browser assertion timed out: ${description}; page=${await evaluate("location.href")}`);
    };
    await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
    return {
      send, evaluate, wait, errors, responses, networkFailures,
      viewport: (width, height = 900) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 }),
      navigate: (url) => send("Page.navigate", { url }),
      fill: (selector, value) => evaluate(`(() => { const field=document.querySelector(${JSON.stringify(selector)});if(!field)throw new Error('Missing input '+${JSON.stringify(selector)});const prototype=field instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event(field instanceof HTMLSelectElement?'change':'input',{bubbles:true}));return field.value;})()`),
      click: (selector) => evaluate(`(() => {const target=document.querySelector(${JSON.stringify(selector)});if(!target)throw new Error('Missing button '+${JSON.stringify(selector)});target.click();})()`),
      screenshot: async (path) => { const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(path, Buffer.from(result.data, "base64")); },
      close: async () => { socket?.close(); child.kill("SIGTERM"); await pause(300); await rm(profile, { recursive: true, force: true }); },
    };
  } catch (error) { socket?.close(); child.kill("SIGTERM"); await rm(profile, { recursive: true, force: true }); throw error; }
}
