/* Wilson pp.22–25: overall winding J in A/mm²; fields in tesla. */
export const DesignModel = (() => {
  const points: [number, number][] = [
    [0, 700],
    [4.2, 420],
    [6, 300],
    [6.7, 250],
    [7.5, 200],
    [7.6, 190],
    [8.3, 160],
    [9.2, 90],
    [10.5, 0],
  ];
  const presets = [
    { name: '3.4(a) · the peak-field trap', k: 0.02, ratio: 1.34, alpha: 1.43, beta: 0.69, j: 250 },
    { name: '3.4(b) · reach 6 T', k: 0.03, ratio: 1.25, alpha: 1.58, beta: 0.83, j: 200 },
    {
      name: '3.4(c) · reduce the peak field',
      k: 0.0225,
      ratio: 1.08,
      alpha: 1.31,
      beta: 1.4,
      j: 267,
    },
  ];
  function critical(b: number) {
    if (b >= 10.5) return 0;
    const i = points.findIndex((p) => p[0] >= b);
    if (i <= 0) return points[0]?.[1] ?? 700;
    const previous = points[i - 1],
      next = points[i];
    if (!previous || !next) return 0;
    const [x0, y0] = previous,
      [x1, y1] = next;
    return y0 + ((y1 - y0) * (b - x0)) / (x1 - x0);
  }
  function limit(k: number, background = 0) {
    let low = 0,
      high = 700;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (mid > critical(background + k * mid)) high = mid;
      else low = mid;
    }
    return (low + high) / 2;
  }
  function load(k: number, ratio: number, j: number) {
    const jc = limit(k * ratio),
      peak = k * ratio * j;
    return {
      limit: jc,
      central: k * j,
      peak,
      localCritical: critical(peak),
      margin: 100 * (1 - j / jc),
      maxCentral: k * jc,
    };
  }
  function graded(n: number) {
    const k = (4 * Math.PI * 1e-7 * 0.032 * 1e6) / n;
    let background = 0;
    return Array.from({ length: n }, (_, i) => {
      const j = limit(k, background),
        end = background + k * j,
        row = { section: i + 1, background, j, end };
      background = end;
      return row;
    });
  }
  function seriesGrading(current: number, outerDiameter: number, innerDiameter: number) {
    // Two 16 mm radial zones, infinite solenoid, fixed 75% metal packing.
    // Same effective NbTi winding curve/composition in both zones at 4.2 K.
    let fieldPerAmp = 0;
    const rows = [outerDiameter, innerDiameter].map((diameter, i) => {
      const area = (Math.PI * diameter ** 2) / 4,
        jPerAmp = 0.75 / area;
      const background = fieldPerAmp * current;
      fieldPerAmp += 4 * Math.PI * 1e-7 * 16000 * jPerAmp;
      const k = fieldPerAmp / jPerAmp,
        limitingCurrent = limit(k) / jPerAmp;
      return {
        name: i ? 'Inner' : 'Outer',
        diameter,
        area,
        j: current * jPerAmp,
        background,
        peak: fieldPerAmp * current,
        k,
        limitingCurrent,
        margin: 100 * (1 - current / limitingCurrent),
      };
    });
    const inner = rows[1];
    if (!inner) throw new Error('Two-zone grading requires an inner winding');
    return {
      rows,
      central: inner.peak,
      pass:
        outerDiameter < innerDiameter &&
        inner.peak >= 5 &&
        rows.every((r) => r.margin >= 20 - 1e-8),
    };
  }
  const volume = (p: { alpha: number; beta: number }) =>
    2 * Math.PI * 0.075 ** 3 * (p.alpha ** 2 - 1) * p.beta * 1000;
  const conductor = (j: number, area: number, packing: number, copperRatio: number) => ({
    current: (j * area) / packing,
    wireJ: j / packing,
    superJ: (j / packing) * (1 + copperRatio),
    superArea: area / (1 + copperRatio),
  });
  return { points, presets, critical, limit, load, graded, seriesGrading, volume, conductor };
})();
export default DesignModel;
