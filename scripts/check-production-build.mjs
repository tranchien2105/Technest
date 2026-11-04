import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function assertProductionRuntime(bundle) {
  for (const marker of ['runWithFiberInDEV','react-dom-client.development.js','react_stack_bottom_frame']) {
    if (bundle.includes(marker)) throw new Error(`Development React runtime in production bundle: ${marker}`);
  }
}
export async function checkProductionBuild(directory) {
  const html=await readFile(resolve(directory,'index.html'),'utf8');
  const assets=[...html.matchAll(/<script[^>]+src="\/?([^\"]+\.js)"/g)].map(match=>match[1]);
  if(!assets.length)throw new Error('Built HTML has no JavaScript entry');
  for(const asset of assets)assertProductionRuntime(await readFile(resolve(directory,asset),'utf8'));
  return assets;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await checkProductionBuild(process.argv[2]||'dist');console.log('Production React runtime: PASS');
}
