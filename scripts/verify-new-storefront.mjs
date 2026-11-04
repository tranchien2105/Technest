import assert from "node:assert/strict";
import { writeFile, access } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { normalizeProduct } from "../src/api/apiClient.js";
import { selectFeaturedProducts } from "../src/domain/homepageSelection.js";
import { content } from "../src/data/storeContent.js";

const api = async (path) => {
  const response = await fetch(`http://127.0.0.1:3000/api/v1/${path}`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, path);
  return (await response.json()).data;
};
const arrivalData = await api("products?sort=newest&limit=24");
const featuredData = await api("products?sort=newest&page=2&limit=24");
const dealsData = await api("products?sort=newest&sale=1&limit=100");
const latestData = await api("products?sort=newest&limit=100");
const brands = await api("brands?limit=24");
const config = await api("homepage/config");
const sections = config.sections;
const manualIds = sections.featured?.productIds || [];
const selected = manualIds.length ? (await api(`products?ids=${manualIds.join(',')}&limit=24`)).items : [];
const arrivals = arrivalData.items.map(normalizeProduct);
const featured = selectFeaturedProducts([...featuredData.items,...selected].map(normalizeProduct), featuredData.items.map(normalizeProduct), sections.featured);
const occupied = new Set([...arrivalData.items,...featuredData.items].map((row)=>row.id));
const deals = dealsData.items.filter((row)=>!occupied.has(row.id));
const server = await createServer({ server:{ middlewareMode:true,watch:null,ws:false,hmr:false },optimizeDeps:{noDiscovery:true,include:[]},appType:"custom" });
try {
  const {default:NewArrivals} = await server.ssrLoadModule('/src/components/home/NewArrivalsSection.jsx');
  const {default:ProductSection} = await server.ssrLoadModule('/src/components/home/ProductSection.jsx');
  const {default:Brands} = await server.ssrLoadModule('/src/components/home/TrustedBrandsSection.jsx');
  const noop=()=>{};
  const common={language:'vi',t:content.vi,addToCart:noop,favorites:[],toggleFavorite:noop,compareIds:[],toggleCompare:noop,onViewProduct:noop};
  const arrivalHtml=renderToStaticMarkup(createElement(NewArrivals,{...common,products:arrivals.slice(0,sections['new-arrivals'].limit),cms:sections['new-arrivals']}));
  const featuredHtml=renderToStaticMarkup(createElement(ProductSection,{...common,visibleProducts:featured,categories:[],activeCategory:'all',setActiveCategory:noop,setSearch:noop,sortBy:'newest',setSortBy:noop,cms:sections.featured}));
  const brandsHtml=renderToStaticMarkup(createElement(Brands,{language:'vi',t:content.vi,brands,cms:sections['trusted-brands']}));
  assert.ok(arrivalHtml.includes(arrivals[0].name));
  assert.ok(arrivalHtml.includes('/images/storefront-curated/'));
  if (!manualIds.length) assert.ok(featuredHtml.includes(featured[0].name));
  if (!sections['trusted-brands'].brandSlugs?.length) assert.ok(brandsHtml.includes(brands[0].name));
  const curated = latestData.items.filter((row)=>row.slug.startsWith('tn-curated-20261102-'));
  assert.equal(curated.length,60);
  const images = [...new Set([...curated,...arrivalData.items,...featuredData.items,...dealsData.items].flatMap((row)=>row.images.map((image)=>image.url)).filter((url)=>url.startsWith('/images/storefront-curated/')))];
  let served=0;
  for(const image of images){
    await access(new URL(`../public${image}`,import.meta.url));
    const response=await fetch(`http://127.0.0.1:5173${image}`,{signal:AbortSignal.timeout(5000)});
    assert.equal(response.status,200,image); assert.ok(response.headers.get('content-type')?.includes('svg')); served++;
  }
  const report={verification:'Live development API + actual Homepage section React SSR; not browser E2E',curatedProducts:curated.length,newArrivalNames:arrivals.slice(0,8).map((row)=>row.name),featuredNames:featured.map((row)=>row.name),brandNames:brands.slice(0,sections['trusted-brands'].limit).map((row)=>row.name),newArrivalCount:sections['new-arrivals'].limit,manualFeaturedIds:manualIds,distinctSectionIds:new Set([...arrivals.slice(0,8),...featured,...deals.slice(0,8)].map((row)=>row.id)).size,illustrationAssetsServed:served,ssrPass:true};
  await writeFile(new URL('../docs/technest-large-seed-frontend-verification.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await server.close();}
