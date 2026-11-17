import { element, select } from './dom';
(() => {
  const $ = element;
  // Printed page numbers; PDF pages are offset by 16. Original scans remain unmodified.
  const pages: [number, string, string][] = [
    [
      20,
      'Chapter introduction & solenoid equation',
      'The forward problem predicts fields from a winding; inverse design searches for windings that produce a desired field. The geometry experiment is a forward calculation.',
    ],
    [
      21,
      'Figures 3.1–3.2 · Solenoid geometry & shape factor',
      'a is the inner bore radius, b the outer radius, and l the HALF-length. The slider uses full length 2l. α = b/a and β = l/a; the shape-factor contours show which geometries produce the same field at fixed J and a.',
    ],
    [
      22,
      'Figure 3.3 · Peak / centre field contours',
      'Read α and β for the winding, then the contour Bm/B₀. This ratio is greater than one when the conductor sees more field than the bore centre. Minimum winding volume is not automatically the best conductor-limited design.',
    ],
    [
      23,
      'Figure 3.4 · Central & peak-field load lines',
      'Horizontal axis: field in tesla. Vertical axis: overall winding current density; one unit of 10⁸ A/m² equals 100 A/mm². In (a), follow the peak-field line to R, then move horizontally to P to read the useful centre field at the same J. Q would ignore the peak field. Panels (b) and (c) compare revised geometries.',
    ],
    [
      24,
      'Figure 3.5 · Graded winding load lines',
      'Start at the outside, with zero background field. Each inner section adds field on top of the outer sections. The limiting intersection changes from zone to zone. Different wire sizes let the sections carry the same series current at different overall current densities.',
    ],
    [
      25,
      'Figure 3.6 · Finite-coil field map',
      'The left half shows field-line direction; the right half shows contours of field magnitude relative to the centre. These are different kinds of curves. End effects change both field contribution and local peak field, so the infinite-solenoid grading example overstates the benefit for finite coils.',
    ],
    [
      26,
      'Figure 3.7 · Axial position & field profile',
      'z measures distance along the bore from the centre. Splitting the winding into unequal lengths lets you calculate the on-axis field away from z = 0. Symmetry removes odd powers in the central expansion; axial flatness alone does not establish uniformity everywhere in the bore.',
    ],
    [
      27,
      'Figures 3.8–3.9 · Notched & transverse windings',
      'Figure 3.8 removes winding from selected regions to improve field uniformity. Figure 3.9 changes the winding arrangement to make a transverse field: racetrack or saddle coils. Distinguish shaping an axial field from producing a field across the bore.',
    ],
    [
      28,
      'Figure 3.10 · Overlapping circular cross-sections',
      'Superpose two circular current distributions with opposite current directions. In their overlap the currents cancel while their fields combine to give a uniform transverse field. This is an ideal long-magnet cross-section, not a complete end-winding design.',
    ],
    [
      29,
      'Figure 3.11 · Current-sheet notation',
      'The current-sheet theorem relates fields on opposite sides of a sheet. The complex notation packages the two transverse field components; it does not introduce a third physical field direction.',
    ],
    [
      30,
      'Figure 3.12 · Cylindrical current sheet',
      'Current flows into or out of the page on the cylindrical sheet. Angular current harmonics generate transverse multipoles. For harmonic n, the ideal interior field magnitude scales with radius as r^(n−1): dipole constant, quadrupole linear, sextupole quadratic.',
    ],
    [
      31,
      'Figure 3.13 · Dipole & quadrupole from ellipses',
      'Compare the overlapping and crossed ellipse arrangements. Their symmetry determines which field pattern survives superposition. Relate the dipole to a uniform field and the quadrupole to a field that grows linearly away from the centre.',
    ],
    [
      32,
      'Figure 3.14 · Practical windings; toroid equation',
      'Real coil blocks approximate the ideal continuous current distributions. The toroid discussion then uses a different symmetry: in the ideal uniform torus, Bφ = μ₀NI/(2πr). The field falls as distance r from the torus centre increases.',
    ],
    [
      33,
      'Figure 3.15 · Ideal & discrete toroids',
      'Compare continuous azimuthal symmetry with a ring assembled from separate coils. The ideal 1/r law is exact under the ideal assumptions; discrete coils create variation around the ring. Near individual coils, calculate the actual geometry.',
    ],
    [
      34,
      'Figure 3.16 · Mirror & added quadrupole',
      'Two coils produce high-field ends and an axial magnetic well. The added quadrupole addresses transverse structure. A low point on an axial plot alone does not prove a minimum of field magnitude in every direction or full plasma stability.',
    ],
    [
      35,
      'Figure 3.17 · Baseball & yin-yang coils',
      'These winding geometries produce confinement-field structure with more economical conductor use than simply combining separate coils. Their full three-dimensional field, conductor peaks and forces require numerical calculations.',
    ],
    [
      36,
      'Figure 3.18 · Polygonal conductor cross-section',
      'The source is an extended current-carrying region, not necessarily a single filament. Near or inside a conductor, its cross-section matters. The observation point and polygon boundaries define the integration geometry.',
    ],
    [
      37,
      'Figure 3.19 · Circular loop geometry',
      'On the loop axis there is a simple analytic field formula. Off-axis calculations involve elliptic integrals. Match the observation-point coordinates and loop radius before comparing this formula with a straight-segment approximation.',
    ],
    [
      38,
      'Figure 3.20 · Straight current filament',
      'The directed element runs between its two endpoints; vectors to the observation point determine the cross product in Biot–Savart. The app integrates each straight segment exactly, but a polygon still approximates a circular winding.',
    ],
    [
      39,
      'Iron · differential & integral methods',
      'Iron responds to the field and changes it in turn. Differential methods mesh the field region and require boundary conditions. Integral methods represent the magnetic material and couple its elements. These assumptions are absent from the app’s iron-free winding models.',
    ],
    [
      40,
      'Iron · nonlinear iteration',
      'When magnetic response depends on field, the material coefficients change as the solution changes. Iterate to consistency; a single constant-property linear solve does not capture saturation. The numerical challenge checks geometric convergence, not nonlinear iron convergence.',
    ],
  ];
  const root = $('book-reference');
  root.innerHTML = `<h2 id="book-heading" tabindex="-1">Reading references</h2><p>Companion references to M. N. Wilson, <em>Superconducting Magnets</em>, chapter 3. Consult your own copy; no book scans are distributed with this app.</p><label for="book-page">Printed page <select id="book-page">${pages.map(([p, title]) => `<option value="${p}">${p} · ${title}</option>`).join('')}</select></label><h3 id="book-page-title"></h3><p id="book-guide"></p><button id="book-return" type="button">Back to experiment ↑</button>`;
  function show(p: number) {
    const [, title, guide] = pages[p - 20];
    $('book-page-title').textContent = title;
    $('book-guide').textContent = guide;
  }
  $('book-page').onchange = () => show(+select('book-page').value);
  $('book-return').onclick = () => {
    $('lesson-heading').focus();
    $('lesson-heading').scrollIntoView({ block: 'start' });
  };
  $('page-ref').onclick = () => {
    $('book-heading').focus();
    root.scrollIntoView({ block: 'start' });
  };
  document.addEventListener('lesson-stage', () => {
    $('page-ref').textContent = 'Reading references ↓';
  });
  $('page-ref').textContent = 'Reading references ↓';
  show(20);
})();
