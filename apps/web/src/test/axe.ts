import axe from 'axe-core';

/** Run axe on a rendered container; returns serious/critical violations (SRS 13 gate). */
export async function seriousViolations(container: Element) {
  const results = await axe.run(container, {
    // Color contrast needs real CSS (checked in Playwright), not jsdom.
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
