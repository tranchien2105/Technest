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
  const campaign = document.querySelector('.home-campaigns');
  const shop = campaign.querySelector('.home-campaign-shop');
  const campaignRail = shop.querySelector('.home-campaign-products');
  return {
    viewport: innerWidth, pageWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    frame: rect(frame), rail: { ...rect(rail), clientWidth:rail.clientWidth, scrollWidth:rail.scrollWidth, display:getComputedStyle(rail).display },
    sections:[...frame.querySelectorAll(':scope > section')].map(el => ({className:el.className,...rect(el)})),
    campaign:{...rect(campaign),shop:rect(shop),poster:!!campaign.querySelector('.home-campaign-poster'),columns:getComputedStyle(campaign).gridTemplateColumns,cards:[...campaignRail.querySelectorAll('.product-card')].map(el=>({...rect(el),title:rect(el.querySelector('h3')),image:rect(el.querySelector('.product-image-wrap')),price:rect(el.querySelector('.product-price-row strong')),button:rect(el.querySelector('.add-cart-button')),buttonClipped:el.querySelector('.add-cart-button').scrollHeight>el.querySelector('.add-cart-button').clientHeight+1}))},
    allRails:[...document.querySelectorAll('.home-rail-track,.home-product-carousel')].map(el=>({className:el.className,...rect(el),cards:[...el.querySelectorAll(':scope>.product-card')].map(rect)})),
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
  const expected = width >= 1200 ? Math.min(1500, data.pageWidth * 0.78) : data.pageWidth - (width <= 760 ? 32 : 40);
  assert.ok(
    Math.abs(data.frame.width - expected) < 2,
    `Centered canvas has unexpected width: ${data.frame.width}/${expected}`,
  );
  assert.ok(data.rail.width <= data.frame.width + 1, "Carousel must stay inside its section");
  assert.equal(data.rail.display, "flex");
  assert.ok(data.cards.length > 0, "Real catalog cards required");
  assert.ok(Math.abs(data.frame.x - (data.pageWidth - data.frame.width) / 2) < 2, "Canvas must be centered");
  if (!data.campaign.poster)
    assert.ok(Math.abs(data.campaign.shop.width - data.campaign.width) < 2, "Campaign without a poster must use the whole section");
  for (const rail of data.allRails) {
    assert.ok(rail.width <= data.frame.width + 1, `Rail overflow: ${rail.className}`);
    for (const card of rail.cards) assert.ok(card.width >= 150, `Collapsed card in ${rail.className}: ${card.width}`);
  }
  for (const card of [...data.cards, ...data.campaign.cards]) {
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
  for (const width of [375, 768, 1024, 1440, 1920]) {
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

    await browser.evaluate("window.scrollTo({top:scrollY+document.querySelector('.home-campaigns').getBoundingClientRect().top-document.querySelector('.site-header').getBoundingClientRect().height-16,behavior:'instant'})");
    await pause(200);
    await browser.screenshot(`${directory}/${width}-campaigns.png`);
    await browser.evaluate("window.scrollTo({top:scrollY+document.querySelector('.home-campaign-products').getBoundingClientRect().top-document.querySelector('.site-header').getBoundingClientRect().height-16,behavior:'instant'})");
    await pause(150);
    await browser.screenshot(`${directory}/${width}-campaign-products.png`);

    for (const tab of ["mice", "monitors", "accessories", "audio", "keyboards"]) {
      const index = ["keyboards", "mice", "monitors", "accessories", "audio"].indexOf(tab);
      await browser.click(`.home-campaign-tabs button:nth-child(${index + 1})`);
      await browser.wait(`document.querySelector('.home-campaign-tabs button:nth-child(${index + 1})').getAttribute('aria-selected')==='true'`, "campaign category tab");
      if (await browser.evaluate("!!document.querySelector('.home-campaign-products .product-card')")) verifyLayout(await metrics(), width);
    }
    if (await browser.evaluate("document.querySelectorAll('.home-campaign-brands button').length>1")) {
      await browser.click(".home-campaign-brands button:nth-child(2)");
      await browser.wait("document.querySelector('.home-campaign-brands button:nth-child(2)').classList.contains('is-active')", "campaign brand filter");
      verifyLayout(await metrics(), width);
      await browser.click(".home-campaign-brands button:first-child");
    }
    // Exercise banner presence/absence without changing CMS records or the database.
    await browser.evaluate("(()=>{window.technestLayoutPosters=[...document.querySelectorAll('.home-campaigns>.home-campaign-poster')];window.technestLayoutPosters.forEach(el=>el.remove())})()");
    verifyLayout(await metrics(), width);
    await browser.evaluate("(()=>{const poster=document.createElement('div');poster.className='home-campaign-poster';poster.dataset.layoutFixture='true';document.querySelector('.home-campaigns').prepend(poster)})()");
    const withPoster = await metrics();
    verifyLayout(withPoster, width);
    if (width > 760) assert.ok(withPoster.campaign.shop.width < withPoster.campaign.width - 150, "Poster must occupy its own column");
    await browser.evaluate("document.querySelector('[data-layout-fixture]').classList.add('home-campaign-poster-empty')");
    const placeholder = await metrics();
    verifyLayout(placeholder, width);
    assert.ok(Math.abs(placeholder.campaign.shop.width - placeholder.campaign.width) < 2, "Empty banner placeholder must keep products full width");
    await browser.evaluate("(()=>{document.querySelector('[data-layout-fixture]').remove();window.technestLayoutPosters.forEach(el=>document.querySelector('.home-campaigns').prepend(el));delete window.technestLayoutPosters})()");

    await browser.click(".home-campaign-shop .home-carousel-controls button:last-child");
    await browser.wait("document.querySelector('.home-campaign-products').scrollLeft>20", "campaign next control");
    await pause(400);
    await browser.click(".home-campaign-shop .home-carousel-controls button:first-child");
    await browser.wait("document.querySelector('.home-campaign-products').scrollLeft<5", "campaign previous control");

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
        "centered inset canvas",
        "all homepage rail widths",
        "campaign category tabs and brand filter",
        "campaign carousel controls",
        "banner present/absent/placeholder layouts",
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
      `PASS ${base} ${width}px: canvas=${data.frame.width.toFixed(1)} card=${data.cards[0].width.toFixed(1)} campaign=${data.campaign.cards[0].width.toFixed(1)}; carousel/categories/assets/console OK`,
    );
  }
} finally {
  await browser.close();
}
