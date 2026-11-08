// The contract between this site's TypeScript engines and the Java services in the separate
// healthcare-payer-ai-services project: saved JSON ("golden files") that both must reproduce.
//
//   npm run dev                  (in another terminal)
//   npm run contracts:check      this site's engines still match contract-tests/
//   npm run contracts:write      regenerate contract-tests/ from this site's engines
//   npm run contracts:sync       write, then copy data/ and contract-tests/ to the services project
//
// The services project's `mvn test` checks its engines against its copy. Run contracts:sync after
// any change to data, labels or recorded outputs, so both projects stay on the same contract.
//
// The golden files come from replay mode, so no API calls are made and nothing here costs money.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const mode = process.argv[2];
const base = process.env.BASE_URL ?? "http://localhost:3000";
const servicesDir = process.env.SERVICES_DIR ?? "../healthcare-payer-ai-services";
const DIR = "contract-tests";

if (!["check", "write", "sync"].includes(mode)) {
  console.error("Usage: node scripts/contracts.mjs check|write|sync");
  process.exit(1);
}

/** Fields that legitimately vary between runs or engines are left out of the contract. */
function normalize(r) {
  const { engine, generatedAt, notice, usage, ...rest } = r;
  if (Array.isArray(rest.trace)) rest.trace = rest.trace.map(({ name, detail }) => ({ name, detail }));
  return rest;
}

/** Numbers compare by value; a missing field and null are the same; arrays keep their order. */
function diff(a, b, path, out) {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-9) out.push(`${path}: expected ${a}, got ${b}`);
  } else if (a === null || a === undefined || b === null || b === undefined) {
    if ((a ?? null) !== (b ?? null)) out.push(`${path}: expected ${JSON.stringify(a)}, got ${JSON.stringify(b)}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: expected ${a.length} items, got ${b.length}`);
    else a.forEach((x, i) => diff(x, b[i], `${path}[${i}]`, out));
  } else if (typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out);
  } else if (a !== b) {
    out.push(`${path}: expected ${JSON.stringify(a)}, got ${JSON.stringify(b)}`);
  }
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

async function post(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, mode: "replay" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} ${JSON.stringify(body)}: ${json.error}`);
  if (json.engine !== "typescript") throw new Error(`${path} answered from the ${json.engine} engine. Clear the *_ENGINE_URL settings: the contract comes from TypeScript.`);
  return normalize(json);
}

/** Every demo case: [golden file, function producing the current output]. */
function cases() {
  const out = [];
  for (const c of readJson("data/pa/cases.json")) out.push([`pa/${c.id}.json`, () => post("/api/pa/evaluate", { caseId: c.id })]);
  for (const c of readJson("data/appeals/claims.json")) out.push([`appeals/${c.id}.json`, () => post("/api/appeals/analyze", { claimId: c.id })]);
  for (const m of readJson("data/benefits/members.json")) {
    for (const q of m.sampleQuestions) out.push([`benefits/${q.id}.json`, () => post("/api/benefits/ask", { questionId: q.id })]);
  }
  for (const m of readJson("data/hcc/members.json")) out.push([`hcc/${m.id}.json`, () => post("/api/hcc/review", { memberId: m.id })]);
  return out;
}

const screen = await (await fetch(`${base}/api/pi/leads`)).json();
const all = [...cases(), [`pi/screen.json`, async () => screen]];
for (const l of screen.leads) all.push([`pi/${l.providerId}.json`, () => post("/api/pi/brief", { providerId: l.providerId })]);

if (mode === "check") {
  let failed = 0;
  for (const [file, produce] of all) {
    const path = join(DIR, file);
    if (!existsSync(path)) {
      console.log(`XX ${file}: no golden file. Run npm run contracts:write.`);
      failed++;
      continue;
    }
    const diffs = [];
    diff(readJson(path), await produce(), file, diffs);
    if (diffs.length) {
      failed++;
      console.log(`XX ${file}: ${diffs.length} differences`);
      diffs.slice(0, 5).forEach((d) => console.log(`     ${d}`));
    }
  }
  console.log(`${all.length - failed} of ${all.length} contract files match.`);
  process.exit(failed ? 1 : 0);
}

rmSync(DIR, { recursive: true, force: true });
for (const [file, produce] of all) {
  const path = join(DIR, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(await produce(), null, 2) + "\n");
}
console.log(`Wrote ${all.length} contract files to ${DIR}/.`);

if (mode === "sync") {
  if (!existsSync(join(servicesDir, "pom.xml"))) {
    console.error(`No services project at ${servicesDir}. Set SERVICES_DIR.`);
    process.exit(1);
  }
  rmSync(join(servicesDir, "data"), { recursive: true, force: true });
  rmSync(join(servicesDir, DIR), { recursive: true, force: true });
  cpSync("data", join(servicesDir, "data"), { recursive: true });
  cpSync(DIR, join(servicesDir, DIR), { recursive: true });
  console.log(`Copied data/ and ${DIR}/ to ${servicesDir}. Run mvn test there.`);
}
