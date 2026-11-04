import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnv } from "../backend/src/config/env.ts";
import { createDatabase } from "../backend/src/config/database.ts";
import { createCatalogService } from "../backend/src/modules/catalog/catalog.service.ts";
import { createSeoRepository } from "../backend/src/modules/seo/seo.repository.ts";
import { createSeoService } from "../backend/src/modules/seo/seo.service.ts";
const env = loadEnv();
if (env.NODE_ENV === "production") throw new Error("Local verification only");
const { pool, db } = createDatabase(env.DATABASE_URL);
const temp = await mkdtemp(join(tmpdir(), "technest-sitemap-verify-"));
try {
  if ((await pool.query("select current_database() name")).rows[0].name !== "technest_dev")
    throw new Error("Development database required");
  const repository = createSeoRepository(pool);
  const service = createSeoService(repository, createCatalogService(db), {
    environment: "production",
    siteUrl: "https://seo-validation.example.test",
    indexingEnabled: true,
  });
  const counts = await repository.sitemapCounts();
  await writeFile(join(temp, "index.xml"), await service.sitemap());
  await writeFile(join(temp, "pages.xml"), await service.sitemap("pages"));
  for (const [kind, count] of Object.entries(counts))
    for (let page = 1; page <= Math.ceil(count / 1000); page++)
      await writeFile(join(temp, `${kind}-${page}.xml`), await service.sitemap(kind, page));
  const parsed = execFileSync(
    "python3",
    [
      "-c",
      `
import glob,xml.etree.ElementTree as ET,sys,json
namespace='{http://www.sitemaps.org/schemas/sitemap/0.9}'
urls=[];index_entries=0;files=glob.glob(sys.argv[1]+'/*.xml')
for filename in files:
 root=ET.parse(filename).getroot()
 assert root.tag in [namespace+'urlset',namespace+'sitemapindex']
 locs=[node.text for node in root.iter(namespace+'loc')]
 assert all(value.startswith('https://seo-validation.example.test/') for value in locs)
 if root.tag==namespace+'urlset':
  assert len(locs)<=1000
  assert all(not any(x in value for x in ['/admin','/account','/checkout','/login','/cart','catalog-','tn-curated-','tn-large-']) for value in locs)
  urls.extend(locs)
 else:index_entries+=len(locs)
assert len(urls)==len(set(urls))
print(json.dumps({'documents':len(files),'indexEntries':index_entries,'publicUrls':len(urls),'validXml':True,'duplicates':0}))
`,
      temp,
    ],
    { encoding: "utf8" },
  );
  const report = {
    mode: "Local read-only PostgreSQL verification with reserved .test origin; no public publishing",
    counts,
    ...JSON.parse(parsed),
  };
  await writeFile(
    new URL("../docs/technest-seo-xml-verification.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await pool.end();
  await rm(temp, { recursive: true, force: true });
}
