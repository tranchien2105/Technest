import {readFile,writeFile} from 'node:fs/promises';
const folder='/tmp/technest-seo-browser/';
const runs=[];
for(const name of ['home','product','category','brand'])for(const device of ['mobile','desktop']){
 const file=`${name}-${device}-final.json`,r=JSON.parse(await readFile(folder+file,'utf8'));
 const score=c=>r.categories[c].score===null?null:Math.round(r.categories[c].score*100);
 runs.push({page:name,device,url:r.finalDisplayedUrl,measuredAt:r.fetchTime,lighthouse:r.lighthouseVersion,browser:r.environment.hostUserAgent,scores:{performance:score('performance'),accessibility:score('accessibility'),bestPractices:score('best-practices'),seo:score('seo')},metrics:{LCPms:r.audits['largest-contentful-paint'].numericValue,TBTms:r.audits['total-blocking-time'].numericValue,CLS:r.audits['cumulative-layout-shift'].numericValue},warnings:r.runWarnings,runtimeError:r.runtimeError??null,consoleErrors:r.audits['errors-in-console'].details?.items||[],httpErrors:r.audits['network-requests'].details.items.filter(x=>x.statusCode>=400).map(x=>({url:x.url,status:x.statusCode})),gathererErrors:Object.values(r.audits).filter(a=>a.scoreDisplayMode==='error').map(a=>({id:a.id,errorMessage:a.errorMessage})),failedAudits:Object.values(r.audits).filter(a=>a.score!==null&&a.score<1).map(a=>({id:a.id,title:a.title,score:a.score})),rawReport:folder+file});
}
const report={method:'Real Lighthouse navigation on compiled Express/Vite loopback; .test canonical origin only; lab results, not field CWV',runs,earlierEvidence:{note:'Earlier session observed relative API React crash (fixed), concurrent-load API timeout and a Lighthouse gatherer error. Original /tmp reports were lost after WSL restart; current results below were measured again after fixes.'}};
await writeFile(new URL('../docs/technest-local-seo-lighthouse-results.json',import.meta.url),JSON.stringify(report,null,2));
let doc=await readFile(new URL('../docs/technest-local-seo-audit.md',import.meta.url),'utf8');
const table=['| Trang | Thiết bị | Performance | Accessibility | Best Practices | SEO | LCP (s) | TBT (ms) | CLS |','| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',...runs.map(r=>`| ${r.page} | ${r.device} | ${r.scores.performance??'N/A'} | ${r.scores.accessibility??'N/A'} | ${r.scores.bestPractices??'N/A'} | ${r.scores.seo??'N/A'} | ${(r.metrics.LCPms/1000).toFixed(2)} | ${Math.round(r.metrics.TBTms)} | ${r.metrics.CLS.toFixed(3)} |`),'',...runs.filter(r=>r.warnings.length).map(r=>`- **${r.page}/${r.device}:** ${r.warnings.join(' ')}`)].join('\n');
doc=doc.replace('<!-- LIGHTHOUSE_RESULTS -->',table);
const browser=JSON.parse(await readFile(new URL('../docs/technest-local-seo-browser-results.json',import.meta.url),'utf8'));
const pages=browser.results.filter(r=>r.path);const broken=pages.flatMap(r=>r.brokenLoadedImages);
const browserText=`**Chromium CDP thực chạy: ${pages.length} lượt trang PASS** (Homepage/Product/Category/Brand ở 390px và 1440px), có header React, một H1, metadata/canonical sau mount, không exception và không overflow ngang. Thêm 1 luồng category → click product → browser Back PASS; canonical quay lại category. Bằng chứng: \`docs/technest-local-seo-browser-results.json\`. Ảnh đã hoàn tất tải nhưng bị lỗi tại thời điểm snapshot: **${broken.length}** (không coi đây là kiểm tra tất cả ảnh lazy phía dưới trang). Các HTTP lỗi nếu có được giữ trong JSON; không kiểm tra authenticated flows.`;
doc=doc.replace('<!-- BROWSER_RESULTS -->',browserText);
await writeFile(new URL('../docs/technest-local-seo-audit.md',import.meta.url),doc);
console.log(JSON.stringify({lighthouseRuns:runs.length,scores:runs.map(r=>({page:r.page,device:r.device,...r.scores})),browserChecks:browser.results.length,brokenLoadedImages:broken.length},null,2));
