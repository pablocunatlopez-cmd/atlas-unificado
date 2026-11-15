import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {recordsFromAutonomyReport} from './typed-evidence-from-report.mjs';
import {publishEvidence} from './evidence-publish.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');

/**
 * Persist typed evidence from an autonomy report and, when the outbound
 * bridge is configured, POST it to Sites. Failures are returned, not thrown.
 */
export async function publishReportEvidence(report, {dataDir = DATA, request = fetch, signal} = {}) {
  const records =
    Array.isArray(report?.typedEvidence) && report.typedEvidence.length
      ? report.typedEvidence
      : recordsFromAutonomyReport(report);
  if (!records.length) return {ok: true, published: 0, reason: 'no_records'};

  const ledgerPath = path.join(dataDir, 'typed-evidence.json');
  let ledger = {records: []};
  try {
    ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    if (!Array.isArray(ledger.records)) ledger.records = [];
  } catch {
    ledger = {records: []};
  }
  ledger.records = [...records, ...ledger.records].slice(0, 64);
  ledger.updatedAt = new Date().toISOString();
  await fs.mkdir(dataDir, {recursive: true});
  await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2));

  let siteUrl;
  let token;
  try {
    const config = JSON.parse(await fs.readFile(path.join(dataDir, 'cloud-bridge.json'), 'utf8'));
    siteUrl = config.siteUrl;
    token = (await fs.readFile(path.join(dataDir, 'cloud-bridge.key'), 'utf8')).trim();
  } catch {
    return {ok: true, published: 0, saved: records.length, reason: 'bridge_not_configured'};
  }
  if (!siteUrl || !token || token.length < 32) {
    return {ok: true, published: 0, saved: records.length, reason: 'bridge_not_configured'};
  }

  try {
    const result = await publishEvidence(siteUrl, token, records, {request, signal});
    return {
      ok: result.ok,
      published: result.ok ? records.length : 0,
      saved: records.length,
      status: result.status,
      reason: result.ok ? 'published' : 'publish_failed',
    };
  } catch (error) {
    return {ok: false, published: 0, saved: records.length, reason: String(error?.message || error).slice(0, 200)};
  }
}

async function main() {
  const autonomy = JSON.parse(await fs.readFile(path.join(DATA, 'autonomous-review.json'), 'utf8'));
  const report = autonomy.history?.at(-1);
  if (!report) {
    console.error('No autonomy history to publish.');
    process.exitCode = 1;
    return;
  }
  const result = await publishReportEvidence(report);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
