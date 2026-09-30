/**
 * `pnpm receipts:score`: parser accuracy on the labeled receipt set (SRS 13). Prints a report;
 * in CI also writes it to the job summary. Fails only when the full set exists and misses 85%.
 */
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gate, report, scoreReceipts } from './lib/score';
import type { LabeledReceipt } from './lib/types';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'labels');
const labeled: LabeledReceipt[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as LabeledReceipt);

const score = scoreReceipts(labeled);
const text = report(score);
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
if (!gate(score).pass) process.exit(1);
