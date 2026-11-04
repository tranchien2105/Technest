import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import console from "node:console";
import { openBrowser, pause } from "./browser-cdp.mjs";

const base = process.env.E2E_BASE || "http://127.0.0.1:4175";
const fixture = await (await fetch(`${base}/__e2e/fixture`)).json();
const phase = process.env.MOBILE_PHASE || "before";
const artifacts = `/tmp/technest-mobile-${phase}`;
await mkdir(artifacts, { recursive: true });
const browser = await openBrowser();
const results = [];
try {
  await browser.viewport(390);
  await browser.navigate(`${base}/login`);
  await browser.wait("!!document.querySelector('.auth-form input[name=email]')");
  await browser.fill(".auth-form input[name=email]", fixture.credentials.email);
  await browser.fill(".auth-form input[name=password]", fixture.credentials.password);
  await browser.click(".auth-form button[type=submit]");
  await browser.wait("location.pathname==='/account' && document.body.innerText.includes('Browser E2E Customer')");
  await browser.navigate(`${base}/products/${fixture.slug}?variant=${fixture.variants[1].id}`);
  await browser.wait("!!document.querySelector('.detail-purchase-cart') && !document.querySelector('.detail-purchase-cart').disabled");
  await browser.click(".detail-purchase-cart");
  await browser.wait("JSON.parse(localStorage.getItem('technest-cart')||'[]').length===1");
  const cartId = await browser.evaluate("JSON.parse(localStorage.getItem('technest-cart'))[0].id");
  const pages = [
    ["home", "/"], ["listing", "/products?category=mice"], ["detail", `/products/${fixture.slug}?variant=${fixture.variants[1].id}`],
    ["cart", "/cart"], ["checkout", `/checkout?items=${encodeURIComponent(cartId)}`], ["addresses", "/account/addresses"], ["setup", "/setup"], ["flash-sale", "/flash-sale"],
  ];
  for (const width of [360, 390, 768]) {
    await browser.viewport(width);
    for (const [name, path] of pages) {
      await browser.navigate(base + path);
      await browser.wait("!!document.querySelector('header') && !!document.querySelector('h1')");
      if (name === "detail") await browser.wait("!!document.querySelector('.detail-purchase-cart')");
      if (name === "checkout") await browser.wait("!!document.querySelector('.checkout-submit')");
      if (name === "cart") await browser.wait("!!document.querySelector('.cart-page-item')");
      await pause(600);
      const state = await browser.evaluate(`(() => {
        const visible=element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&getComputedStyle(element).visibility!=='hidden'};
        const targetSelectors='.quantity-control button,.detail-purchase-cart,.detail-purchase-buy,.checkout-submit,.header-action,.catalog-pagination button,.checkout-voucher button';
        const smallTargets=[...document.querySelectorAll(targetSelectors)].filter(visible).map(element=>({selector:element.className||element.getAttribute('aria-label'),width:Math.round(element.getBoundingClientRect().width),height:Math.round(element.getBoundingClientRect().height)})).filter(rect=>rect.width<44||rect.height<44);
        const smallTextInputs=[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea')].filter(visible).filter(element=>parseFloat(getComputedStyle(element).fontSize)<16).map(element=>({field:element.name||element.getAttribute('aria-label'),fontSize:getComputedStyle(element).fontSize}));
        const ctas=[...document.querySelectorAll('.detail-purchase-cart,.detail-purchase-buy')].filter(visible).map(element=>{const rect=element.getBoundingClientRect();const x=rect.x+rect.width/2,y=rect.y+rect.height/2;const hit=document.elementFromPoint(x,y);return {label:element.innerText,visible:rect.bottom<=innerHeight+1&&rect.left>=0&&rect.right<=innerWidth+1,clickable:hit===element||element.contains(hit)}});
        return {path:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,smallTargets,smallTextInputs,ctas,brokenLoadedImages:[...document.images].filter(image=>image.complete&&image.currentSrc&&!image.naturalWidth).map(image=>image.currentSrc)};
      })()`);
      if (width === 360 || (width === 390 && ["cart", "checkout"].includes(name)) || (width === 768 && ["listing", "setup"].includes(name))) await browser.screenshot(`${artifacts}/${name}-${width}.png`);
      results.push({ page: name, ...state, result: state.overflow || state.ctas.some((cta) => !cta.visible || !cta.clickable) ? "FAIL" : "PASS" });
      console.log("MOBILE", phase, width, name, results.at(-1).result, "small targets", state.smallTargets.length, "small inputs", state.smallTextInputs.length);
    }
  }
  await writeFile(new URL(`../docs/technest-mobile-${phase}-results.json`, import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), phase, browser: "Chromium CDP; widths360/390/768; height900; guest+transaction fixture auth", base, results, exceptions: browser.errors, artifacts }, null, 2));
} finally { await browser.close(); }
