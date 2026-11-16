(() => {
  const M = DesignModel, $ = id => document.getElementById(id);
  const root = document.createElement('section');
  root.className = 'design-module'; root.dataset.designStage = '7'; root.id = 'series-grading';
  const control = (id, label, min, max, step, value, unit) => `<div class="pg-control"><label for="${id}">${label}<output id="${id}-out"></output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><label class="sr-only" for="${id}-number">Exact ${label} (${unit})</label><input id="${id}-number" type="number" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  root.innerHTML = `<p class="eyebrow">Your series-connected magnet · pp.24–25</p><h2>One current, two wire sizes</h2><p>Both zones carry the same supply current. A thinner wire gives higher current density and more turns per winding area. The outer zone sees less field, so it can tolerate a higher current density.</p><div class="design-grid"><div><div id="series-wire"></div><div id="series-plot"></div><p class="legend">Green: allowable overall J · blue: outer-zone peak-field load line · gold: inner-zone peak-field load line · circles: current operating points. These are coupled through one supply current.</p><div id="series-results"></div></div><div class="design-controls">${control('series-current','Series current',25,400,5,150,'A')}${control('series-outer','Outer wire diameter',.5,2,.05,1.2,'mm')}${control('series-inner','Inner wire diameter',.5,2,.05,1.2,'mm')}<p id="series-error" role="alert"></p><p>Fixed: two 16 mm radial zones, NbTi at 4.2 K, metal packing fraction 75%. Wire diameter is not the 16 mm winding thickness.</p><p>Joverall = 0.75 × I / (πd²/4). Both zones use the book’s effective winding critical curve. Packing and composition stay fixed when diameter changes.</p><button id="series-hint" type="button">Show a starting design</button><p id="series-hint-text"></p></div></div><p class="source-note">Infinite-solenoid teaching model: field is zero outside; each zone adds μ₀JΔr inward. The inner zone sees both contributions. Finite coils require coupled numerical peak-field calculations. The finite-coil conductor settings do not carry into this separate book experiment.</p>`;
  $('design-desk').querySelector('.design-content').prepend(root);
  const ids = ['series-current', 'series-outer', 'series-inner'];
  const value = id => +$(id).value;
  const result = () => M.seriesGrading(...ids.map(value));
  function draw() {
    if (root.hidden || $('design-desk').hidden) return;
    const o = result(), colors = ['var(--blue)', 'var(--gold)'];
    ids.forEach((id, i) => { const text = `${value(id)} ${i ? 'mm' : 'A'}`; $(id+'-out').textContent = text; $(id).setAttribute('aria-valuetext', text); if(document.activeElement !== $(id+'-number'))$(id+'-number').value=value(id); });
    $('series-wire').innerHTML = `<div class="wire-pair">${o.rows.map((r,i) => `<figure><svg viewBox="0 0 100 100" role="img" aria-label="${r.name} wire cross-section, diameter ${r.diameter} mm"><circle cx="50" cy="50" r="${r.diameter*20}" fill="${colors[i]}"/><circle cx="50" cy="50" r="${r.diameter*10}" fill="var(--paper)" opacity=".5"/></svg><figcaption>${r.name} wire · ${r.diameter.toFixed(2)} mm</figcaption></figure>`).join('')}</div><p>Cross-sections at the same scale; shading is schematic. Series current: <strong>${value('series-current')} A through both wires.</strong></p>`;
    const w = Math.max(240, $('series-plot').clientWidth), scale = parseFloat(getComputedStyle(root).fontSize)/14;
    const h = 240*scale, left = 48*scale, right = w-14, top = 20, bottom = h-35*scale;
    const maxB = Math.max(12, ...o.rows.map(r=>r.peak))*1.02, maxJ=Math.max(700,...o.rows.map(r=>r.j))*1.05;
    const x = b=>left+b/maxB*(right-left), y = j=>bottom-j/maxJ*(bottom-top);
    const path = points=>points.map(([b,j],i)=>`${i?'L':'M'}${x(b)},${y(j)}`).join(' ');
    let d = `<path d="M${left},${top}V${bottom}H${right}" class="axis" fill="none"/>`;
    for(const b of [0,maxB/2,maxB])d+=`<text x="${x(b)}" y="${bottom+24*scale}" text-anchor="${b===0?'start':b===maxB?'end':'middle'}">${b.toFixed(1)}</text>`;
    for(const j of [0,maxJ/2,maxJ])d+=`<text x="${left-6}" y="${y(j)+4}" text-anchor="end">${j.toFixed(0)}</text>`;
    d+=`<path d="${path(M.points)}" stroke="var(--green)" stroke-width="2" fill="none"/>`;
    o.rows.forEach((r,i)=>{const j=Math.min(maxJ,maxB/r.k);d+=`<path d="${path([[0,0],[r.k*j,j]])}" stroke="${colors[i]}" stroke-width="2" ${i?'stroke-dasharray="6 3"':''}/><circle cx="${x(r.peak)}" cy="${y(r.j)}" r="5" fill="${colors[i]}" stroke="var(--ink)"/>`;});
    $('series-plot').innerHTML=`<p class="chart-label">Overall winding J (A/mm²)</p><svg class="viz" viewBox="0 0 ${w} ${h}" role="img" aria-label="Two zone load lines and critical current density. Numeric results follow.">${d}</svg><p class="chart-label x-label">Local peak field (T)</p>`;
    $('series-results').innerHTML=`<p><strong>${o.central>=5?'✓':'Not yet ·'} Bore field: ${o.central.toFixed(2)} T</strong> · minimum 5.0 T</p>${o.rows.map(r=>`<p><strong>${r.margin>=20?'✓':'Not yet ·'} ${r.name} zone margin: ${r.margin.toFixed(1)}%</strong> · minimum 20%<br>Overall J ${r.j.toFixed(1)} A/mm²; local maximum ${r.peak.toFixed(2)} T; Jc here ${M.critical(r.peak).toFixed(1)} A/mm². Supply-current limit for this zone: ${r.limitingCurrent.toFixed(1)} A.</p>`).join('')}<p>${value('series-outer')<value('series-inner')?'✓ Outer wire is thinner.':'Use a thinner outer wire to exploit its lower field.'}</p><p>The smaller zone current limit limits the whole series magnet. Margin = 100 × (1 − supply current / limiting current).</p>`;
  }
  ids.forEach(id => {
    $(id).oninput=()=>{ $(id+'-number').value=value(id);$('series-error').textContent='';draw(); };
    $(id+'-number').onchange=()=>{const el=$(id+'-number');if(!el.value||!el.checkValidity()){$('series-error').textContent=`Enter ${el.min}–${el.max} in steps of ${el.step}.`;return;}$(id).value=el.value;$('series-error').textContent='';draw();};
  });
  $('series-hint').onclick=()=>{$('series-hint-text').textContent='Try 150 A, outer diameter 0.90 mm, inner diameter 1.20 mm. Then increase current and see which zone reaches its limit first.';};
  const activate=()=>{root.hidden=document.body.dataset.lessonStage!=='7';draw();};
  document.addEventListener('lesson-stage',activate);
  document.addEventListener('check-design-stage',e=>{if(e.detail.stage!==7)return;const o=result();e.detail.pass=o.pass;e.detail.message=`Bore ${o.central.toFixed(2)} T; outer margin ${o.rows[0].margin.toFixed(1)}%; inner margin ${o.rows[1].margin.toFixed(1)}%. ${value('series-outer')<value('series-inner')?'Outer wire is thinner.':'Choose a thinner outer wire.'}`;});
  new ResizeObserver(draw).observe(root);activate();
})();
