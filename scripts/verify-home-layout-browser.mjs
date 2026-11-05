import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { openBrowser, pause } from "./browser-cdp.mjs";

const base = (process.env.TECHNEST_URL || "http://localhost:4176").replace(/\/$/, "");
const directory = resolve(process.env.TECHNEST_SCREENSHOTS || "/tmp/technest-ui-verified");
await mkdir(directory, { recursive: true });
const browser = await openBrowser({ port: 19245 });
const results = [];
const metrics = () =>
  browser.evaluate(`(() => {
  const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
  const frame = document.querySelector('.home-content');
  const rail = document.querySelector('#products .home-product-carousel');
  const cards = [...rail.querySelectorAll('.product-card')];
  return {
    viewport: innerWidth, pageWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    frame: rect(frame), rail: { ...rect(rail), clientWidth:rail.clientWidth, scrollWidth:rail.scrollWidth, display:getComputedStyle(rail).display },
    sections:[...frame.querySelectorAll(':scope > section')].map(el => ({className:el.className,...rect(el)})),
    headerActions:rect(document.querySelector('.header-actions')),
    cards:cards.map(el => ({...rect(el),title:rect(el.querySelector('h3')),price:rect(el.querySelector('.product-price-row strong')),image:rect(el.querySelector('.product-image-wrap')),button:rect(el.querySelector('.add-cart-button')),buttonClipped:el.querySelector('.add-cart-button').scrollHeight>el.querySelector('.add-cart-button').clientHeight+1})),
    images:[...document.images].filter(el=>el.getBoundingClientRect().width>0 && el.complete && el.currentSrc).map(el=>({src:el.currentSrc,loaded:el.naturalWidth>0})),
    styles:[...document.styleSheets].map(s=>s.href).filter(Boolean),
    colors:{accent:getComputedStyle(frame).getPropertyValue('--ui-accent').trim(),font:getComputedStyle(document.body).fontFamily}
  };
})()`);

function verifyLayout(data, width) {
  assert.equal(data.viewport, width);
  assert.ok(data.scrollWidth <= data.pageWidth + 1, `Page overflow at ${width}px`);
  const expected = Math.min(1500, data.pageWidth - (width <= 760 ? 32 : 40));
  assert.ok(
    Math.abs(data.frame.width - expected) < 2,
    `Canvas must fill available width: ${data.frame.width}/${expected}`,
  );
  assert.ok(data.rail.width <= data.frame.width + 1, "Carousel must stay inside its section");
  assert.equal(data.rail.display, "flex");
  assert.ok(data.cards.length > 0, "Real catalog cards required");
  for (const card of data.cards) {
    assert.ok(card.width >= 150, `Collapsed product card: ${card.width}px`);
    assert.ok(
      card.title.width >= 110 && card.title.height <= 65,
      "Title must remain a normal two-line label",
    );
    assert.ok(
      card.image.width > 100 && card.image.height > 80,
      "Product image must have usable dimensions",
    );
    for (const [label, element] of [
      ["price", card.price],
      ["button", card.button],
    ]) {
      assert.ok(
        element.x >= card.x - 1 && element.right <= card.right + 1,
        `${label} clipped horizontally`,
      );
      assert.ok(element.bottom <= card.bottom + 1, `${label} clipped vertically`);
    }
    assert.equal(card.buttonClipped, false, "Purchase button text must be visible");
  }
  assert.ok(data.headerActions.right <= data.pageWidth + 1, "Header actions overflow the viewport");
  for (const section of data.sections)
    assert.ok(section.width <= data.frame.width + 1, `Section overflow: ${section.className}`);
  assert.deepEqual(
    data.images.filter((image) => !image.loaded),
    [],
    "Visible product images must load",
  );
}

try {
  await browser.send("Network.setCacheDisabled", { cacheDisabled: true });
  await browser.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  for (const width of [375, 768, 1024, 1440]) {
    browser.errors.length = 0;
    browser.consoleErrors.length = 0;
    browser.responses.length = 0;
    browser.networkFailures.length = 0;
    await browser.viewport(width);
    await browser.navigate(base);
    await browser.wait(
      "document.querySelectorAll('#products .product-card').length > 0",
      "real homepage catalog",
      45000,
    );
    await browser.evaluate("document.fonts.ready");
    // Trigger lazy images throughout the real page before taking screenshots.
    await browser.evaluate(
      "(async () => {for(let y=0;y<document.body.scrollHeight;y+=700){window.scrollTo({top:y,behavior:'instant'});await new Promise(r=>setTimeout(r,80))}window.scrollTo({top:0,behavior:'instant'})})()",
    );
    await pause(500);
    const data = await metrics();
    verifyLayout(data, width);
    await browser.screenshot(`${directory}/${width}-top.png`);
    await browser.evaluate(
      "window.scrollTo({top:scrollY+document.querySelector('#products').getBoundingClientRect().top-document.querySelector('.site-header').getBoundingClientRect().height-16,behavior:'instant'})",
    );
    await pause(150);
    await browser.screenshot(`${directory}/${width}-products.png`);

    await browser.click("#products .home-carousel-controls button:last-child");
    await browser.wait(
      "document.querySelector('#products .home-product-carousel').scrollLeft>20",
      "carousel next control",
    );
    await pause(400);
    await browser.click("#products .home-carousel-controls button:first-child");
    await browser.wait(
      "document.querySelector('#products .home-product-carousel').scrollLeft<5",
      "carousel previous control",
    );

    await browser.evaluate(
      "[...document.querySelectorAll('.quick-category')].find(el=>el.textContent.includes('Bàn phím')).click()",
    );
    await browser.wait(
      "location.pathname.startsWith('/categories/') && document.querySelectorAll('.product-card').length>0",
      "category navigation and catalog",
    );
    await browser.evaluate("history.back()");
    await browser.wait(
      "location.pathname==='/' && document.querySelectorAll('#products .product-card').length>0",
      "return to homepage",
    );
    verifyLayout(await metrics(), width);

    // Lazy admin CSS remains loaded after client-side navigation; it must not resize the storefront.
    await browser.evaluate(
      "(()=>{const a=document.createElement('a');a.href='/admin';document.body.append(a);a.click();a.remove()})()",
    );
    await browser.wait("!!document.querySelector('.admin-login-card')", "anonymous admin login");
    await browser.evaluate("history.back()");
    await browser.wait(
      "location.pathname==='/' && document.querySelectorAll('#products .product-card').length>0",
      "home after lazy admin CSS",
    );
    verifyLayout(await metrics(), width);

    assert.deepEqual(browser.errors, [], "Uncaught browser exceptions");
    assert.deepEqual(browser.consoleErrors, [], "Browser console errors");
    const failed = browser.responses.filter(
      (r) => new URL(r.url).origin === new URL(base).origin && r.status >= 400,
    );
    assert.deepEqual(failed, [], "Same-origin HTTP errors, including CSS and JavaScript");
    assert.deepEqual(
      browser.networkFailures.filter((r) => !r.canceled),
      [],
      "Failed network resources",
    );
    const assets = browser.responses.filter((r) => /\.(css|js)(\?|$)/.test(r.url));
    assert.ok(
      assets.some((a) => a.url.includes("/assets/") && a.url.endsWith(".css")),
      "Production CSS asset required",
    );
    assert.ok(
      assets.some((a) => a.url.includes("/assets/") && a.url.endsWith(".js")),
      "Production JavaScript asset required",
    );
    results.push({
      width,
      result: "PASS",
      ...data,
      assets,
      consoleErrors: [...browser.consoleErrors],
      checks: [
        "canvas",
        "card dimensions",
        "images/prices/buttons",
        "carousel controls",
        "category navigation",
        "lazy CSS isolation",
        "assets",
        "no overflow",
      ],
    });
    await writeFile(
      `${directory}/results.json`,
      JSON.stringify({ base, checkedAt: new Date().toISOString(), results }, null, 2),
    );
    console.log(
      `PASS ${base} ${width}px: canvas=${data.frame.width.toFixed(1)} card=${data.cards[0].width.toFixed(1)}; carousel/categories/assets/console OK`,
    );
  }
} finally {
  await browser.close();
}
