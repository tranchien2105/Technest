import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const folder=process.env.SEO_LIGHTHOUSE_DIR || '/tmp/technest-seo-browser';
await mkdir(folder,{recursive:true});
for(const [name,path] of [['home','/'],['product','/products/keychron-k2-pro'],['category','/categories/keyboards'],['brand','/brands/keychron']]){
 for(const device of ['mobile','desktop']){
  const args=['exec','--yes','--package=lighthouse','--','lighthouse','http://127.0.0.1:4173'+path,'--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage','--only-categories=performance,accessibility,best-practices,seo','--output=json',`--output-path=${folder}/${name}-${device}-final.json`,'--quiet'];
  if(device==='desktop')args.push('--preset=desktop');
  const result=await new Promise((resolve,reject)=>{const child=spawn('npm',args,{stdio:'inherit',env:process.env});child.once('error',reject);child.once('exit',resolve)});
  if(result!==0)throw new Error(`Lighthouse ${name}/${device}: exit ${result}`);
  console.log('LIGHTHOUSE COMPLETE',name,device);
 }
}
