import {readFile,writeFile,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const directory=process.env.SEO_LIGHTHOUSE_DIR||'docs/evidence/performance/after';
const dist=process.env.STOREFRONT_AUDIT_DIST||'/tmp/technest-local-seo-dist';
const before=JSON.parse(await readFile('docs/evidence/performance/before-home-mobile.json','utf8'));
function summarize(report,raw){
 const value=id=>report.audits[id]?.numericValue??null;
 return {url:report.finalDisplayedUrl,measuredAt:report.fetchTime,lighthouse:report.lighthouseVersion,browser:report.environment.hostUserAgent,
  scores:Object.fromEntries(Object.entries(report.categories).map(([key,item])=>[key,item.score===null?null:Math.round(item.score*100)])),
  metrics:{LCPms:value('largest-contentful-paint'),TBTms:value('total-blocking-time'),CLS:value('cumulative-layout-shift')},
  warnings:report.runWarnings||[],runtimeError:report.runtimeError??null,
  consoleErrors:report.audits['errors-in-console']?.details?.items||[],
  httpErrors:report.audits['network-requests']?.details?.items.filter(item=>item.statusCode>=400).map(item=>({url:item.url,status:item.statusCode}))||[],
  gathererErrors:Object.values(report.audits).filter(item=>item.scoreDisplayMode==='error').map(item=>({id:item.id,error:item.errorMessage})),raw};
}
const runs=[];
for(const page of ['home','product','category','brand'])for(const device of ['mobile','desktop']){
 const raw=`${directory}/${page}-${device}-final.json`;
 runs.push({page,device,...summarize(JSON.parse(await readFile(raw,'utf8')),raw)});
}
const html=await readFile(`${dist}/index.html`,'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(item=>item[1]);
const sizes=[];
for(const asset of assets){const content=await readFile(dist+asset);sizes.push({asset,bytes:(await stat(dist+asset)).size,gzipBytes:gzipSync(content).length});}
const result={checkedAt:new Date().toISOString(),method:'Actual Lighthouse loopback lab navigation; mobile simulated throttling and desktop preset. WSL CPU/network warnings retained. Not field CWV or a controlled production benchmark.',baseline:{page:'home',device:'mobile',...summarize(before,'docs/evidence/performance/before-home-mobile.json'),entryJSBytes:566609,entryCSSBytes:201436,note:'Baseline had React DEV and one catalog request HTTP500. Compare alongside warnings, not as a clean causal benchmark.'},runs,assets:sizes};
await writeFile('docs/technest-performance-results.json',JSON.stringify(result,null,2));
await writeFile('docs/technest-local-seo-lighthouse-results.json',JSON.stringify({status:'ACTUALLY MEASURED AFTER FIXES',...result},null,2));
const rows=runs.map(run=>`| ${run.page} | ${run.device} | ${run.scores.performance??'N/A'} | ${run.scores.accessibility??'N/A'} | ${run.scores['best-practices']??'N/A'} | ${run.scores.seo??'N/A'} | ${run.metrics.LCPms==null?'N/A':(run.metrics.LCPms/1000).toFixed(2)} | ${run.metrics.TBTms==null?'N/A':Math.round(run.metrics.TBTms)} | ${run.metrics.CLS==null?'N/A':run.metrics.CLS.toFixed(3)} |`);
const table=['| Trang | Thiết bị | Performance | Accessibility | Best Practices | SEO | LCP (s) | TBT (ms) | CLS |','| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',...rows].join('\n');
const warnings=runs.filter(run=>run.warnings.length||run.consoleErrors.length||run.httpErrors.length||run.gathererErrors.length).map(run=>`- ${run.page}/${run.device}: ${[...run.warnings, ...run.consoleErrors.map(item=>item.description),...run.httpErrors.map(item=>`HTTP ${item.status} ${item.url}`),...run.gathererErrors.map(item=>`${item.id}: ${item.error}`)].join(' ')}`).join('\n');
const section=`## 7. Lighthouse Mobile/Desktop — đo thực tế\n\nChạy mới sau sửa build React production, ngày 04/11/2026; raw JSON giữ trong \`${directory}\`. Đây là lab WSL, không phải field CWV/INP. Baseline Homepage Mobile 22/100 có React DEV và API 500; không coi là benchmark kiểm soát sạch.\n\n${table}\n\n${warnings||'Không có cảnh báo được Lighthouse ghi trong các lượt này.'}\n\nBằng chứng: \`docs/technest-performance-results.json\`. N/A là lỗi gatherer/metric thiếu, không tự chấm PASS.\n\n`;
let audit=await readFile('docs/technest-local-seo-audit.md','utf8');audit=audit.replace(/## 7\. Lighthouse[\s\S]*?(?=## 8\.)/,section);
audit=audit.replace(/Luồng category → click product → browser Back:[^\n]+/,'Luồng category → click product → browser Back/Forward: kiểm tra canonical đích sau mỗi lần điều hướng. Kết quả thực tế xem `docs/technest-local-seo-browser-results.json`.');
await writeFile('docs/technest-local-seo-audit.md',audit);
console.log(JSON.stringify({runs:runs.length,scores:runs.map(run=>({page:run.page,device:run.device,...run.scores})),assets:sizes},null,2));
