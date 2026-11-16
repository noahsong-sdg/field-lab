const experiments = [
  { start: 105, min: 60, max: 450, step: 7.5, label: 'Full winding length', unit: 'mm',
    goal: 'Meet both requirements: at least 3.0 T at the centre, and less than 0.5% field change 15 mm along the bore.',
    fixed: 'Fixed: bore radius 75 mm · radial thickness 37.5 mm · current density 100 A/mm².',
    prediction: 'Adding winding length at fixed current density makes the central field…', choices: ['Lower', 'Unchanged', 'Higher'], answer: 2,
    discovery: 'Adding winding length raises the central field toward a limit and flattens the central profile. It also uses more conductor. Stretching a fixed-turn coil would be a different experiment.',
    hints: ['Watch both field strength and variation; satisfying only one is insufficient.', 'A longer winding reduces the influence of its ends near the centre.', 'Try 300 mm: the field exceeds the 3.0 T minimum while the variation falls below 0.5%. There is no 4.0 T target.'],
    spoken: 'Central field equals current density times bore radius times a geometric shape factor.',
    transfer: { q: 'A new iron-free coil produces 3.0 T. Keep its geometry fixed and multiply its current density by 1.5. What central field does the ideal model predict?', unit: 'T', value: 4.5, tolerance: .02, why: 'The field is linear in current density: 3.0 × 1.5 = 4.5 T. The conductor’s critical-current limit would still need a separate check.' }
  },
  { start: 1, options: [[1, 'Dipole · uniform field'], [2, 'Quadrupole · linear gradient'], [3, 'Sextupole · quadratic field']], label: 'Winding pattern', unit: '',
    goal: 'Choose a field with zero at the centre and a constant gradient across the aperture.',
    fixed: 'Fixed: cylinder radius a · current-sheet amplitude · infinite length. Probe moves along x; y = 0.',
    prediction: 'Switching from a dipole to a quadrupole makes the field at the centre…', choices: ['Stronger', 'Zero', 'Unchanged'], answer: 1,
    discovery: 'The dipole is uniform. A quadrupole is zero at the centre and grows linearly with distance. A sextupole grows quadratically. Current direction and field direction are different quantities.',
    hints: ['Move the probe: does doubling its distance double the field?', 'A constant gradient means the field grows linearly with distance.', 'Choose the quadrupole, then compare probe positions 0.2a and 0.4a.'],
    spoken: 'Inside the current sheet, a harmonic of order n has field magnitude proportional to radius to the power n minus one.',
    transfer: { q: 'In an ideal quadrupole, the field magnitude is 0.20 units at r = 0.20a. What is it at r = 0.60a?', unit: 'field units', value: .6, tolerance: .005, why: 'Radius has tripled, so the quadrupole field magnitude triples: 0.20 → 0.60. A dipole would stay constant; a sextupole would increase ninefold.' }
  },
  { start: .65, min: .2, max: .8, step: .01, label: 'Probe radius', unit: 'm',
    goal: 'Move the probe to a field of 0.50 T, within 0.01 T.',
    fixed: 'Fixed: 1,000,000 ampere-turns · continuous, azimuthally uniform winding.',
    prediction: 'Moving the probe farther from the centre of the torus makes the field…', choices: ['Weaker', 'Unchanged', 'Stronger'], answer: 0,
    discovery: 'The same enclosed ampere-turns are distributed over a longer circular path, so B decreases as 1/r. The moving square on the curve is the same probe as the square in the torus.',
    hints: ['The field is stronger on the inner side of the torus.', 'Try decreasing the probe radius while watching the linked curve marker.', 'Here B = 0.2/r tesla. A radius of 0.40 m gives 0.50 T.'],
    spoken: 'Toroidal field equals vacuum permeability times ampere-turns divided by two pi times radius.',
    transfer: { q: 'A different ideal toroid has 2,000,000 ampere-turns. What field would a probe at r = 0.50 m measure?', unit: 'T', value: .8, tolerance: .005, why: 'Doubling NI doubles the field at the same radius. With NI = 2,000,000, B = 0.4/r = 0.80 T at 0.50 m.' }
  },
  { start: 1, min: .5, max: 3, step: .05, label: 'Coil separation', unit: 'coil radii',
    goal: 'Make an axial minimum with coil-centre field at least 1.50 times the midplane field.',
    fixed: 'Fixed: equal loop currents and radii · axial field only. Transverse stability is not evaluated.',
    prediction: 'Increasing separation from 1 to 2 coil radii makes the coil-centre / midplane ratio…', choices: ['Fall', 'Stay the same', 'Rise'], answer: 2,
    discovery: 'The midplane field falls as the coils separate, leaving stronger regions near the coils. An axial well is visible, but a minimum of field magnitude in every direction has not been demonstrated.',
    hints: ['Compare the centre circle with the two coil-centre squares.', 'Separating the loops reduces their combined field at the midplane.', 'Try a separation of 2 coil radii. The ratio is approximately 1.54.'],
    spoken: 'The axial field is the sum of the two circular-loop fields, evaluated at their respective distances from the probe.',
    transfer: { q: 'A new design has a 1.2 T midplane and 2.4 T at each mirror end. What can those axial readings establish?', options: ['An axial ratio of 2; transverse stability still needs checking', 'An axial ratio of 0.5 and full stability', 'Confinement of every particle'], answer: 0, why: 'The axial ratio is 2.4/1.2 = 2. Those readings alone say nothing about whether |B| rises in every transverse direction or whether every particle is confined.' }
  },
  { start: 4, options: [4, 8, 16, 32, 64, 128].map(n => [n, `${n} segments`]), label: 'Straight segments', unit: 'segments',
    goal: 'Find the smallest offered segment count with less than 0.10% field error.',
    fixed: 'Fixed: loop radius 1 m · current 1000 A · observation point z = 0.5 m on the axis.',
    prediction: 'Refining this polygon from 8 to 16 segments makes the geometry error…', choices: ['Smaller', 'Unchanged', 'Larger'], answer: 0,
    discovery: 'More straight segments better approximate the circle. The logarithmic error axis gives each tenfold reduction equal space. The selected square shows your cost/accuracy choice; the exact segment integration is unchanged.',
    hints: ['Find the first sample below the dashed tolerance line.', 'More segments are not the goal: use the fewest that meet the tolerance.', '32 segments gives about 0.128% error; 64 gives about 0.032%.'],
    spoken: 'The Biot–Savart law adds the magnetic field contributions of each current element.',
    transfer: { q: 'A new specification permits 0.20% error. From the measured errors below, what is the smallest offered segment count that meets it?', table: [[8, '1.979%'], [16, '0.510%'], [32, '0.128%'], [64, '0.032%']], unit: 'segments', value: 32, tolerance: 0, why: '32 segments is the first offered count below 0.20%. The previous task needed 64 because its tolerance was tighter. Accuracy should follow the specification.' }
  }
];
if (typeof module !== 'undefined') module.exports = experiments;
