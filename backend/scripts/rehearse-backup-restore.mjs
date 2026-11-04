// Development only. Reads the current database and restores into a NEW isolated database.
import process from "node:process";
import console from "node:console";
import { fileURLToPath, URL } from "node:url";
import { mkdtemp, chmod, writeFile, stat } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { config } from "dotenv";
import { Pool } from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
config({ path: join(root, ".env"), quiet: true });
const started = performance.now();
if (!["development", "test"].includes(process.env.NODE_ENV || "development")) throw new Error("Development/test only");
const sourceUrl = new URL(process.env.DATABASE_URL || "");
const sourceName = decodeURIComponent(sourceUrl.pathname.slice(1));
if (!["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname) || !/_(dev|test)$/.test(sourceName)) throw new Error("A named local development/test database is required");
const pool = new Pool({ connectionString: sourceUrl.href, max: 2, application_name: "technest_restore_rehearsal", statement_timeout: 30000 });
const targetName = `technest_restore_${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}_${randomBytes(3).toString("hex")}`;
const directory = await mkdtemp(join(tmpdir(), "technest-backup-rehearsal-"));
await chmod(directory, 0o700);
const archive = join(directory, "technest-development.dump");
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const snapshot = await pool.connect();
let targetPool;
let snapshotOpen = false;
const report = { createdAt: new Date().toISOString(), source: sourceName, isolatedTarget: targetName, backup: { path: archive }, checks: [], outcome: "INCOMPLETE", sourceWrites: false, targetRetained: false };

function docker(command, args = []) {
  const child = spawn("docker", ["compose", "exec", "-T", "postgres", "sh", "-c", command, "technest-rehearsal", ...args], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  let diagnostic = "";
  child.stderr.on("data", (chunk) => { diagnostic += chunk.toString(); });
  const done = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Cannot execute local PostgreSQL tools through Docker")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`PostgreSQL tool exited ${code}: ${diagnostic.replaceAll(sourceUrl.password, "[REDACTED]").slice(0, 600)}`)));
  });
  // Attach rejection handling immediately while streams are being piped.
  done.catch(() => {});
  return { child, done };
}
async function signature(client) {
  const tables = (await client.query("select schemaname, tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by schemaname, tablename")).rows;
  const result = [];
  for (const table of tables) {
    const data = await client.query(`select count(*)::text as count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by md5(row_to_json(t)::text)),'')) as checksum from ${quote(table.schemaname)}.${quote(table.tablename)} t`);
    result.push({ table: `${table.schemaname}.${table.tablename}`, ...data.rows[0] });
  }
  const constraints = (await client.query("select n.nspname as schema, t.relname as table, c.conname as name, pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname not in ('pg_catalog','information_schema') order by n.nspname,t.relname,c.conname")).rows;
  // PostgreSQL reparses varchar literal arrays during restore. Normalize only that
  // equivalent array/text cast spelling, retaining expression grouping/operators.
  for (const constraint of constraints) constraint.definition = constraint.definition
    .replace(/\(('(?:[^']|'')*')::character varying\)::text/g, "$1::character varying")
    .replace(/\(\(ARRAY\[((?:'(?:[^']|'')*'::character varying(?:, )?)*)\]\)::text\[\]\)/g, "(ARRAY[$1])");
  const indexes = (await client.query("select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname not in ('pg_catalog','information_schema') order by schemaname,tablename,indexname")).rows;
  return { tables: result, constraintCount: constraints.length, indexCount: indexes.length, constraintsHash: createHash("sha256").update(JSON.stringify(constraints)).digest("hex"), indexesHash: createHash("sha256").update(JSON.stringify(indexes)).digest("hex") };
}
try {
  const identity = (await snapshot.query("select current_database() as database, version() as version")).rows[0];
  if (identity.database !== sourceName) throw new Error("Database identity mismatch");
  report.postgresVersion = identity.version.split(" on ")[0];
  console.log(`Confirmed development DB: ${sourceName}. Target will be a new isolated database: ${targetName}`);
  const existence = await pool.query("select 1 from pg_database where datname=$1", [targetName]);
  if (existence.rows.length) throw new Error("Refusing an existing restore target");
  await pool.query(`CREATE DATABASE ${quote(targetName)} TEMPLATE template0`);
  report.targetRetained = true;
  await snapshot.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  snapshotOpen = true;
  const snapshotId = (await snapshot.query("select pg_export_snapshot() as id")).rows[0].id;
  console.log("Creating custom-format archive from a read-only consistent snapshot…");
  const dump = docker('exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges --snapshot "$1"', [snapshotId]);
  dump.child.stdin.end();
  await Promise.all([pipeline(dump.child.stdout, createWriteStream(archive, { flags: "wx", mode: 0o600 })), dump.done]);
  const expected = await signature(snapshot);
  await snapshot.query("COMMIT"); snapshotOpen = false;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  report.backup.bytes = (await stat(archive)).size;
  report.backup.sha256 = hash.digest("hex");
  console.log("Restoring archive into the isolated target; current development DB stays untouched…");
  const restore = docker('exec pg_restore -U "$POSTGRES_USER" --dbname "$1" --exit-on-error --no-owner --no-privileges', [targetName]);
  restore.child.stdout.resume();
  await Promise.all([pipeline(createReadStream(archive), restore.child.stdin), restore.done]);
  const targetUrl = new URL(sourceUrl); targetUrl.pathname = `/${targetName}`;
  targetPool = new Pool({ connectionString: targetUrl.href, max: 1, application_name: "technest_restore_verify", options: "-c default_transaction_read_only=on", statement_timeout: 30000 });
  const actual = await signature(targetPool);
  report.sourceSnapshot = expected;
  report.restored = actual;
  for (const table of expected.tables) {
    const restored = actual.tables.find((value) => value.table === table.table);
    report.checks.push({ table: table.table, count: table.count, match: Boolean(restored && restored.count === table.count && restored.checksum === table.checksum) });
  }
  report.schemaMatch = expected.constraintCount === actual.constraintCount && expected.constraintsHash === actual.constraintsHash && expected.indexesHash === actual.indexesHash;
  report.outcome = report.checks.every((check) => check.match) && actual.tables.length === expected.tables.length && report.schemaMatch ? "PASS" : "FAIL";
  report.durationMs = Math.round(performance.now() - started);
  await writeFile(join(root, "docs/technest-backup-restore-results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outcome: report.outcome, tables: report.checks.length, constraints: actual.constraintCount, indexes: actual.indexCount, backupBytes: report.backup.bytes, durationMs: report.durationMs, isolatedTarget: targetName, backupPath: archive }));
  if (report.outcome !== "PASS") process.exitCode = 1;
} catch (error) {
  report.outcome = "FAIL";
  report.durationMs = Math.round(performance.now() - started);
  await writeFile(join(root, "docs/technest-backup-restore-results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.error(error instanceof Error ? error.message : "Backup/restore rehearsal failed");
  process.exitCode = 1;
} finally {
  if (snapshotOpen) await snapshot.query("ROLLBACK");
  snapshot.release();
  await Promise.all([pool.end(), targetPool?.end()]);
}
