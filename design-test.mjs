import assert from 'node:assert/strict';
import { DesignModel as M } from './design-model.ts';
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
close(M.critical(6), 300);
close(M.critical(6.7), 250);
close(M.critical(7.5), 200);
close(M.load(0.02, 1.34, 250).margin, 0);
close(M.load(0.02, 1.34, 250).central, 5);
close(M.load(0.03, 1.25, 200).central, 6);
close(M.load(0.03, 1.25, 200).margin, 0);
assert.ok(M.load(0.02, 1.34, 300).margin < 0);
assert.ok(M.limit(0.02) > M.limit(0.02 * 1.34));
assert.ok(Math.abs(M.graded(4).at(-1).end - 9.2) < 0.05);
assert.ok(Math.abs(M.graded(1)[0].end - 7.6) < 0.05);
for (let n = 1; n <= 8; n++) {
  const rows = M.graded(n);
  rows.forEach((r, i) => {
    close(r.j, M.critical(r.end));
    if (i) close(r.background, rows[i - 1].end);
  });
}
close(M.conductor(300, 1, 0.75, 1.5).current, 400);
close(M.conductor(300, 1, 0.75, 1.5).superJ, 1000);
assert.ok(M.volume(M.presets[2]) / M.volume(M.presets[1]) < 0.81);

export async function runBrowserChecks(browser, testInfo) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  try {
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/');
    await page.locator('[data-stage="5"]').click();
    assert.ok(await page.locator('#load-j').isVisible());
    await page.locator('#load-j').fill('300');
    assert.match(await page.locator('#load-story').innerText(), /Above/);
    await page.locator('#load-margin').click();
    assert.match(await page.locator('#load-story').innerText(), /Below/);
    await page.locator('#load-preset').selectOption('1');
    assert.match(await page.locator('#load-metrics').innerText(), /6.00 T/);
    await page.locator('#load-ratio').press('ArrowRight');
    assert.equal(await page.locator('#load-preset').inputValue(), 'custom');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'load-ratio');
    await page.locator('[data-stage="7"]').click();
    await page.locator('#grade-n').fill('1');
    assert.match(await page.locator('#grade-story').innerText(), /coincide/);
    await page.locator('#grade-n').fill('4');
    await page.locator('[data-stage="6"]').click();
    const before = await page.locator('#area-metrics').innerText();
    await page.locator('#wire-area').press('ArrowRight');
    assert.notEqual(await page.locator('#area-metrics').innerText(), before);
    await page.locator('[data-stage="5"]').click();
    await page.locator('#load-preset').selectOption('0');
    await page.locator('#load-j').fill('300');
    await page.screenshot({ path: testInfo.outputPath('load-lines-preview.png') });
    for (const width of [1280, 440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `overflow ${width}`,
      );
    }
    await page.addStyleTag({ content: 'html{font-size:200%!important}' });
    await page.locator('#load-j').press('ArrowLeft');
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      '200% overflow',
    );
    const clipped = await page.locator('#design-desk svg text').evaluateAll((els) =>
      els
        .filter((el) => {
          const b = el.getBoundingClientRect(),
            p = el.closest('svg').getBoundingClientRect();
          return b.left < p.left - 2 || b.right > p.right + 2;
        })
        .map((el) => el.textContent),
    );
    assert.deepEqual(clipped, [], 'Enlarged plot labels fit');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: book anchors, intersections, margins, grading, area conversions, preset/custom controls, focus, responsive and enlarged-text design desk; no runtime errors',
    );
  } finally {
    await context.close();
  }
}
