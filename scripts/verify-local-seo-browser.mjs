import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const chrome=process.env.CHROME_PATH;
if(!chrome)throw new Error('CHROME_PATH required');
const profile=await mkdtemp('/tmp/technest-seo-cdp-');
const child=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1','--remote-debugging-port=19222',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const results=[];let errors=[];let httpErrors=[];
try{
 let targets;for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:19222/json')).json();break}catch{await pause(100)}}
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let nextId=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(new Error(m.error.message)):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description||''));else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)httpErrors.push({url:m.params.response.url,status:m.params.response.status});};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 const wait=async predicate=>{for(let i=0;i<150;i++){if(await evaluate(predicate))return;await pause(200)}throw new Error('Browser render timeout: '+predicate)};
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable');
 for(const width of [390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  for(const path of ['/','/products/keychron-k2-pro','/categories/keyboards','/brands/keychron']){
   errors=[];httpErrors=[];
   await send('Page.navigate',{url:'http://127.0.0.1:4173'+path});
   await wait("!!document.querySelector('header') && !!document.querySelector('h1')");
   await pause(1600);
   const state=await evaluate(`({title:document.title,canonical:document.querySelector('link[rel="canonical"]')?.href,h1:[...document.querySelectorAll('h1')].map(x=>x.textContent),rootChildren:document.querySelector('#root').children.length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(x=>JSON.parse(x.textContent)['@graph']||[]).map(x=>x['@type']),brokenLoadedImages:[...document.images].filter(x=>x.complete&&x.naturalWidth===0&&x.currentSrc).map(x=>x.currentSrc)})`);
   assert.ok(state.canonical?.startsWith('https://seo-validation.example.test'));assert.ok(state.h1.length===1,JSON.stringify({path,...state,errors}));assert.equal(errors.length,0);assert.ok(state.scrollWidth<=width+1,'horizontal overflow '+path);
   results.push({width,path,...state,exceptions:[...errors],httpErrors:[...httpErrors],result:'PASS'});console.log('BROWSER',width,path,'PASS');
  }
 }
 await send('Page.navigate',{url:'http://127.0.0.1:4173/categories/keyboards'});await wait("!!document.querySelector('header') && !!document.querySelector('a[href^=\"/products/\"]')");
 const target=await evaluate(`document.querySelector('a[href^="/products/"]').getAttribute('href')`);
 await evaluate(`document.querySelector('a[href^="/products/"]').click()`);
 await wait(`location.pathname===${JSON.stringify(target.split('?')[0])} && !!document.querySelector('h1')`);
 await pause(1000);await wait("document.querySelector('link[rel=\"canonical\"]')?.href.includes(location.pathname)");
 await evaluate('history.back()');await wait("location.pathname==='/categories/keyboards'");await wait("document.querySelector('link[rel=\"canonical\"]')?.href==='https://seo-validation.example.test/categories/keyboards'");
 results.push({interaction:'category → product link → browser Back',target,canonical:await evaluate("document.querySelector('link[rel=\"canonical\"]')?.href"),result:'PASS'});
 await evaluate('history.forward()');await wait(`location.pathname===${JSON.stringify(target.split('?')[0])}`);
 await wait(`document.querySelector('link[rel="canonical"]')?.href===${JSON.stringify('https://seo-validation.example.test'+target.split('?')[0])}`);
 results.push({interaction:'browser Forward → product',target,canonical:await evaluate("document.querySelector('link[rel=\"canonical\"]')?.href"),result:'PASS'});

 await writeFile(new URL('../docs/technest-local-seo-browser-results.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),browser:'Chromium 130 headless; CDP; guest, read-only data',results},null,2));
}finally{ws?.close();child.kill('SIGTERM');await pause(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
