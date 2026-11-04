import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {loadEnv} from '../backend/dist/config/env.js';
import {createDatabase} from '../backend/dist/config/database.js';
import {eligibleProductSql,createSeoRepository} from '../backend/dist/modules/seo/seo.repository.js';
const base='http://127.0.0.1:4173',origin='https://seo-validation.example.test';
const {pool}=createDatabase(loadEnv().DATABASE_URL);
const report={checkedAt:new Date().toISOString(),base,canonicalOrigin:origin,checks:[],api:[],sitemaps:[]};
const dir='/tmp/technest-local-seo-evidence'; await mkdir(dir,{recursive:true});
const unescape=s=>s?.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
async function get(path){const r=await fetch(base+path,{redirect:'manual'});return {r,body:await r.text()};}
try{
 assert.equal((await pool.query('select current_database() name')).rows[0].name,'technest_dev');
 const p=(await pool.query(`select p.id::text,p.slug,p.name,c.slug category,b.slug brand from products p join categories c on c.id=p.category_id join brands b on b.id=p.brand_id where ${eligibleProductSql} order by p.id limit 1`)).rows[0];
 report.product=p;
 const paths=['/',`/products/${p.slug}`,`/categories/${p.category}`,`/brands/${p.brand}`,'/products?page=2','/products?sort=priceLow','/products/nonexistent-seo-verification','/categories/nonexistent-seo-verification','/brands/nonexistent-seo-verification','/nonexistent-seo-verification','/admin','/account','/checkout','/cart','/login','/flash-sale'];
 for(const [i,path] of paths.entries()){
  const {r,body}=await get(path);
  const title=unescape(/<title[^>]*>(.*?)<\/title>/.exec(body)?.[1]);
  const meta=name=>unescape(new RegExp(`<meta[^>]*(?:name|property)="${name}"[^>]*content="([^"]*)"`).exec(body)?.[1]);
  const canonical=unescape(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/.exec(body)?.[1]);
  const schemas=[...body.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>JSON.parse(m[1])['@graph']);
  assert.equal(r.status,path.includes('nonexistent')?404:200,path);
  assert.ok(title&&meta('description')&&meta('robots'),path);
  assert.equal((body.match(/<title\b/g)||[]).length,1);
  if(!['/admin','/account','/checkout','/cart','/login'].includes(path)) assert.equal((body.match(/<h1\b/g)||[]).length,1,path);
  if(i<4){assert.ok(canonical?.startsWith(origin));assert.ok(meta('og:title')&&meta('og:description')&&meta('og:image')&&meta('twitter:image'));assert.ok(schemas.length);assert.ok(body.includes('technest-seo-state'));}
  if(['/admin','/account','/checkout','/cart','/login'].includes(path)){assert.ok(meta('robots').includes('noindex'));assert.ok(r.headers.get('x-robots-tag').includes('noindex'));assert.equal(schemas.length,0);}
  if(path==='/products?page=2')assert.equal(canonical,origin+'/products?page=2');
  if(path.includes('sort='))assert.ok(meta('robots').includes('noindex'));
  if(path===`/products/${p.slug}`){
   const api=await (await fetch(`${base}/api/v1/products/${p.id}`)).json();const product=api.data;
   const v=product.variants.find(v=>v.status==='ACTIVE');const sale=await createSeoRepository(pool).sale(v.id);
   const offer=schemas.find(s=>s['@type']==='Product').offers;
   assert.equal(Number(offer.price),Number(sale?.price??v.price??product.price));assert.equal(offer.priceCurrency,'VND');
   assert.equal(offer.availability,v.inStock?'https://schema.org/InStock':'https://schema.org/OutOfStock');
   report.offer={schema:offer,apiVariant:{id:v.id,price:v.price,inStock:v.inStock,availableQuantity:v.availableQuantity},activeSale:sale??null};
   const other=await fetch(base+path,{headers:{'User-Agent':'Googlebot'}});assert.equal(await other.text(),body);
  }
  await writeFile(`${dir}/page-${i}.html`,body);
  report.checks.push({path,status:r.status,title,description:meta('description'),canonical,robots:meta('robots'),headerRobots:r.headers.get('x-robots-tag'),ogTitle:meta('og:title'),ogImage:meta('og:image'),schemaTypes:schemas.map(s=>s['@type']),result:'PASS'});
 }
 for(const [path,location] of [[`/products/${p.id}`,`/products/${p.slug}`],[`/products/${p.slug}/`,`/products/${p.slug}`],[`/products?category=${p.category}`,`/categories/${p.category}`],['/index.html','/']]){
  const {r}=await get(path);assert.equal(r.status,308);assert.equal(r.headers.get('location'),location);report.checks.push({path,status:r.status,location,result:'PASS'});
 }
 const robots=await get('/robots.txt');assert.equal(robots.r.status,200);assert.ok(robots.body.includes('Sitemap: '+origin+'/sitemap.xml'));report.robots=robots.body;
 const index=await get('/sitemap.xml');assert.equal(index.r.status,200);await writeFile(dir+'/index.xml',index.body);
 const shards=[...index.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 for(const [i,url] of shards.entries()){const {r,body}=await get(new URL(url).pathname);assert.equal(r.status,200);await writeFile(`${dir}/shard-${i}.xml`,body);report.sitemaps.push({url,status:r.status});}
 report.xml=JSON.parse(execFileSync('python3',['-c',`import xml.etree.ElementTree as E,glob,json,sys
ns='{http://www.sitemaps.org/schemas/sitemap/0.9}';urls=[]
for f in glob.glob(sys.argv[1]+'/shard-*.xml'):
 root=E.parse(f).getroot();assert root.tag==ns+'urlset';loc=[n.text for n in root.iter(ns+'loc')];assert len(loc)<=1000;urls+=loc
assert E.parse(sys.argv[1]+'/index.xml').getroot().tag==ns+'sitemapindex'
assert len(urls)==len(set(urls));assert all(u.startswith('https://seo-validation.example.test/') for u in urls)
assert all(not any(x in u for x in ['/admin','/account','/checkout','/login','/cart','tn-curated-','catalog-']) for u in urls)
print(json.dumps({'validXml':True,'urls':len(urls),'duplicates':0}))`,dir],{encoding:'utf8'}));
 for(const [path,status] of [['/api/v1/products?limit=2',200],['/api/v1/products/'+p.id,200],['/api/v1/categories',200],['/api/v1/brands?limit=2',200],['/api/v1/homepage/config',200],['/api/v1/banners?placement=hero',200],['/api/v1/flash-sales',200],['/api/v1/admin/products',401],['/api/v1/not-existing-seo',404]]){
 const {r,body}=await get(path);assert.equal(r.status,status,path);assert.ok(r.headers.get('content-type').includes('json'),path);JSON.parse(body);report.api.push({path,status:r.status,result:'PASS'});
 }
 const {body:html}=await get('/');const assetPaths=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
 report.assets=[];for(const path of assetPaths){const {r}=await get(path);assert.equal(r.status,200);assert.ok(r.headers.get('cache-control').includes('immutable'));report.assets.push({path,status:r.status,type:r.headers.get('content-type')});}
 report.persistedUnpublishedProducts=Number((await pool.query("select count(*) from products where status<>'ACTIVE'")).rows[0].count);
 report.result='PASS';await writeFile(new URL('../docs/technest-local-seo-http-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await pool.end()}
