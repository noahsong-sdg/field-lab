import { element as $, input, select } from './dom';
import { PlaygroundModel } from './playground-model';
type PlaygroundState = typeof PlaygroundModel.defaults;
type Analysis = ReturnType<typeof PlaygroundModel.analyse>;
type NumericKey = {
  [K in keyof PlaygroundState]: PlaygroundState[K] extends number ? K : never;
}[keyof PlaygroundState];
type Curve = { points: number[][]; color: string; dash?: boolean };

function button(id: string): HTMLButtonElement {
  const el = $(id);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`Expected button #${id}`);
  return el;
}
type StageCheck = CustomEvent<{ stage: number; pass: boolean; message: string }>;
(() => {
  const M = PlaygroundModel,
    root = $('playground');
  const lessonDefaults = { ...M.defaults, target: 3, tolerance: 0.5, t: 37.5 };
  let state: PlaygroundState = { ...lessonDefaults },
    saved: { state: PlaygroundState; result: Analysis } | null = null,
    frame = 0,
    result: Analysis | null = null,
    lastWidth = 0,
    lastFont = 0;
  const knobs: [NumericKey, string, number, number, number, string][] = [
    ['a', 'Bore radius', 25, 125, 5, 'mm'],
    ['t', 'Winding thickness', 5, 80, 0.5, 'mm'],
    ['l', 'Full winding length', 60, 450, 7.5, 'mm'],
    ['n', 'Turn count', 200, 6000, 100, 'turns'],
    ['d', 'Bare wire diameter', 0.4, 2, 0.05, 'mm'],
    ['ins', 'Radial insulation thickness', 0.02, 0.15, 0.01, 'mm'],
    ['current', 'Transport current', 10, 1500, 10, 'A'],
    ['j', 'Overall current density', 10, 400, 5, 'A/mm²'],
    ['target', 'Required central field', 1, 10, 0.1, 'T'],
    ['region', 'Required axial region length', 5, 100, 5, 'mm'],
    ['tolerance', 'Allowed axial variation', 0.1, 5, 0.1, '%'],
    ['px', 'Probe transverse x', -200, 200, 1, 'mm'],
    ['pz', 'Probe axial z', -400, 400, 1, 'mm'],
    ['offset', 'Relative lateral shift of halves', 0, 20, 1, 'mm'],
    ['imbalance', 'Half-coil current imbalance', -20, 20, 1, '%'],
    ['temperature', 'Operating temperature', 1.9, 16, 0.1, 'K'],
    ['reference', 'Reference active-area Jc', 500, 5000, 100, 'A/mm²'],
    ['fraction', 'Active conductor area fraction', 0.2, 0.8, 0.05, ''],
    ['split', 'Outer zone thickness share', 10, 90, 5, '%'],
    ['allocation', 'Outer zone ampere-turn share', 10, 90, 5, '%'],
  ];
  const controls = (ids: NumericKey[]) =>
    ids
      .map((id) => {
        const [key, label, min, max, step, unit] = knobs.find((k) => k[0] === id)!;
        return `<div class="pg-control"><label for="pg-${key}">${label}<output id="pg-${key}-out"></output></label><input id="pg-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}"><label class="sr-only" for="pg-${key}-number">Exact ${label.toLowerCase()}</label><input id="pg-${key}-number" type="number" min="${min}" max="${max}" step="${step}" value="${state[key]}" aria-label="Exact ${label.toLowerCase()} (${unit || 'fraction'})"></div>`;
      })
      .join('');
  root.innerHTML = `<div class="design-content"><p class="eyebrow">Integrated magnet workbench</p><h2 id="pg-heading" tabindex="-1">Every choice has a cost</h2><p>Change the winding, inspect the field, and try to meet a useful-field specification with at least 20% estimated current margin. Keep a design before changing what you hold constant.</p>
  <p class="source-note">Finite-coil field calculation + explicit engineering estimates. The sampled boundary field is not a guaranteed conductor maximum; passing this exercise does not validate a magnet design.</p>
  <p>Start with the geometry-stage winding at 100 A/mm² overall J. Here, turn count and wire size make the required supply current explicit. The finite-coil sampling gives slightly different field values from the analytic geometry model.</p><div class="pg-actions"><button id="pg-import" type="button">Use geometry-stage winding</button><button type="button" id="pg-keep">Keep design</button><button type="button" id="pg-restore" disabled>Restore kept design</button><button type="button" id="pg-reset">Reset conductor design</button></div><p id="pg-comparison"></p><p id="pg-error" role="alert"></p>
  <div class="pg-workspace"><div class="pg-output"><div id="pg-magnet"></div><div class="axis-key"><span>← −z</span><span>Centre: z = 0</span><span>+z →</span></div><p class="legend">z runs left to right along the bore; transverse x points upward. Longitudinal section · copper: winding pack · shaded box: requested axial region · square: movable probe. Arrows show field direction; brightness indicates magnitude. Probe controls also support keyboard and exact entry.</p><div id="pg-main-metrics" class="readout"></div><div id="pg-requirements" class="requirements"></div><p id="pg-challenge"></p><div id="pg-profile"></div><p class="legend">Solid: current on-axis |B| · dashed: kept design · shaded: requested region · horizontal line: required central field.</p><p id="pg-probe-story"></p></div>
  <div class="pg-knobs"><details open><summary>Geometry & constraints</summary><label for="pg-mode">Hold constant while reshaping</label><select id="pg-mode"><option value="current">Transport current (turn count stays set)</option><option value="density">Overall winding current density</option><option value="volume">Winding-pack volume + transport current</option><option value="conductor">Metal conductor volume + transport current</option></select><p id="pg-constraint" class="fixed"></p><p class="fixed">Disabled controls retain their setpoints for other modes. Read “Actual current” and the constraint note for calculated values.</p>${controls(['a', 't', 'l', 'n', 'd', 'ins', 'current', 'j'])}<div id="pg-wire-section"></div><p id="pg-wire-story"></p></details>
  <details open><summary>Design target & movable probe</summary>${controls(['target', 'region', 'tolerance', 'px', 'pz'])}<button type="button" id="pg-edge">Probe near inner winding edge</button></details>
  <details><summary>Manufacturing imperfections</summary>${controls(['offset', 'imbalance'])}<p class="fixed">The two axial half-packs shift by ± half the offset. Their currents become I(1 ± imbalance). This is two independently powered half-coils, not a broken series-current law.</p></details>
  <details open><summary>Material, temperature & numerical resolution</summary><label for="pg-material">Conductor scaling model</label><select id="pg-material"><option value="nbti">NbTi · Bottura-type scaling</option><option value="nb3sn">Nb₃Sn · Godeke scaling, s = 1</option></select>${controls(['temperature', 'reference', 'fraction'])}<label for="pg-resolution">Straight segments per circular filament</label><select id="pg-resolution"><option>16</option><option selected>32</option><option>64</option><option>128</option></select><p id="pg-material-note"></p><p id="pg-compute"></p></details></div></div>
  <section class="design-module"><p class="eyebrow">Critical surface</p><h2>Temperature changes the operating margin</h2><div id="pg-critical"></div><p id="pg-margin-story"></p><p class="fixed">Solid curve: selected temperature. Dashed curve: 4.2 K reference. Blue dashed line: your winding’s boundary-field load line. White point: operating active current density at the sampled boundary field (when inside the plotted field range). Current-density basis is active conductor area, before the selected dilution. Fits are only evaluated for B ≥ 1 T. Above the fitted upper critical field the current limit is zero.</p></section>
  <section class="design-module"><p class="eyebrow">Engineering consequences</p><h2>More field means more stored energy and force</h2><div id="pg-engineering" class="readout"></div><p>Inductance uses the long-solenoid estimate L = μ₀N²πrmean² / length. Stored energy is ½LI². These estimates become poor for short or thick windings and are withheld for misaligned or unbalanced half-coils. Magnetic pressure B₀²/(2μ₀) and pressure × bore area give a force scale, not a structural stress analysis.</p><p>Normal-state resistance uses only the copper fraction, its full wire length, and ρ = 1.68 × 10⁻⁸ Ω·m at approximately room temperature. It is not cryogenic resistance, a quench model, or a prediction of operating heat.</p></section>
  <section class="design-module"><p class="eyebrow">Separate grading experiment</p><h2>Allocate winding thickness and ampere-turns</h2><div class="design-grid"><div><div id="pg-grading"></div><p id="pg-grade-story"></p></div><div class="design-controls">${controls(['split', 'allocation'])}<p>Two concentric zones, infinite length. Total thickness follows the finite-coil knob, but total ampere-turns per unit length are fixed at the equivalent of 100 A/mm² throughout that thickness. Redistributing them changes local J and field exposure, while the total bore field stays fixed.</p></div></div></section>
  <details><summary>Model details, sources & useful experiments</summary><ul><li>Compare the same length change under fixed current, fixed current density, and captured fixed winding volume. The latter adjusts thickness automatically; conductor volume is the winding volume times its actual metal fill.</li><li>Keep a symmetric design, then shift one half or change its current. Compare the field vector at opposite probe positions.</li><li>Move the probe close to the inner winding boundary and increase angular resolution. The reported difference compares N and 2N segments at that point only; it is not a total error bound.</li><li>Try a thinner wire: more turns fit, but active current density rises at the same current. Watch the estimated margin.</li><li>The field sums exact straight-segment Biot–Savart contributions from a fixed 4 radial × 8 axial sampling of circular windings. No iron or magnetic core is assumed. Interior winding probes are withheld because the filament approximation does not resolve the conductor cross-section.</li><li>Peak field is sampled 0.5 mm inside the inner winding boundary, at 26 positions. It can miss the true conductor peak. No design is certified by these results.</li></ul>
  <p><a href="https://indico.cern.ch/event/1227234/contributions/5601043/attachments/2758197/4803199/2023_CAS_Farinon_II.pdf" target="_blank" rel="noreferrer">CERN Accelerator School: NbTi critical-surface teaching model</a>. NbTi uses Bc2(0) = 14.5 T, Tc = 9.2 K and exponents 0.57, 0.9, 2.32, 1.7; normalized to your reference Jc at 5 T, 4.2 K (default 3000 A/mm²). This combines a published scaling form with an explicit reference value; it is not a fit to your wire.</p>
  <p><a href="https://arxiv.org/html/cond-mat/0608404" target="_blank" rel="noreferrer">Godeke et al., Eq.47 and Table 1</a>. Nb₃Sn uses the published field/temperature shape with Bc2*(0) = 30.7 T, Tc* = 16.8 K, and strain factor s = 1. The user-selected reference Jc at 12 T, 4.2 K defaults to an illustrative 1500 A/mm²; this normalization is not a manufacturer specification. Fit parameters are sample-dependent. The active-area fraction is a user assumption, not a measured composition.</p><p>REBCO retains its sourced specification card in the book desk. It is not offered as a temperature-scaled round-wire model: field angle and measured tape data are required. The two selectable models here are NbTi and Nb₃Sn. The Nb₃Sn scaling relation is primarily supported from about 1 T to 80% of its fitted upper critical field; values beyond that are extrapolations. No strain sensitivity is calculated.</p></details>
  <p id="pg-status" class="sr-only" role="status" aria-live="polite"></p></div>`;
  const metrics = (rows: string[][]) =>
    rows.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
  const f = (n: number | null, d = 2) => (n === null ? 'Not evaluated' : n.toFixed(d));
  function labels() {
    for (const [key, , , , , unit] of knobs) {
      const el = input('pg-' + key);
      el.value = String(state[key]);
      $('pg-' + key + '-out').textContent = `${state[key]} ${unit}`;
      el.setAttribute('aria-valuetext', `${state[key]} ${unit}`);
      if (document.activeElement !== input('pg-' + key + '-number'))
        input('pg-' + key + '-number').value = String(state[key]);
    }
    for (const key of ['t', 'n', 'current', 'j']) {
      const disabled =
        key === 't'
          ? state.mode === 'volume'
          : key === 'n'
            ? state.mode === 'conductor'
            : key === 'current'
              ? state.mode === 'density'
              : state.mode !== 'density';
      input('pg-' + key).disabled = disabled;
      input('pg-' + key + '-number').disabled = disabled;
    }
    select('pg-mode').value = String(state.mode);
    select('pg-material').value = String(state.material);
    select('pg-resolution').value = String(state.resolution);
  }
  function chart(
    id: string,
    curves: Curve[],
    xmin: number,
    xmax: number,
    ymax: number,
    xlabel: string,
    ylabel: string,
    band: number[] | null = null,
    markers: { x: number; y: number }[] = [],
  ) {
    const container = $(id),
      w = Math.max(230, container.clientWidth),
      scale = parseFloat(getComputedStyle(root).fontSize) / 14;
    const yTicks = [0, ymax / 2, ymax];
    const xTicks = [xmin, (xmin + xmax) / 2, xmax];
    // Measure real SVG glyphs with the inherited chart font, not a fixed gutter.
    // Font fallback and enlarged text differ across browsers and operating systems.
    const ruler = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ruler.classList.add('viz');
    ruler.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ruler.append(text);
    container.append(ruler);
    const measure = (label: string) => {
      text.textContent = label;
      return text.getBBox().width;
    };
    let yLabels = yTicks.map((v) => v.toFixed(1));
    if (Math.max(...yLabels.map(measure)) > w * 0.45)
      yLabels = yTicks.map((v) => (v === 0 ? '0' : v.toExponential(1)));
    const yWidth = Math.max(...yLabels.map(measure));
    const xWidths = xTicks.map((v) => measure(v.toFixed(0)));
    const fontHeight = parseFloat(getComputedStyle(text).fontSize);
    ruler.remove();
    const padding = 8,
      gap = 8,
      l = Math.max(52 * scale, yWidth + gap + padding),
      r = w - padding,
      span = r - l,
      showMiddle = span / 2 > Math.max(xWidths[0], xWidths[2]) + xWidths[1] / 2 + gap,
      staggerEnds = xWidths[0] + xWidths[2] + gap > span,
      h = 220 * scale + (staggerEnds ? fontHeight + gap : 0),
      t = Math.max(14, fontHeight),
      b = 220 * scale - 32 * scale;
    const x = (v: number) => l + ((v - xmin) / (xmax - xmin)) * (r - l),
      y = (v: number) => b - (v / ymax) * (b - t);
    let d = band
      ? `<rect x="${x(Math.max(xmin, band[0]))}" y="${t}" width="${Math.max(0, x(Math.min(xmax, band[1])) - x(Math.max(xmin, band[0])))}" height="${b - t}" fill="var(--blue)" opacity=".09"/>`
      : '';
    for (const [i, v] of yTicks.entries())
      d += `<line x1="${l}" x2="${r}" y1="${y(v)}" y2="${y(v)}" class="design-gridline"/><text x="${l - gap}" y="${y(v) + 4}" text-anchor="end">${yLabels[i]}</text>`;
    for (const [i, v] of xTicks.entries()) {
      if (i === 1 && !showMiddle) continue;
      const offset = staggerEnds && i === 2 ? fontHeight + gap : 0;
      d += `<text x="${x(v)}" y="${b + 22 * scale + offset}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${v.toFixed(0)}</text>`;
    }
    for (const c of curves)
      d += `<path d="${c.points.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a)},${y(b)}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2" ${c.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
    for (const m of markers)
      if (m.x >= xmin && m.x <= xmax && m.y <= ymax)
        d += `<circle cx="${x(m.x)}" cy="${y(m.y)}" r="5" fill="var(--ink)" stroke="var(--paper)" stroke-width="2"/>`;
    $(id).innerHTML =
      `<p class="chart-label">${ylabel}</p><svg class="viz" viewBox="0 0 ${w} ${h}" role="img" aria-label="${ylabel} versus ${xlabel}. Numeric summaries follow the plot.">${d}</svg><p class="chart-label x-label">${xlabel}</p>`;
  }
  let mapping: { w: number; h: number; zlim: number; xlim: number };
  function magnet(o: Analysis) {
    const w = Math.max(240, $('pg-magnet').clientWidth),
      h = 250,
      g = o.g,
      zlim = Math.max(0.35, g.l * 0.65, (Math.abs(state.pz) / 1000) * 1.1),
      xlim = Math.max(0.15, (g.a + g.t) * 1.3, (Math.abs(state.px) / 1000) * 1.1),
      sx = (z: number) => ((z / zlim + 1) * w) / 2,
      sy = (x: number) => h / 2 - (x / xlim) * (h / 2 - 12);
    mapping = { w, h, zlim, xlim };
    let d = '';
    const half = state.region / 2000;
    d += `<rect x="${sx(-half)}" y="${sy(g.a * 0.7)}" width="${sx(half) - sx(-half)}" height="${sy(-g.a * 0.7) - sy(g.a * 0.7)}" fill="var(--blue)" opacity=".08"/>`;
    for (const side of [-1, 1])
      for (const radial of [-1, 1]) {
        const z0 = side < 0 ? -g.l / 2 : 0,
          z1 = side < 0 ? 0 : g.l / 2,
          shift = (side * state.offset) / 2000,
          y0 = sy(shift + radial * (g.a + g.t)),
          y1 = sy(shift + radial * g.a);
        d += `<rect x="${sx(z0)}" y="${Math.min(y0, y1)}" width="${sx(z1) - sx(z0)}" height="${Math.abs(y1 - y0)}" fill="url(#pg-copper)" stroke="#d9b080" stroke-width=".6"/>`;
        for (let k = 1; k < 12; k++) {
          const x = sx(z0 + ((z1 - z0) * k) / 12);
          d += `<line x1="${x}" x2="${x}" y1="${y0}" y2="${y1}" stroke="#432e21" opacity=".4"/>`;
        }
      }
    for (let iz = -6; iz <= 6; iz++)
      for (let ix = -3; ix <= 3; ix++) {
        const z = (iz * zlim) / 7,
          x = (ix * xlim) / 4;
        if (M.inside(state, g, x, z)) continue;
        const v = M.field(o.mesh, x, z);
        if (!v || v.b < 1e-9) continue;
        const xx = sx(z),
          yy = sy(x),
          dx = (7 * v.z) / v.b,
          dy = (-7 * v.x) / v.b,
          a = Math.atan2(dy, dx),
          opacity = 0.25 + 0.75 * Math.min(1, v.b / Math.max(0.01, o.peak));
        d += `<path d="M${xx - dx},${yy - dy}L${xx + dx},${yy + dy}m${-4 * Math.cos(a - 0.5)},${-4 * Math.sin(a - 0.5)}L${xx + dx},${yy + dy}l${-4 * Math.cos(a + 0.5)},${-4 * Math.sin(a + 0.5)}" stroke="var(--green)" stroke-opacity="${opacity}" fill="none"/>`;
      }
    const px = sx(state.pz / 1000),
      py = sy(state.px / 1000);
    d += `<rect x="${px - 5}" y="${py - 5}" width="10" height="10" fill="var(--ink)" stroke="var(--paper)"/><circle data-pg-probe cx="${px}" cy="${py}" r="22" fill="transparent" style="touch-action:none;cursor:move"/>`;
    $('pg-magnet').innerHTML =
      `<svg class="viz" viewBox="0 0 ${w} ${h}" role="img" aria-label="Longitudinal field map of the coil. Bore radius ${state.a} mm, length ${state.l} mm. Probe at x ${state.px}, z ${state.pz} mm."><defs><linearGradient id="pg-copper" x2="0" y2="1"><stop stop-color="#ecc393"/><stop offset=".35" stop-color="#c18b56"/><stop offset="1" stop-color="#65462e"/></linearGradient></defs>${d}</svg>`;
  }
  // A single entry bounds memory and reuses expensive physics on resize/keep redraws.
  // The complete state is the key, so no changed model input can use stale results.
  let analysisCache: { key: string; result: Analysis } | null = null;
  function analyseCurrent(): Analysis {
    const key = JSON.stringify(state);
    if (analysisCache?.key === key) return analysisCache.result;
    const result = M.analyse(state);
    analysisCache = { key, result };
    return result;
  }
  function draw() {
    if (root.hidden) return;
    const start = performance.now();
    result = analyseCurrent();
    const o = result,
      g = o.g;
    magnet(o);
    const curves: Curve[] = [
      { points: o.points.map((p) => [p.position * 1000, p.b]), color: 'var(--green)' },
    ];
    const span = Math.max(g.l, saved ? saved.result.g.l : 0) * 500;
    if (saved)
      curves.push({
        points: saved.result.points.map((p) => [p.position * 1000, p.b]),
        color: 'var(--gold)',
        dash: true,
      });
    curves.push({
      points: [
        [-span, state.target],
        [span, state.target],
      ],
      color: 'var(--blue)',
      dash: true,
    });
    chart(
      'pg-profile',
      curves,
      -span,
      span,
      Math.max(
        state.target,
        ...o.points.map((p) => p.b),
        ...(saved ? saved.result.points.map((p) => p.b) : []),
      ) * 1.1,
      'Axial z (mm)',
      'On-axis |B| (T)',
      [-state.region / 2, state.region / 2],
    );
    $('pg-main-metrics').innerHTML = metrics([
      ['Central field', `${f(o.centre.b)} T`],
      ['Boundary field sample', `${f(o.peak)} T`],
      ['Axial variation', `${f(o.variation)}%`],
      ['Estimated margin', o.margin === null ? 'Not evaluated' : `${f(o.margin, 1)}%`],
      ['Winding volume', `${f(g.volume * 1000)} L`],
      ['Actual current', `${f(g.current, 1)} A`],
    ]);
    const fieldPass =
      o.centre.b >= state.target && o.variation <= state.tolerance && state.region <= state.l;
    $('pg-requirements').innerHTML = [
      [
        'Field requirements',
        fieldPass,
        `Centre ≥ ${state.target} T; maximum sampled change ≤ ${state.tolerance}% over z = ±${state.region / 2} mm.`,
      ],
      ['Wire packing', o.fit, 'Selected turns and insulated wire must fit in the winding pack.'],
      [
        'Estimated conductor margin',
        o.margin !== null && o.margin >= 20,
        'At least 20% below the limiting supply current; sampled boundary field, not centre field.',
      ],
      [
        'Symmetry',
        state.offset === 0 && state.imbalance === 0,
        'Restore zero shift and imbalance for this challenge.',
      ],
    ]
      .map(
        ([label, ok, note]) =>
          `<p><strong>${ok ? '✓ Met' : 'Not yet'} · ${label}</strong><br>${note}</p>`,
      )
      .join('');
    const wireRadius = state.d * 22,
      insulatedRadius = (state.d + 2 * state.ins) * 22;
    $('pg-wire-section').innerHTML =
      `<svg class="wire-section" viewBox="0 0 110 110" role="img" aria-label="Wire cross-section: bare diameter ${state.d} mm, radial insulation ${state.ins} mm"><circle cx="55" cy="55" r="${insulatedRadius}" fill="var(--muted)"/><circle cx="55" cy="55" r="${wireRadius}" fill="#c18b56"/><circle cx="55" cy="55" r="${wireRadius * Math.sqrt(state.fraction)}" fill="var(--blue)"/></svg><p>Cross-section: blue = active area, copper = stabilizer, grey = insulation (schematic).<br>Wire J = I / metal area = ${f(g.current / g.area, 0)} A/mm².<br>Active J = I / active area = ${f(o.activeJ, 0)} A/mm².</p>`;
    $('pg-challenge').textContent = o.pass
      ? 'Meets this model’s exercise criteria. Try reducing winding volume and keeping the result. This is not a certified design.'
      : `Not yet: ${[!o.fit ? 'wire does not fit the winding pack' : '', o.centre.b < state.target ? 'central field below target' : '', o.variation > state.tolerance ? 'axial variation too large' : '', o.limit === 0 ? 'temperature at or above fitted critical temperature' : o.margin === null ? 'current margin outside model range' : o.margin < 20 ? 'estimated margin below 20%' : '', state.region > state.l ? 'requested region longer than coil' : '', state.offset || state.imbalance ? 'restore symmetry for the design challenge' : ''].filter(Boolean).join('; ')}.`;
    $('pg-constraint').textContent =
      state.mode === 'volume'
        ? `Captured winding volume ${f(state.volume * 1000)} L. Thickness adjusts to ${f(g.t * 1000)} mm. Turn count and current stay at their set values.`
        : state.mode === 'conductor'
          ? `Metal volume ${(state.metalVolume * 1000).toFixed(2)} L held fixed. Effective turns adjust to ${g.turns.toFixed(1)} (continuous-turn approximation).`
          : state.mode === 'density'
            ? 'Geometry changes current to keep overall J fixed; turn count stays set.'
            : 'Geometry changes leave transport current and turn count at their set values.';
    $('pg-wire-story').textContent =
      `Wire length ≈ ${f(g.wireLength, 0)} m; insulated-circle fill ${(100 * g.fill).toFixed(1)}%. ${o.fit ? 'Below the 90.7% ideal hexagonal packing ceiling; practical winding may need more space.' : 'Exceeds ideal packing: the selected turns and wire cannot fit.'} Bare metal volume ${((g.wireLength * g.area) / 1000).toFixed(2)} L.`;
    $('pg-probe-story').textContent = o.probe
      ? `Probe x=${state.px} mm, z=${state.pz} mm: Bx=${f(o.probe.x, 4)} T, Bz=${f(o.probe.z, 4)} T, |B|=${f(o.probe.b, 4)} T. ${o.error === null ? 'Relative error undefined at zero field.' : `${f(o.error, 3)}% magnitude difference when doubling angular resolution.`}`
      : 'Probe lies in the winding pack: field withheld because discrete filaments do not resolve conductor interior. Move the probe into the bore or outside.';
    $('pg-comparison').textContent = saved
      ? `Kept: ${f(saved.result.centre.b)} T, ${f(saved.result.g.volume * 1000)} L. Current change: ${f(o.centre.b - saved.result.centre.b)} T; ${f((g.volume - saved.result.g.volume) * 1000)} L.`
      : 'Keep a design to overlay its axial field and compare volume.';
    const values = Array.from({ length: 80 }, (_, i) => 1 + (i * 24) / 79),
      crit = values.map((b) => [b, M.critical(state, b) ?? 0]),
      ref = values.map((b) => [b, M.critical(state, b, 4.2) ?? 0]);
    chart(
      'pg-critical',
      [
        { points: crit, color: 'var(--green)' },
        { points: ref, color: 'var(--gold)', dash: true },
        {
          points: values
            .map((b) => [b, (b / o.peak) * o.activeJ])
            .filter(
              (p) =>
                p[1] <=
                Math.max(1, o.activeJ, ...crit.map((p) => p[1]), ...ref.map((p) => p[1])) * 1.05,
            ),
          color: 'var(--blue)',
          dash: true,
        },
      ],
      1,
      25,
      Math.max(1, o.activeJ, ...crit.map((p) => p[1]), ...ref.map((p) => p[1])) * 1.05,
      'Field (T)',
      'Active-area Jc (A/mm²)',
      null,
      [{ x: o.peak, y: o.activeJ }],
    );
    $('pg-material-note').textContent =
      `${state.material === 'nbti' ? 'NbTi: reference at 5 T, 4.2 K; Tc = 9.2 K.' : 'Nb₃Sn: reference at 12 T, 4.2 K; Tc* = 16.8 K; strain fixed at s = 1.'} Reference amplitude and active fraction are explicit teaching inputs, not a vendor guarantee.`;
    $('pg-margin-story').textContent =
      `Operating active-area J = ${f(o.activeJ, 0)} A/mm². ${o.jc === null ? 'Boundary field below 1 T: no low-field fit extrapolation or margin is reported.' : `At the sampled boundary field the selected-temperature curve gives Jc = ${f(o.jc, 0)} A/mm². Estimated limiting supply current = ${f(o.limit, 1)} A.`} Boundary sampling can miss the true peak; compare resolution and do not interpret this as a protection calculation.`;
    const symmetric = state.offset === 0 && state.imbalance === 0;
    $('pg-engineering').innerHTML = metrics([
      ['L · long-coil estimate', symmetric ? `${f(o.inductance * 1000)} mH` : 'Withheld'],
      ['Stored energy estimate', symmetric ? `${f(o.energy / 1000)} kJ` : 'Withheld'],
      ['Central magnetic pressure', `${f(o.pressure / 1e6)} MPa`],
      ['Pressure × bore area', `${f(o.force / 1000)} kN`],
      ['Copper-only R at ~293 K', `${f(o.resistance, 3)} Ω`],
    ]);
    const rows = M.grading(state);
    $('pg-grading').innerHTML =
      `<table><thead><tr><th>Zone</th><th>Δr (mm)</th><th>J (A/mm²)</th><th>Inner B (T)</th></tr></thead><tbody>${rows.map((r, i) => `<tr><th>${i ? 'Inner' : 'Outer'}</th><td>${f(r.thickness, 1)}</td><td>${f(r.j, 1)}</td><td>${f(r.end)}</td></tr>`).join('')}</tbody></table>`;
    $('pg-grade-story').textContent =
      `Bore field stays ${f(rows[1].end)} T. ${state.split === state.allocation ? 'Equal thickness and ampere-turn shares give equal current densities.' : 'A zone receiving more ampere-turn share than thickness share must carry higher current density.'} This table is an allocation calculation, not a solved conductor-limit optimization.`;
    $('pg-compute').textContent =
      `${state.resolution * 32} segments in the field model; ${(performance.now() - start).toFixed(0)} ms for this update including comparison. Probe convergence uses twice that angular resolution. Fixed 4 × 8 winding quadrature error is not included.`;
  }
  function scheduleDraw() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
  }
  function schedule() {
    labels();
    scheduleDraw();
  }
  for (const [key, label] of knobs) {
    const range = input('pg-' + key),
      number = input('pg-' + key + '-number');
    range.oninput = () => {
      state[key] = +range.value;
      number.value = range.value;
      schedule();
    };
    range.onchange = () => {
      $('pg-status').textContent = `${label}: ${state[key]}. ${$('pg-probe-story').textContent}`;
    };
    number.onchange = () => {
      if (number.value === '' || !number.checkValidity()) {
        $('pg-error').textContent =
          `Enter a valid ${label.toLowerCase()} between ${number.min} and ${number.max}, step ${number.step}.`;
        return;
      }
      $('pg-error').textContent = '';
      state[key] = +number.value;
      schedule();
    };
  }
  select('pg-mode').onchange = () => {
    if (select('pg-mode').value === 'volume') state.volume = M.geometry(state).volume;
    if (select('pg-mode').value === 'conductor') {
      const g = M.geometry(state);
      state.metalVolume = g.wireLength * g.area * 1e-6;
    }
    state.mode = select('pg-mode').value as PlaygroundState['mode'];
    schedule();
  };
  select('pg-material').onchange = () => {
    state.material = select('pg-material').value as PlaygroundState['material'];
    state.reference = state.material === 'nbti' ? 3000 : 1500;
    schedule();
  };
  select('pg-resolution').onchange = () => {
    state.resolution = +select('pg-resolution').value;
    schedule();
  };
  $('pg-keep').onclick = () => {
    saved = { state: { ...state }, result: analyseCurrent() };
    button('pg-restore').disabled = false;
    draw();
  };
  button('pg-restore').onclick = () => {
    if (!saved) return;
    state = { ...saved.state };
    schedule();
  };
  $('pg-reset').onclick = () => {
    state = { ...lessonDefaults };
    saved = null;
    button('pg-restore').disabled = true;
    $('pg-error').textContent = '';
    schedule();
  };
  $('pg-edge').onclick = () => {
    state.px = Math.round(M.geometry(state).a * 1000 - 1);
    state.pz = 0;
    schedule();
  };
  let dragging = false;
  $('pg-magnet').onpointerdown = (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-pg-probe]')) return;
    dragging = true;
    $('pg-magnet').setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  $('pg-magnet').onpointermove = (e) => {
    if (!dragging) return;
    const rect = $('pg-magnet').getBoundingClientRect();
    state.pz = Math.max(
      -400,
      Math.min(
        400,
        Math.round((((e.clientX - rect.left) / rect.width) * 2 - 1) * mapping.zlim * 1000),
      ),
    );
    state.px = Math.max(
      -200,
      Math.min(
        200,
        Math.round(
          ((mapping.h / 2 - ((e.clientY - rect.top) * mapping.h) / rect.height) /
            (mapping.h / 2 - 12)) *
            mapping.xlim *
            1000,
        ),
      ),
    );
    schedule();
  };
  $('pg-magnet').onpointerup = () => {
    dragging = false;
  };
  $('pg-magnet').onpointercancel = () => {
    dragging = false;
  };
  let imported = false;
  function importGeometry() {
    state = {
      ...lessonDefaults,
      l: Number(document.body.dataset.geometryLength ?? lessonDefaults.l),
      mode: 'density',
      j: 100,
    };
    saved = null;
    button('pg-restore').disabled = true;
    $('pg-error').textContent = '';
    imported = true;
    schedule();
  }
  $('pg-import').onclick = importGeometry;
  const activate = () => {
    if (!root.hidden) {
      if (!imported) importGeometry();
      else schedule();
    }
  };
  document.addEventListener('chapter-reset', () => {
    state = { ...lessonDefaults };
    saved = null;
    imported = false;
    button('pg-restore').disabled = true;
    $('pg-error').textContent = '';
    labels();
  });
  document.addEventListener('lesson-stage', activate);
  document.addEventListener('check-design-stage', (event) => {
    const e = event as StageCheck;
    if (e.detail.stage !== 6) return;
    draw();
    e.detail.pass = result?.pass ?? false;
    e.detail.message = $('pg-challenge').textContent ?? '';
  });
  new ResizeObserver(() => {
    const font = parseFloat(getComputedStyle(root).fontSize);
    if (!root.hidden && (root.clientWidth !== lastWidth || font !== lastFont)) {
      lastWidth = root.clientWidth;
      lastFont = font;
      // Labels are unchanged on resize; defer all layout writes to the next frame.
      scheduleDraw();
    }
  }).observe(root);
  labels();
  activate();
})();
