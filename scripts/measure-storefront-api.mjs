import {writeFile} from 'node:fs/promises';
const origin=process.env.MEASURE_ORIGIN||'http://127.0.0.1:4173';
const results=[];
for(const path of ['/api/v1/products?sort=newest&limit=24','/api/v1/products?sort=newest&limit=24&page=2','/api/v1/products?category=mice&limit=24','/api/v1/products/keychron-k2-pro','/api/v1/brands?limit=30&paginated=1','/api/v1/homepage/config','/api/v1/flash-sales']){
 const samples=[];let count=null;
 for(let index=0;index<5;index++){
  const started=performance.now(),response=await fetch(origin+path,{signal:AbortSignal.timeout(15000)}),body=await response.text();
  samples.push({status:response.status,ms:Math.round((performance.now()-started)*100)/100,bytes:Buffer.byteLength(body)});
  if(response.ok){const json=JSON.parse(body);count=json.data?.pagination?.total??json.data?.items?.length??null;}
 }
 const ordered=samples.map(s=>s.ms).sort((a,b)=>a-b);
 results.push({path,count,samples,medianMs:ordered[2],p95Ms:ordered[4],result:samples.every(s=>s.status===200)?'PASS':'FAIL'});
}
const report={checkedAt:new Date().toISOString(),origin,method:'5 serial HTTP samples per route on local WSL; no concurrency/load test; p95 nearest-rank=max for n=5, not a production SLO',results};
await writeFile(new URL('../docs/technest-api-timing-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
