const assert=require('node:assert/strict'),M=require('./design-model'),S=require('./state');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const good=M.seriesGrading(150,.9,1.2),equal=M.seriesGrading(150,1.2,1.2);
assert.ok(good.pass);assert.ok(!equal.pass);assert.ok(!M.seriesGrading(300,.9,1.2).pass);
close(good.rows[0].peak,good.rows[1].background);
close(good.rows[0].j/good.rows[1].j,(1.2/.9)**2);
close(equal.rows[0].j,equal.rows[1].j);
for(const row of good.rows){const limiting=M.seriesGrading(row.limitingCurrent,.9,1.2).rows.find(r=>r.name===row.name);close(limiting.j,M.critical(limiting.peak));}
const old={...S.empty(),version:2,solved:Array.from({length:25},(_,i)=>i),values:[300,2,.4,2,64]};
const migrated=S.restore(JSON.stringify(old));assert.equal(migrated.version,3);assert.equal(migrated.solved.length,25);assert.ok(!migrated.solved.includes(25));
assert.equal(S.restore(JSON.stringify({...migrated,step:7})).step,7);
assert.equal(S.restore(JSON.stringify({...migrated,section:2,step:7})).step,0);
if (process.env.FIELD_LAB_UNIT_ONLY !== '1') {
const {chromium}=require(process.env.FIELD_LAB_PLAYWRIGHT || 'playwright');
(async()=>{const browser=await chromium.launch({headless:true, executablePath:process.env.FIELD_LAB_BROWSER || undefined});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/');await page.evaluate(old=>localStorage.setItem('wilson-field-lab-v2',JSON.stringify(old)),old);await page.reload();
 assert.match(await page.locator('#progress-label').innerText(),/25\/28/);
 assert.equal(await page.getByText(/Go deeper|Advanced playground/).count(),0);
 await page.locator('#next').click();assert.equal(await page.locator('[data-stage="5"]').getAttribute('aria-current'),'step');
 await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/Not yet/);
 await page.locator('#load-j').fill('200');await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/Stage complete/);
 await page.locator('#integrated-continue').click();await page.waitForFunction(()=>document.querySelector('#pg-l').value==='300');
 assert.equal(await page.locator('#pg-mode').inputValue(),'density');assert.equal(await page.locator('#pg-t').inputValue(),'37.5');
 await page.locator('#pg-d').fill('0.4');await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/Not yet/);
 await page.locator('#pg-d').fill('1.2');await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/Stage complete/);
 await page.locator('#pg-n').fill('6000');assert.equal(await page.locator('#integrated-feedback').innerText(),'');await page.locator('#pg-d').fill('2');await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/wire does not fit/);
 await page.locator('#pg-n').fill('2400');await page.locator('#pg-d').fill('1.2');await page.locator('#pg-temperature').fill('10');await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/critical temperature/);
 await page.locator('#pg-temperature').fill('4.2');
 await page.locator('#integrated-continue').click();await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/Not yet/);
 await page.locator('#series-outer-number').fill('0');await page.locator('#series-outer-number').press('Tab');assert.match(await page.locator('#series-error').innerText(),/Enter/);assert.equal(await page.locator('#series-outer').inputValue(),'1.2');
 await page.locator('#series-outer').fill('0.9');await page.locator('#integrated-check').click();assert.match(await page.locator('#integrated-feedback').innerText(),/Stage complete/);
 assert.match(await page.locator('#progress-label').innerText(),/28\/28/);await page.locator('#integrated-check').click();assert.match(await page.locator('#progress-label').innerText(),/28\/28/);
 await page.locator('#lesson-heading').scrollIntoViewIfNeeded();await page.screenshot({path:require('node:path').join(__dirname,'integrated-preview.png')});
 for(const width of [1280,440,320]){await page.setViewportSize({width,height:1000});for(const stage of [5,6,7]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${stage}: overflow ${width}`);}}
 await page.addStyleTag({content:'html{font-size:200%!important}'});await page.waitForTimeout(200);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% overflow');
 const clipped=await page.locator('#series-plot svg text').evaluateAll(els=>els.filter(el=>{const a=el.getBoundingClientRect(),b=el.closest('svg').getBoundingClientRect();return a.left<b.left-2||a.right>b.right+2;}).map(el=>el.textContent));assert.deepEqual(clipped,[]);
 await page.reload();assert.match(await page.locator('#progress-label').innerText(),/28\/28/);assert.ok(await page.locator('#series-outer').isVisible());
 await page.locator('#integrated-continue').click();assert.equal(await page.locator('[data-stage="1"]').getAttribute('aria-current'),'step');assert.equal(await page.evaluate(()=>document.activeElement.id),'lesson-heading');
 assert.deepEqual(errors,[]);console.log('PASS: shared-current grading limits, v2 migration, full integrated flow, independent failures, duplicate credit, reload, responsive layouts and 200% text; no runtime errors');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

} else console.log('PASS: '+__filename.split('/').pop()+' model assertions (browser skipped)');
