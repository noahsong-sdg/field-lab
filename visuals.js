const FieldVisuals = (() => {
  const M = typeof FieldModel === 'undefined' ? require('./model.js') : FieldModel;
  const counts = [4, 8, 16, 32, 64, 128], errors = counts.map(n => [n, M.error(n)]);
  const field = (length, z = 0) => M.solenoid(length / 150, z * .075);
  const variation = v => 100 * Math.abs(field(v, .2) / field(v) - 1);
  const ratio = v => M.mirror(v, v / 2) / M.mirror(v, 0);
  const pass = (i, v) => [() => field(v) >= 3 && variation(v) < .5, () => v === 2, () => Math.abs(M.toroid(v) - .5) <= .010000001, () => v > 1 && ratio(v) >= 1.5, () => v === counts.find(n => M.error(n) < .1)][i]();
  const txt = (x, y, t, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
  const line = (x1, y1, x2, y2, cls = 'axis') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const circle = (x, y, r, cls) => `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
  const mark = (x, y, type = 'square', cls = 'sample') => type === 'circle' ? circle(x, y, 5, cls) : type === 'diamond' ? `<path class="${cls}" d="M${x},${y - 7}l7,7l-7,7l-7,-7Z"/>` : `<rect class="${cls}" x="${x - 5}" y="${y - 5}" width="10" height="10"/>`;
  const svg = (w, h, content, label) => `<svg class="viz" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${content}</svg>`;
  const grab = (x, y, kind) => `<circle data-drag="${kind}" class="grab" cx="${x}" cy="${y}" r="22"/>`;
  // Shared material lighting, confined to the magnet SVG (charts remain unshaded).
  const materials = `<defs>
    <linearGradient id="copper" x1="0" y1="0" x2="0.25" y2="1"><stop stop-color="#8e482e"/><stop offset=".19" stop-color="#eeb995"/><stop offset=".32" stop-color="#ffe0b6"/><stop offset=".48" stop-color="#bd7950"/><stop offset=".78" stop-color="#80432e"/><stop offset="1" stop-color="#3c2924"/></linearGradient>
    <linearGradient id="cut-face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4c8a0"/><stop offset=".35" stop-color="#c4885d"/><stop offset="1" stop-color="#593a2c"/></linearGradient>
    <linearGradient id="bore" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="#080e12"/><stop offset=".6" stop-color="#15232b"/><stop offset="1" stop-color="#42505a"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#778892"/><stop offset=".25" stop-color="#c1cbd0"/><stop offset=".5" stop-color="#485863"/><stop offset="1" stop-color="#18232c"/></linearGradient>
  </defs>`;
  const ellipsePath = (x, y, rx, ry) => `M${x},${y - ry}a${rx},${ry} 0 1 1 0,${2 * ry}a${rx},${ry} 0 1 1 0,${-2 * ry}Z`;
  function winding(left, right, cy, turns) {
    const rx = 18, ry = 44;
    let d = `<ellipse cx="${(left + right) / 2}" cy="${cy + 53}" rx="${(right - left) / 2 + 23}" ry="7" fill="#04080b" opacity=".65"/>`;
    d += `<ellipse cx="${right}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#cut-face)"/>`;
    d += `<path class="winding-surface" d="M${left},${cy - ry}H${right}a${rx},${ry} 0 0 1 0,${2 * ry}H${left}Z" fill="url(#copper)"/>`;
    for (let k = 1; k < turns; k++) {
      const x = left + (right - left) * k / turns;
      d += `<path class="winding-groove" d="M${x},${cy - ry}a${rx},${ry} 0 0 1 0,${2 * ry}" fill="none" stroke="#301e18" stroke-opacity=".5" stroke-width="1.4"/>`;
      d += `<path d="M${x + 1},${cy - ry + 1}a${rx - 1},${ry - 1} 0 0 1 0,${2 * ry - 2}" fill="none" stroke="#ffe0b6" stroke-opacity=".17" stroke-width=".7"/>`;
    }
    d += `<ellipse cx="${left}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#cut-face)" stroke="#dfb18b" stroke-width=".7"/>`;
    d += `<ellipse cx="${left}" cy="${cy}" rx="12" ry="29" fill="url(#bore)" stroke="#523728" stroke-width="1.5"/>`;
    d += `<path d="M${left},${cy - 41}a16,41 0 0 0 0,82" fill="none" stroke="#ffdbb0" stroke-opacity=".7" stroke-width="1"/>`;
    return d;
  }
  function chart(w, scale, cfg) {
    const h = 225 * scale, left = 57 * scale, right = w - 20, top = 32 * scale, bottom = h - 45 * scale;
    const transform = (n, log) => log ? Math.log10(n) : n;
    const position = (v, domain, a, b, log) => a + (transform(v, log) - transform(domain[0], log)) / (transform(domain[1], log) - transform(domain[0], log)) * (b - a);
    const x = v => position(v, cfg.x, left, right, cfg.logX), y = v => position(v, cfg.y, bottom, top, cfg.logY);
    const path = points => points.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a).toFixed(2)},${y(b).toFixed(2)}`).join(' ');
    const sample = fn => Array.from({ length: 121 }, (_, i) => { const p = cfg.x[0] + (cfg.x[1] - cfg.x[0]) * i / 120; return [p, fn(p)]; });
    let d = line(left, top, left, bottom) + line(left, bottom, right, bottom);
    if (cfg.band) d += `<rect class="band" x="${x(cfg.band[0])}" y="${top}" width="${x(cfg.band[1]) - x(cfg.band[0])}" height="${bottom - top}"/>`;
    for (const t of cfg.xticks) d += line(x(t), bottom, x(t), bottom + 4) + txt(x(t), bottom + 20 * scale, t, t === cfg.x[0] ? 'start' : t === cfg.x[1] ? 'end' : 'middle');
    for (const t of cfg.yticks) d += txt(left - 8, y(t) + 4, Number(t.toPrecision(3)), 'end');
    if (cfg.threshold) d += line(left, y(cfg.threshold), right, y(cfg.threshold), 'threshold');
    if (cfg.kept) d += `<path class="kept-curve" d="${path(sample(cfg.kept))}"/>`;
    d += `<path class="curve" d="${path(cfg.points || sample(cfg.fn))}"/>`;
    for (const [px, py, type = 'square', cls = 'sample'] of cfg.marks || []) d += line(x(px), y(py), x(px), bottom, 'guide') + mark(x(px), y(py), type, cls);
    return `<p class="chart-label">${cfg.ylabel}</p>` + svg(w, h, d, cfg.description) + `<p class="chart-label x-label">${cfg.xlabel}</p>`;
  }
  function render(i, v, kept, probe, zoom, w, scale = 1) {
    const cx = w / 2, s = Math.min((w - 60) / 2, 70), same = kept !== null;
    let sketch = '', graph = '', readout = [], rows = [], summary = '', compare = '', legend = '', caption = '', explanation = '';
    if (i === 0) {
      const half = v / 450 * (w - 50) / 2, left = cx - half, B = field(v), dev = variation(v);
      let d = materials + winding(left, cx + half, 80, Math.round(v / 7.5));
      for (const dy of [-16, 0, 16]) {
        d += `<path class="magnet-flux" style="stroke-width:${.7 + B / 5};opacity:${.35 + B / 14}" d="M${Math.max(12,left - 15)},${80 + dy}H${Math.min(w - 12,cx + half + 15)}"/>`;
        d += `<path class="flux-tip" d="M${cx + half + 7},${76 + dy}l7,4l-7,4Z"/>`;
      }
      const sampleX = cx + .2 * (w - 50) / 6;
      d += mark(cx, 80, 'circle') + mark(sampleX, 80);
      d += line(cx, 88, cx, 151, 'guide') + line(sampleX, 88, sampleX, 151, 'guide');
      d += line(20, 151, w - 20, 151) + `<path d="M${w - 27},147l7,4l-7,4M27,147l-7,4l7,4" fill="none" stroke="currentColor"/>`;
      sketch = svg(w, 160, d, `Copper solenoid with an open bore: ${v} millimetre winding and ${B.toFixed(2)} tesla at the centre. Winding length and turn marks increase together. The z axis runs horizontally along the bore, positive to the right. Circle: centre, z = 0. Square: z = +15 mm. Green arrows show axial field direction; thickness represents centre field strength.`) + `<div class="axis-key"><span>← −z</span><span>z = 0 at centre</span><span>+z →</span></div>`;
      const xdom = zoom ? [-.25, .25] : [-4, 4], extrema = [field(v, xdom[1]), B, ...(same ? [field(kept, xdom[1]), field(kept)] : [])];
      const ydom = zoom ? [Math.min(...extrema) * .995, Math.max(...extrema) * 1.005] : [0, 5];
      graph = chart(w, scale, { x: xdom, y: ydom, fn: z => field(v, z), kept: same ? z => field(kept, z) : null, band: [-.2, .2], marks: [[0, B, 'circle'], [.2, field(v, .2)]], xticks: zoom ? [-.25, 0, .25] : [-4, 0, 4], yticks: zoom ? ydom : [0, 2.5, 5], xlabel: 'Axial position z/a', ylabel: 'Axial field Bz (T)', description: `The field peaks at the centre, ${B.toFixed(3)} tesla. At 0.2 bore radii it is ${field(v, .2).toFixed(3)} tesla, a ${dev.toFixed(3)} percent drop.` });
      readout = [['● Centre · z = 0', `${B.toFixed(4)} T`], ['■ Sample · z = +15 mm', `${field(v, .2).toFixed(4)} T`], ['Centre-to-sample change', `${dev.toFixed(3)}%`], ['Winding volume', `${(Math.PI * (.1125 ** 2 - .075 ** 2) * v).toFixed(2)} L`]];
      explanation = `<div class="criteria"><p class="coordinate-key">● Centre: z = 0<br>■ Sample: z = +15 mm = 0.2a<br><strong>z</strong> measures distance along the bore; <strong>a = 75 mm</strong> is the bore radius.</p><p><strong>${B >= 3 ? '✓ Met' : 'Not yet'} · Field strength</strong><br>${B.toFixed(4)} T ≥ 3.0 T required. This is a minimum, not an exact target; 4.0 T is not required.</p><p><strong>${dev < .5 ? '✓ Met' : 'Not yet'} · Axial variation</strong><br>${dev.toFixed(3)}% &lt; 0.5% required.</p><p>“Axial” means along the bore’s z axis. Here, variation compares just the centre with the sample 15 mm to its right:</p><p class="variation-equation">100 × |B(+15 mm) − B(0)| / B(0)<br>= 100 × ${Math.abs(field(v, .2) - B).toFixed(5)} / ${B.toFixed(5)} ≈ ${dev.toFixed(3)}%</p><p>The field is ${dev.toFixed(3)}% lower at the sample. This is a two-point check, not a test of uniformity throughout the bore.</p></div>`;
      summary = `Length ${v} mm: centre ${B.toFixed(2)} T; variation ${dev.toFixed(3)}%. Longer windings approach a flatter central profile and use more conductor.`;
      rows = [-1, -.2, 0, .2, 1].map(z => [`z/a = ${z}`, `${field(v, z).toFixed(4)} T`]);
      legend = '● Centre: z = 0 · ■ Sample: z = +15 mm = 0.2a · shaded: −15 to +15 mm. Plot positions are divided by bore radius a = 75 mm.'; caption = 'Shaded winding with a recessed bore. Green arrows thicken with the calculated centre field; they are not traced field lines. Added length adds conductor. Perspective and turns are schematic.';
      if (same) compare = `Kept ${kept} mm: ${field(kept).toFixed(2)} T, ${variation(kept).toFixed(3)}% variation. Now: ${(B - field(kept)).toFixed(2)} T change.`;
    } else if (i === 1) {
      const cy = 100, r = Math.min((w - 65) / 2, 83);
      let d = materials + `<path d="${ellipsePath(cx, cy, r + 12, r + 12)}${ellipsePath(cx, cy, r - 3, r - 3)}" fill="url(#cut-face)" fill-rule="evenodd"/><circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="url(#bore)"/>` + circle(cx, cy, r, 'aperture') + line(cx - r, cy, cx + r + 14, cy) + line(cx, cy + r, cx, cy - r - 12) + txt(cx + r + 14, cy - 8, 'x', 'end') + txt(cx + 7, cy - r - 7, 'y');
      for (let k = 0; k < 24; k++) {
        const t = k * 2 * Math.PI / 24, g = Math.cos(v * t), x = cx + r * Math.cos(t), y = cy - r * Math.sin(t);
        if (Math.abs(g) < .1) continue;
        d += circle(x, y, 5, g > 0 ? 'current-out' : 'current-in');
        d += g > 0 ? circle(x, y, 1.8, 'dot') : line(x - 3, y - 3, x + 3, y + 3, 'cross') + line(x - 3, y + 3, x + 3, y - 3, 'cross');
      }
      for (let ix = -3; ix <= 3; ix++) for (let iy = -3; iy <= 3; iy++) {
        const x = ix * .22, y = iy * .22; if (Math.hypot(x, y) > .8) continue;
        const b = M.transverse(v, x, y), px = cx + x * r, py = cy - y * r, dx = b.x * r * .16, dy = -b.y * r * .16, a = Math.atan2(dy, dx);
        if (Math.hypot(dx, dy) > .1) d += line(px - dx / 2, py - dy / 2, px + dx / 2, py + dy / 2, 'field') + line(px + dx / 2, py + dy / 2, px + dx / 2 - 4 * Math.cos(a - .6), py + dy / 2 - 4 * Math.sin(a - .6), 'field') + line(px + dx / 2, py + dy / 2, px + dx / 2 - 4 * Math.cos(a + .6), py + dy / 2 - 4 * Math.sin(a + .6), 'field');
      }
      d += mark(cx + probe * r, cy) + grab(cx + probe * r, cy, 'probe');
      sketch = svg(w, 200, d, `${v} out-of-page and ${v} into-page current regions alternate around the aperture. Probe x/a = ${probe.toFixed(2)}, y = 0. Arrows show the field; length shows magnitude.`);
      graph = chart(w, scale, { x: [0, .8], y: [0, 1.1], fn: x => x ** (v - 1), kept: same ? x => x ** (kept - 1) : null, marks: [[probe, probe ** (v - 1)]], xticks: [0, .4, .8], yticks: [0, .5, 1], xlabel: 'Probe distance x/a (y = 0)', ylabel: 'Field magnitude (normalized)', description: `Magnitude varies as radius to power ${v - 1}; at the probe it is ${(probe ** (v - 1)).toFixed(3)} normalized units.` });
      readout = [['At probe', `${(probe ** (v - 1)).toFixed(3)} units`], ['Centre', v === 1 ? '1.000 unit' : 'Zero']];
      summary = `${['Dipole: constant field.', 'Quadrupole: linear growth from zero.', 'Sextupole: quadratic growth from zero.'][v - 1]} At x/a = ${probe.toFixed(2)}, Bx = 0 and By = ${(-(probe ** (v - 1))).toFixed(3)} normalized units.`;
      rows = [0, .2, .4, .6, .8].map(x => [`x/a = ${x}`, `${(x ** (v - 1)).toFixed(3)} units`]);
      legend = '■ Linked probe · arrow length = field magnitude'; caption = '⊙ Current out of page (+z) · ⊗ into page (−z). Drag the square along x, or use the probe control.';
      if (same) compare = `Kept ${['dipole', 'quadrupole', 'sextupole'][kept - 1]}: ${(probe ** (kept - 1)).toFixed(3)} units at the same probe; current ${(probe ** (v - 1)).toFixed(3)}.`;
    } else if (i === 2) {
      const cy = 80, rscale = s / .8;
      let d = materials + `<path d="${ellipsePath(cx, cy + 5, s, s)}${ellipsePath(cx, cy + 5, s / 4, s / 4)}" fill="#39281f" fill-rule="evenodd"/>`;
      d += `<path d="${ellipsePath(cx, cy, s, s)}${ellipsePath(cx, cy, s / 4, s / 4)}" fill="url(#copper)" fill-rule="evenodd" stroke="#d5a17b" stroke-width=".7"/>`;
      for (let k = 0; k < 40; k++) {
        const t = k * Math.PI / 20, point = (r, a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        d += `<path d="M${point(s * .26, t)}Q${point(s * .64, t + .035)} ${point(s * .99, t)}" fill="none" stroke="#43291d" stroke-opacity=".65" stroke-width="1.5"/>`;
        d += `<path d="M${point(s * .28, t + .016)}Q${point(s * .64, t + .05)} ${point(s * .98, t + .016)}" fill="none" stroke="#ffe0b6" stroke-opacity=".3" stroke-width=".7"/>`;
      }
      d += circle(cx, cy, v * rscale, 'probe-ring');
      for (const r of [.3, .5, .7]) d += circle(cx, cy, r * rscale, 'field-ring') + txt(cx + r * rscale, cy + 4, '↑', 'middle');
      d += line(cx, cy, cx + s + 15, cy) + mark(cx + v * rscale, cy) + grab(cx + v * rscale, cy, 'radius');
      if (same) d += mark(cx + kept * rscale, cy, 'diamond', 'kept-mark');
      sketch = svg(w, 160, d, `Ideal torus, radial probe at ${v.toFixed(2)} metres; field ${M.toroid(v).toFixed(3)} tesla.`);
      graph = chart(w, scale, { x: [.2, .8], y: [0, 1.05], fn: M.toroid, marks: [[v, M.toroid(v)], ...(same ? [[kept, M.toroid(kept), 'diamond', 'kept-mark']] : [])], xticks: [.2, .4, .8], yticks: [0, .5, 1], threshold: .5, xlabel: 'Radius r (m)', ylabel: 'Toroidal field Bφ (T)', description: `Field decreases inversely with radius. Square probe: ${v.toFixed(2)} metres, ${M.toroid(v).toFixed(3)} tesla; target 0.50 tesla.` });
      readout = [['Probe field', `${M.toroid(v).toFixed(3)} T`], ['Target', '0.50 ± 0.01 T']];
      summary = `At radius ${v.toFixed(2)} metres, field is ${M.toroid(v).toFixed(3)} tesla. Move inward to strengthen the field; outward to weaken it.`;
      rows = [.2, .4, v, .8].map(r => [`r = ${r.toFixed(2)} m`, `${M.toroid(r).toFixed(3)} T`]);
      legend = '■ Probe · dashed: 0.50 T target'; caption = 'Top view of the working annulus. Drag the square radially, or use the radius control.';
      if (same) compare = `Kept r = ${kept.toFixed(2)} m: ${M.toroid(kept).toFixed(3)} T. Current change: ${(M.toroid(v) - M.toroid(kept)).toFixed(3)} T.`;
    } else if (i === 3) {
      const spacing = (w - 100) / 3, offset = v * spacing / 2, cy = 80;
      let d = materials + line(20, cy, w - 20, cy) + mark(cx, cy, 'circle');
      for (const sign of [-1, 1]) {
        const x = cx + sign * offset;
        d += winding(x - 7, x + 7, cy, 6);
        d += mark(x, cy) + grab(x, cy, 'separation');
      }
      // Encode the calculated axial profile, without claiming an off-axis solution.
      for (let k = -6; k <= 6; k++) { const x = cx + k * (w - 50) / 14, b = M.mirror(v, (x - cx) / spacing); d += `<circle class="field-bead" cx="${x}" cy="${cy + 19}" r="${2 + 5 * b}"/>`; }
      sketch = svg(w, 160, d, `Two equal copper coils separated by ${v.toFixed(2)} radii. Circle marks the midplane; squares mark the coil centres.`);
      graph = chart(w, scale, { x: [-3, 3], y: [0, 1], fn: z => M.mirror(v, z), kept: same ? z => M.mirror(kept, z) : null, marks: [[0, M.mirror(v, 0), 'circle'], [-v / 2, M.mirror(v, v / 2)], [v / 2, M.mirror(v, v / 2)]], xticks: [-3, 0, 3], yticks: [0, .5, 1], xlabel: 'Axial position z/a', ylabel: 'Axial field (normalized)', description: `Midplane field ${M.mirror(v, 0).toFixed(3)}, coil-centre field ${M.mirror(v, v / 2).toFixed(3)}, ratio ${ratio(v).toFixed(2)}. Only the axial profile is calculated.` });
      readout = [['Coil / midplane', ratio(v).toFixed(2)], ['Axial centre', v > 1 ? 'Minimum' : v === 1 ? 'Flat to 2nd order' : 'Maximum']];
      summary = `Separation ${v.toFixed(2)} radii: coil-centre to midplane ratio ${ratio(v).toFixed(2)}. ${v > 1 ? 'An axial well is present.' : 'The coil separation has not produced an axial well.'} Transverse stability remains untested.`;
      rows = [-v / 2, 0, v / 2].map(z => [`z/a = ${z.toFixed(2)}`, M.mirror(v, z).toFixed(4)]);
      legend = '● Midplane · ■ Coil centres'; caption = 'Drag either coil horizontally, or use the separation control. Green bead size shows the calculated axial field. This view tests an axial well only.';
      if (same) compare = `Kept separation ${kept.toFixed(2)}: ratio ${ratio(kept).toFixed(2)}. Current ratio ${ratio(v).toFixed(2)}.`;
    } else {
      const cy = 62, r = 49;
      const polygon = n => Array.from({ length: n }, (_, k) => `${cx + r * Math.cos(k * 2 * Math.PI / n)},${cy - r * Math.sin(k * 2 * Math.PI / n)}`).join(' ');
      let d = materials + circle(cx, cy, r, 'reference-circle');
      if (same) d += `<polygon class="kept-curve" points="${polygon(kept)}"/>`;
      d += `<polygon points="${polygon(v)}" transform="translate(0 3)" fill="none" stroke="#36251e" stroke-width="7" stroke-linejoin="round"/><polygon class="material-polygon" points="${polygon(v)}" fill="none" stroke="url(#copper)" stroke-width="6" stroke-linejoin="round"/><polygon points="${polygon(v)}" fill="none" stroke="#ffd9b1" stroke-opacity=".45" stroke-width=".7" stroke-linejoin="round"/>`;
      sketch = svg(w, 125, d, `${v} straight segments approximate a circle. Geometry field error is ${M.error(v).toFixed(4)} percent.`);
      graph = chart(w, scale, { x: [4, 128], y: [.005, 10], logX: true, logY: true, points: errors, marks: [[v, M.error(v)], ...(same ? [[kept, M.error(kept), 'diamond', 'kept-mark']] : [])], xticks: w < 370 * scale ? [4, 16, 128] : [4, 16, 64, 128], yticks: [.01, .1, 1, 10], threshold: .1, xlabel: 'Segments N (log scale)', ylabel: 'Error % (log scale)', description: `Selected ${v} segments: ${M.error(v).toFixed(4)} percent error. Dashed target: 0.10 percent. Equal vertical spacing means a tenfold error change.` });
      readout = [['Field error', `${M.error(v).toFixed(4)}%`], ['Computed Bz', `${(M.polygonLoop(v) * 1000).toFixed(4)} mT`]];
      summary = `${v} segments: ${M.error(v).toFixed(4)} percent error, ${M.error(v) < .1 ? 'below' : 'above'} the 0.10 percent tolerance. The exact circular-loop reference is ${(M.loopExact(.5) * 1000).toFixed(4)} millitesla.`;
      rows = errors.map(([n, e]) => [`${n} segments`, `${e.toFixed(4)}%`]);
      legend = '■ Selected count · dashed: 0.10% tolerance'; caption = 'Solid polygon approximates the dotted circular reference. The error comes from geometry approximation.';
      if (same) compare = `Kept ${kept} segments: ${M.error(kept).toFixed(4)}%. Current ${v}: ${M.error(v).toFixed(4)}%.`;
    }
    return { sketch, graph, readout, rows, summary, compare, legend, caption, explanation };
  }
  function dragValue(i, kind, x, w) {
    if (kind === 'probe') return (x - w / 2) / Math.min((w - 65) / 2, 83);
    if (kind === 'radius') return (x - w / 2) / (Math.min((w - 60) / 2, 70) / .8);
    return 2 * Math.abs(x - w / 2) / ((w - 100) / 3);
  }
  return { render, pass, dragValue };
})();
if (typeof module !== 'undefined') module.exports = FieldVisuals;
