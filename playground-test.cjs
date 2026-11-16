const assert=require('node:assert/strict'),M=require('./playground-model');
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const base={...M.defaults},o=M.analyse(base),twice=M.analyse({...base,current:1000});
close(o.points[0].position,-.15);close(o.points.at(-1).position,.15);close(o.points[20].b,o.centre.b);
close(twice.centre.b,2*o.centre.b);close(twice.energy,4*o.energy);close(o.centre.x,0);
assert.ok(M.analyse({...base,n:3400,d:1.4}).pass,'6 T challenge has a feasible model solution');
const mesh=M.winding(base),positive=M.field(mesh,.025,.02),negative=M.field(mesh,-.025,.02);
close(positive.b,negative.b);close(positive.x,-negative.x);
const density={...base,mode:'density',j:100,l:400};close(M.geometry(density).current*density.n/(M.geometry(density).t*.4*1e6),100);
close(M.geometry({...base,mode:'volume',a:100,l:150}).volume,base.volume);
const cg=M.geometry({...base,mode:'conductor',a:100,l:150});close(cg.wireLength*cg.area*1e-6,base.metalVolume);
assert.ok(!M.analyse({...base,n:6000,d:2}).fit);assert.equal(M.analyse({...base,px:90}).probe,null);
assert.ok(Math.abs(M.analyse({...base,offset:10}).centre.x)>1e-4);assert.ok(M.analyse({...base,imbalance:20}).activeJ>o.activeJ);
close(M.critical(base,5,4.2),3000);assert.ok(M.critical(base,5,6)<M.critical(base,5,4.2));close(M.critical(base,5,9.2),0);assert.equal(M.critical(base,.5),null);
const sn={...base,material:'nb3sn',reference:1500};close(M.critical(sn,12,4.2),1500);assert.ok(M.critical(sn,12,10)<1500);
const grade=M.grading(base),redistributed=M.grading({...base,split:20,allocation:70});close(grade[1].end,redistributed[1].end);assert.ok(redistributed[0].j>grade[0].j);
assert.ok(M.analyse({...base,resolution:64,px:20,pz:10}).error<M.analyse({...base,resolution:16,px:20,pz:10}).error);
assert.equal(M.analyse({...base,temperature:10}).limit,0);
for(const material of ['nbti','nb3sn']){const s={...base,material,n:6000,d:2,fraction:.8,current:100,reference:5000,temperature:1.9},r=M.analyse(s);if(r.limit>0)close(r.limit/(r.g.area*s.fraction),M.critical(s,r.peak*r.limit/r.g.current),1e-5);}
console.log('PASS: symmetry, field/current scaling, constraints, packing, interior probe boundary, perturbations, temperature models, energy and grading conservation');
if (process.env.FIELD_LAB_UNIT_ONLY !== '1') {
const {chromium}=require(process.env.FIELD_LAB_PLAYWRIGHT || 'playwright');
(async()=>{const browser=await chromium.launch({headless:true, executablePath:process.env.FIELD_LAB_BROWSER || undefined});try{
 const page=await browser.newPage({viewport:{width:1400,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8765/');await page.locator('[data-stage="6"]').click();
 await page.locator('#pg-reset').click();
 await page.waitForFunction(()=>document.querySelector('#pg-main-metrics').textContent.includes('4.27'));
 assert.ok(await page.locator('#pg-profile svg path').first().evaluate(el=>el.getBBox().width>100),'Axial curve is visible across the plot');
 await page.locator('#pg-keep').click();await page.locator('#pg-current').fill('600');await page.waitForFunction(()=>document.querySelector('#pg-main-metrics').textContent.includes('600.0 A'));assert.match(await page.locator('#pg-comparison').innerText(),/Kept/);
 await page.locator('#pg-restore').click();await page.waitForFunction(()=>document.querySelector('#pg-current').value==='500');
 await page.locator('#pg-mode').selectOption('volume');assert.ok(await page.locator('#pg-t').isDisabled());await page.locator('#pg-a').press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'pg-a');
 await page.locator('#pg-mode').selectOption('conductor');assert.ok(await page.locator('#pg-n').isDisabled());
 await page.locator('#pg-mode').selectOption('density');assert.ok(await page.locator('#pg-current').isDisabled());assert.ok(await page.locator('#pg-j').isEnabled());
 await page.locator('#pg-a-number').fill('0');await page.locator('#pg-a-number').press('Tab');assert.match(await page.locator('#pg-error').innerText(),/valid/);
 await page.locator('#pg-reset').click();
 await page.locator('#pg-px-number').fill('90');await page.locator('#pg-px-number').press('Tab');await page.waitForFunction(()=>document.querySelector('#pg-probe-story').textContent.includes('withheld'));
 await page.locator('#pg-edge').click();await page.waitForFunction(()=>document.querySelector('#pg-probe-story').textContent.includes('Bx='));
 await page.getByText('Manufacturing imperfections',{exact:true}).click();await page.locator('#pg-offset').fill('10');await page.waitForFunction(()=>document.querySelector('#pg-engineering').textContent.includes('Withheld'));
 await page.locator('#pg-material').selectOption('nb3sn');await page.waitForFunction(()=>document.querySelector('#pg-material-note').textContent.includes('12 T'));
 await page.locator('#pg-resolution').selectOption('128');await page.waitForFunction(()=>document.querySelector('#pg-compute').textContent.includes('4096 segments'));
 await page.locator('#pg-reset').click();await page.locator('#playground').evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.waitForFunction(()=>document.querySelector('#pg-compute').textContent.includes('1024 segments'));
 await page.locator('#pg-magnet').scrollIntoViewIfNeeded();
 const handle=await page.locator('[data-pg-probe]').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+35,handle.y+handle.height/2-12,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#pg-pz').value!=='0');
 await page.locator('#pg-reset').click();await page.locator('#playground').evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.screenshot({path:require('node:path').join(__dirname,'playground-preview.png')});
 for(const width of [1400,440,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
 await page.addStyleTag({content:'html{font-size:200%!important}'});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% overflow');
 const clipped=await page.locator('#playground svg text').evaluateAll(els=>els.filter(el=>{const b=el.getBoundingClientRect(),p=el.closest('svg').getBoundingClientRect();return b.left<p.left-2||b.right>p.right+2;}).map(el=>el.textContent));assert.deepEqual(clipped,[]);
 assert.deepEqual(errors,[]);console.log('PASS: keep/restore/reset, constraints, invalid entry, probes, imperfections, material switching, resolution, focus, mobile and 200% text; no runtime errors');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

} else console.log('PASS: '+__filename.split('/').pop()+' model assertions (browser skipped)');
