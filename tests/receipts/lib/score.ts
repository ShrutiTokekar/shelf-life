import { parseReceipt, type ParsedReceipt } from '@shelf-life/shared';
import { MISSING, SKIP, type LabeledReceipt } from './types';

/** SRS 13 gate: at least 85% of grocery lines matched to the right food. */
export const TARGET = 0.85;
/** SRS 13: the gate applies once the set has its 50 receipts. */
export const FULL_SET = 50;

export type Miss = {
  receipt: string;
  line: number;
  text: string;
  expected: string;
  /** What the parser did: a food id, "skipped", or "unmatched:<name>". */
  got: string;
};

export type Tally = { groceries: number; correct: number };

export type Score = {
  receipts: number;
  unchecked: string[];
  overall: Tally;
  bySplit: Record<'tune' | 'holdout', Tally>;
  byStore: Record<string, Tally>;
  /** Non-grocery lines the parser turned into items (they'd need unticking on review). */
  falseItems: Miss[];
  misses: Miss[];
  /** Grocery names the dictionary is missing, most frequent first. */
  gaps: { name: string; count: number }[];
};

const tally = (): Tally => ({ groceries: 0, correct: 0 });
export const rate = (t: Tally) => (t.groceries === 0 ? null : t.correct / t.groceries);

/**
 * Score the parser on the labeled set. "Correct" means the line became an item with the expected
 * food id, which is what makes the review screen show the right name with no typing.
 */
export function scoreReceipts(
  labeled: readonly LabeledReceipt[],
  today = '2026-09-28',
  parse: (r: LabeledReceipt) => ParsedReceipt = (r) => parseReceipt(r.lines, today),
): Score {
  const score: Score = {
    receipts: 0,
    unchecked: [],
    overall: tally(),
    bySplit: { tune: tally(), holdout: tally() },
    byStore: {},
    falseItems: [],
    misses: [],
    gaps: [],
  };
  const gaps = new Map<string, number>();

  for (const r of labeled) {
    if (!r.checked) {
      score.unchecked.push(r.id);
      continue;
    }
    score.receipts++;
    const parsed = parse(r);
    const items = new Map(parsed.items.map((i) => [i.index, i]));
    const store = (score.byStore[r.store] ??= tally());

    r.lines.forEach((line, index) => {
      const item = items.get(index);
      const got = !item ? 'skipped' : (item.foodId ?? `unmatched:${item.name}`);
      if (line.expect === SKIP) {
        if (item)
          score.falseItems.push({
            receipt: r.id,
            line: index,
            text: line.text,
            expected: SKIP,
            got,
          });
        return;
      }
      for (const t of [score.overall, score.bySplit[r.split], store]) t.groceries++;
      if (item?.foodId === line.expect) {
        for (const t of [score.overall, score.bySplit[r.split], store]) t.correct++;
        return;
      }
      score.misses.push({
        receipt: r.id,
        line: index,
        text: line.text,
        expected: line.expect,
        got,
      });
      if (line.expect.startsWith(MISSING)) {
        const name = line.expect.slice(MISSING.length).trim().toLowerCase();
        gaps.set(name, (gaps.get(name) ?? 0) + 1);
      }
    });
  }
  score.gaps = [...gaps]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return score;
}

const pct = (t: Tally) => {
  const r = rate(t);
  return r === null ? '–' : `${(r * 100).toFixed(1)}% (${t.correct}/${t.groceries})`;
};

/** Pass/fail for CI: only enforced once the full set exists, so a partial set reports only. */
export function gate(score: Score): { enforced: boolean; pass: boolean } {
  const enforced = score.receipts >= FULL_SET;
  const r = rate(score.overall);
  return { enforced, pass: !enforced || (r !== null && r >= TARGET) };
}

/** Markdown report (printed locally, and the CI job summary). */
export function report(score: Score): string {
  const out: string[] = ['## Receipt accuracy (SRS 13)', ''];
  if (score.receipts === 0) {
    out.push(
      'No checked receipts in `tests/receipts/labels/` yet, so there is no score. See `tests/receipts/README.md` to add some.',
    );
  } else {
    const g = gate(score);
    out.push(
      `**${pct(score.overall)}** of grocery lines matched on ${score.receipts} receipt${score.receipts === 1 ? '' : 's'} (target ${TARGET * 100}%).`,
      '',
      g.enforced
        ? g.pass
          ? '✅ Meets the target.'
          : '❌ Below the target.'
        : `Baseline only: the gate applies once there are ${FULL_SET} checked receipts.`,
      '',
      '| Split | Score |',
      '| --- | --- |',
      `| Tune (dictionary grown from these) | ${pct(score.bySplit.tune)} |`,
      `| Holdout (never tuned on) | ${pct(score.bySplit.holdout)} |`,
      '',
      '| Store | Score |',
      '| --- | --- |',
      ...Object.entries(score.byStore)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([s, t]) => `| ${s} | ${pct(t)} |`),
      '',
      `Non-grocery lines turned into items: ${score.falseItems.length}`,
    );
    if (score.gaps.length > 0) {
      out.push('', '### Missing from the dictionary', '');
      for (const g of score.gaps) out.push(`- ${g.name} ×${g.count}`);
    }
    if (score.misses.length > 0) {
      out.push(
        '',
        '### Misses',
        '',
        '| Receipt | Line | Expected | Got |',
        '| --- | --- | --- | --- |',
      );
      for (const m of score.misses)
        out.push(
          `| ${m.receipt} | \`${m.text.replace(/\|/g, '\\|')}\` | ${m.expected} | ${m.got} |`,
        );
    }
  }
  if (score.unchecked.length > 0)
    out.push('', `Not scored (labels not checked yet): ${score.unchecked.join(', ')}`);
  return out.join('\n');
}
