const assert = require('node:assert/strict');
const M = require('./model.js'), S = require('./state.js'), V = require('./visuals.js'), E = require('./experiments.js');
const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
close(M.shape(1.5, 0), 0); close(M.shape(1.5, -2), -M.shape(1.5, 2));
close(M.solenoid(2, .05), M.solenoid(2, -.05));
assert.ok(Math.abs(M.solenoid(100) / (M.mu0 * 1e8 * .0375) - 1) < .0001);
close(M.transverse(2, .5, .2).x, -.2); close(M.transverse(2, .5, .2).y, -.5);
close(M.toroid(.4), .5); close(M.toroid(.6) / M.toroid(.3), .5);
close(M.mirror(2, .5), M.mirror(2, -.5)); close(M.mirror(0, 0), 1);
assert.ok(M.mirror(1, .02) < M.mirror(1, 0) && M.mirror(2, .02) > M.mirror(2, 0));
assert.ok(M.error(32) > .1 && M.error(64) < .1 && M.error(128) < M.error(64));
assert.ok(Math.abs(M.polygonLoop(1024, 0) / M.loopExact(0) - 1) < .00001);
const solutions = [300, 2, .4, 2, 64];
solutions.forEach((v, i) => assert.ok(V.pass(i, v), `lab ${i}`)); assert.ok(!V.pass(4, 128));
const old = { version: 1, section: 3, step: 2, solved: Array.from({ length: 20 }, (_, i) => i) };
const migrated = S.restore(null, JSON.stringify(old));
assert.equal(migrated.solved.length, 20); assert.ok(migrated.solved.every(n => n % 5 !== 4));
assert.equal(migrated.section, 3); assert.equal(migrated.step, 2);
assert.deepEqual(S.restore('{bad', '{}'), S.empty());
const invalid = S.restore(JSON.stringify({ version: 2, solved: [0, 0, -1, 25, '2'], section: 20, step: -1, values: [999, 4, '0.4', null, 12], kept: ['105', 0, -1], predictions: [null, 0, false, 4, -1], probe: 3, xp: 'yes' }));
assert.deepEqual(invalid.solved, [0]); assert.deepEqual(invalid.values, S.empty().values);
assert.deepEqual(invalid.kept, [null, null, null, null, null]);
assert.deepEqual(invalid.predictions, [null, 0, null, null, -1]); assert.equal(invalid.probe, .4); assert.equal(invalid.xp, false);
for (let i = 0; i < 5; i++) {
  const first = V.render(i, S.empty().values[i], null, .4, false, 640);
  const changed = V.render(i, solutions[i], null, .4, false, 640);
  assert.notEqual(first.sketch, changed.sketch, `Magnet view responds to section ${i} control`);
}
assert.ok(V.render(0, 300, null, .4, false, 640).sketch.includes('winding-surface'));
const solenoidView = V.render(0, 300, null, .4, false, 640);
assert.match(E[0].goal, /at least 3.0 T/);
assert.match(solenoidView.sketch, /positive to the right/);
assert.match(solenoidView.explanation, /a = 75 mm/);
assert.match(solenoidView.explanation, /100 × \|B\(\+15 mm\) − B\(0\)\|/);
assert.match(solenoidView.explanation, /0.300%/);
assert.equal(solenoidView.readout[1][1], `${M.solenoid(2, .015).toFixed(4)} T`);
assert.ok(M.solenoid(1.2) > 3 && !V.pass(0, 180), 'Field minimum alone is insufficient');
assert.ok(V.pass(0, 300), 'Exceeding 3 T is allowed when both conditions pass');
console.log('PASS: field identities, limits, mirror normalization, convergence, all lab targets, v1 migration and invalid persisted data');
if (process.env.FIELD_LAB_UNIT_ONLY !== '1') {
const {chromium}=require(process.env.FIELD_LAB_PLAYWRIGHT || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.FIELD_LAB_BROWSER || undefined });
  try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');
  const selectSection = async i => {
    if (await page.locator('#section-select').isVisible()) await page.locator('#section-select').selectOption(String(i));
    else await page.locator(`[data-section="${i}"]`).click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lesson-heading');
  };
  const setValue = async (i, v) => {
    if (E[i].options) await page.locator('#parameter').selectOption(String(v));
    else { await page.locator('#exact-value').fill(String(v)); await page.locator('#exact-value').press('Tab'); }
  };
  assert.ok(await page.locator('#parameter').isDisabled());
  await page.locator('#prediction').selectOption('2');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'parameter');
  assert.ok(await page.locator('#parameter').isEnabled());
  await page.locator('#keep').click();
  await page.locator('#exact-value').fill('300');
  await page.setViewportSize({ width: 1200, height: 900 }); await page.waitForTimeout(100);
  assert.equal(await page.locator('#exact-value').inputValue(), '300', 'Resize preserves uncommitted numeric draft');
  await page.locator('#exact-value').press('Tab');
  await page.setViewportSize({ width: 1280, height: 900 });
  await setValue(0, 300);
  assert.ok(await page.locator('.kept-curve').count() > 0);
  assert.match(await page.locator('#comparison').innerText(), /105 mm/);
  assert.equal(await page.locator('#parameter').getAttribute('aria-valuetext'), '300 mm');
  await page.locator('#exact-value').fill('900'); await page.locator('#exact-value').press('Tab');
  assert.match(await page.locator('#input-error').innerText(), /60–450/);
  assert.equal(await page.locator('#parameter').inputValue(), '300');
  await setValue(0, 300);
  await page.locator('#check').click(); await page.locator('#check').click();
  assert.equal(await page.locator('#progress').getAttribute('value'), '1');
  await page.reload(); assert.match(await page.locator('#comparison').innerText(), /105 mm/);
  assert.equal(await page.locator('#parameter').inputValue(), '300');
  await page.locator('#clear-kept').click(); assert.equal(await page.locator('.kept-curve').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'keep');
  await page.locator('#reset').click(); assert.equal(await page.locator('#parameter').inputValue(), '105');
  assert.equal(await page.locator('#progress').getAttribute('value'), '1');
  console.log('PASS: prediction unlocking, numeric validation, comparison overlay/persistence/removal, reset preserves completion, duplicate credit');
  const answers = [[1, 2, 0], [1, 2, 0], [1, 2, 0], [1, 0, 2], [0, 1, 2]];
  for (let i = 0; i < 5; i++) {
    await selectSection(i); await page.locator('#prediction-panel').evaluate(el => { el.open = true; });
    await page.locator('#prediction').selectOption(String(E[i].answer)); await setValue(i, solutions[i]);
    if (i === 1) {
      assert.ok(await page.locator('.current-in').count() > 0 && await page.locator('.current-out').count() > 0 && await page.locator('.cross').count() > 0 && await page.locator('.dot').count() > 0);
      const x1 = await page.locator('#plot .sample').getAttribute('x');
      await page.locator('#probe').press('ArrowRight');
      assert.notEqual(await page.locator('#plot .sample').getAttribute('x'), x1);
      assert.match(await page.locator('#probe').getAttribute('aria-valuetext'), /0.45/);
    }
    if (i === 2) {
      const x1 = await page.locator('#plot .sample').getAttribute('x'); await page.locator('#parameter').press('ArrowRight');
      assert.notEqual(await page.locator('#plot .sample').getAttribute('x'), x1); await setValue(i, .4);
    }
    if (i === 4) {
      const cy = +await page.locator('#plot .sample').getAttribute('y'), axisY = +(await page.locator('#plot line.axis').nth(1).getAttribute('y1'));
      assert.ok(axisY - cy > 25, 'Convergence must be visually resolved away from axis');
      await setValue(i, 128); await page.locator('#check').click(); assert.match(await page.locator('#feedback').innerText(), /smaller offered count/); await setValue(i, 64);
    }
    await page.locator('#check').click(); assert.match(await page.locator('#feedback').innerText(), i === 0 ? /Field requirements met/ : /Design meets/);
    await page.locator('#next').click();
    if (i === 0) await page.locator('[data-stage="1"]').click();
    for (let step = 0; step < 3; step++) {
      assert.equal(await page.evaluate(() => document.activeElement.id), 'lesson-heading');
      assert.equal(await page.locator('.quiz details').getAttribute('open'), null, 'Explanation is not revealed before response');
      await page.locator(`[data-answer="${(answers[i][step] + 1) % 3}"]`).click();
      assert.match(await page.locator('#feedback').innerText(), /Try another/);
      await page.locator(`[data-answer="${answers[i][step]}"]`).click();
      assert.match(await page.locator('#feedback').innerText(), /That reasoning holds/);
      await page.locator('#next').click();
    }
    if (E[i].transfer.options) { await page.locator('[data-answer="2"]').click(); assert.match(await page.locator('#feedback').innerText(), /Try another/); await page.locator('[data-answer="0"]').click(); }
    else { await page.locator('#transfer-value').fill('999'); await page.locator('#transfer-form button').click(); assert.match(await page.locator('#feedback').innerText(), /Revisit/); await page.locator('#transfer-value').fill(String(E[i].transfer.value)); await page.locator('#transfer-form button').click(); }
    assert.ok(await page.locator('#feedback').evaluate(el => el.classList.contains('success')));
  }
  assert.equal(await page.locator('#progress').getAttribute('value'), '25');
  await page.locator('#next').click(); assert.match(await page.locator('#mission').innerText(), /25\/28 exercises complete/);
  await page.reload(); assert.equal(await page.locator('#progress').getAttribute('value'), '25');
  console.log('PASS: all 25 learning challenges, wrong/correct feedback, keyboard focus, non-color current symbols, linked probes, logarithmic convergence');
  await page.evaluate(old => { localStorage.removeItem('wilson-field-lab-v2'); localStorage.setItem('wilson-field-lab-v1', JSON.stringify(old)); }, old);
  await page.reload(); assert.equal(await page.locator('#progress').getAttribute('value'), '20');
  assert.ok(await page.evaluate(() => localStorage.getItem('wilson-field-lab-v1') !== null), 'Legacy snapshot retained');
  await page.evaluate(() => localStorage.setItem('wilson-field-lab-v2', '{broken'));
  await page.reload(); assert.equal(await page.locator('#progress').getAttribute('value'), '20');
  assert.equal(await page.locator('#storage-status').innerText(), '');
  console.log('PASS: browser migration preserves all prior exercises and retains legacy data; malformed v2 recovers legacy without a false storage warning');
  // Use a clean context for fresh-learner layout and touch target checks.
  await page.evaluate(() => { localStorage.removeItem('wilson-field-lab-v1'); localStorage.removeItem('wilson-field-lab-v2'); }); await page.reload();
  for (const width of [1280, 736, 440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (let i = 0; i < 5; i++) {
      await selectSection(i);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}/${i}`);
      assert.ok(await page.locator('#sketch').evaluate(el => el.getBoundingClientRect().top < 900), `diagram below first view ${width}/${i}`);
      const small = await page.locator('button,summary,input,select').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width && !el.closest('[hidden]') && el.getBoundingClientRect().height < 43).map(el => el.id || el.tagName));
      assert.deepEqual(small, [], `small targets at ${width}/${i}`);
    }
  }
  await page.setViewportSize({ width: 440, height: 900 }); await selectSection(0);
  assert.ok(await page.locator('#parameter').evaluate(el => el.getBoundingClientRect().bottom < 900), 'First primary control visible at actual panel width');
  for (const i of [1, 2, 3]) {
    await selectSection(i); await page.locator('#free').click();
    const control = i === 1 ? '#probe' : '#parameter';
    const before = await page.locator(control).inputValue();
    const handle = await page.locator('[data-drag]').last().boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 35, handle.y + handle.height / 2, { steps: 5 }); await page.mouse.up();
    assert.notEqual(await page.locator(control).inputValue(), before, `Pointer drag updates section ${i}`);
  }
  console.log('PASS: direct dragging updates transverse probe, toroid radius and mirror spacing');
  await page.setViewportSize({ width: 1280, height: 900 }); await selectSection(0);
  await page.locator('#free').click(); await page.locator('#keep').click(); await setValue(0, 300);
  await page.mouse.move(0, 0); await page.waitForTimeout(300); // Let navigation color transitions settle for the preview.
  await page.screenshot({ path: require('node:path').join(__dirname, 'preview.png') });
  await page.setViewportSize({ width: 440, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  for (let i = 0; i < 5; i++) {
    await selectSection(i); await page.waitForTimeout(50);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `200% text overflow section ${i}`);
    const clipped = await page.locator('svg text').evaluateAll(els => els.filter(el => { const b = el.getBoundingClientRect(), p = el.closest('svg').getBoundingClientRect(); return b.left < p.left - 2 || b.right > p.right + 2; }).map(el => el.textContent));
    assert.deepEqual(clipped, [], `200% SVG text clipped ${i}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: responsive layouts 1280/736/440/320, minimum 44px control heights, first-view control, 200% text reflow and SVG label bounds; no runtime errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

} else console.log('PASS: '+__filename.split('/').pop()+' model assertions (browser skipped)');
