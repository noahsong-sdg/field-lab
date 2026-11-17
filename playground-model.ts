export interface PlaygroundConfig {
  a: number;
  t: number;
  l: number;
  n: number;
  d: number;
  ins: number;
  current: number;
  j: number;
  mode: 'current' | 'density' | 'volume' | 'conductor';
  volume: number;
  metalVolume: number;
  target: number;
  region: number;
  tolerance: number;
  offset: number;
  imbalance: number;
  resolution: number;
  px: number;
  pz: number;
  material: 'nbti' | 'nb3sn';
  temperature: number;
  reference: number;
  fraction: number;
  split: number;
  allocation: number;
}
export type Vector3 = [number, number, number];
export type Segment = [number, number, number, number, number, number, number];
export interface Geometry {
  a: number;
  t: number;
  l: number;
  area: number;
  current: number;
  turns: number;
  volume: number;
  fill: number;
  wireLength: number;
}
export interface FieldVector {
  x: number;
  y: number;
  z: number;
  b: number;
}
export interface Winding {
  g: Geometry;
  segments: Segment[];
}
/* SI geometry and current. Public controls use mm, A and A/mm². */
export const PlaygroundModel = (() => {
  const mu0 = 4 * Math.PI * 1e-7;
  const defaults: PlaygroundConfig = {
    a: 75,
    t: 35,
    l: 300,
    n: 2400,
    d: 1,
    ins: 0.05,
    current: 500,
    j: 100,
    mode: 'current',
    volume: Math.PI * (0.11 ** 2 - 0.075 ** 2) * 0.3,
    metalVolume: (2 * Math.PI * 0.0925 * 2400 * Math.PI * 0.001 ** 2) / 4,
    target: 6,
    region: 30,
    tolerance: 1,
    offset: 0,
    imbalance: 0,
    resolution: 32,
    px: 0,
    pz: 0,
    material: 'nbti',
    temperature: 4.2,
    reference: 3000,
    fraction: 0.4,
    split: 50,
    allocation: 50,
  };
  function geometry(s: PlaygroundConfig) {
    const a = s.a / 1000,
      l = s.l / 1000,
      t = s.mode === 'volume' ? Math.sqrt(a * a + s.volume / (Math.PI * l)) - a : s.t / 1000;
    const area = (Math.PI * s.d * s.d) / 4,
      turnArea = (Math.PI * (s.d + 2 * s.ins) ** 2) / 4;
    const turns =
      s.mode === 'conductor' ? s.metalVolume / (2 * Math.PI * (a + t / 2) * area * 1e-6) : s.n;
    const current = s.mode === 'density' ? (s.j * t * l * 1e6) / turns : s.current;
    return {
      a,
      t,
      l,
      area,
      current,
      turns,
      volume: Math.PI * ((a + t) ** 2 - a * a) * l,
      fill: (turns * turnArea) / (t * l * 1e6),
      wireLength: 2 * Math.PI * (a + t / 2) * turns,
    };
  }
  function winding(s: PlaygroundConfig, angular = s.resolution) {
    const g = geometry(s),
      segments: Segment[] = [];
    // Fixed 4 radial × 8 axial samples represent a distributed winding pack.
    for (let ir = 0; ir < 4; ir++)
      for (let iz = 0; iz < 8; iz++) {
        const radius = g.a + (g.t * (ir + 0.5)) / 4,
          z = g.l * ((iz + 0.5) / 8 - 0.5),
          side = z < 0 ? -1 : 1,
          shift = (side * s.offset) / 2000;
        const amp = ((g.current * g.turns) / 32) * (1 + (side * s.imbalance) / 100);
        for (let k = 0; k < angular; k++) {
          const p = (k * 2 * Math.PI) / angular,
            q = ((k + 1) * 2 * Math.PI) / angular;
          segments.push([
            shift + radius * Math.cos(p),
            radius * Math.sin(p),
            z,
            shift + radius * Math.cos(q),
            radius * Math.sin(q),
            z,
            amp,
          ]);
        }
      }
    return { g, segments };
  }
  function field(mesh: Winding, x: number, z: number): FieldVector | null {
    let bx = 0,
      by = 0,
      bz = 0;
    for (const [ax, ay, az, bx0, by0, bz0, amp] of mesh.segments) {
      const p: Vector3 = [ax - x, ay, az - z],
        q: Vector3 = [bx0 - x, by0, bz0 - z],
        u = Math.hypot(...p),
        v = Math.hypot(...q),
        dot = p[0] * q[0] + p[1] * q[1] + p[2] * q[2],
        den = u * v * (u * v + dot);
      if (den < 1e-24) return null;
      const f = ((mu0 / (4 * Math.PI)) * amp * (u + v)) / den;
      bx += (p[1] * q[2] - p[2] * q[1]) * f;
      by += (p[2] * q[0] - p[0] * q[2]) * f;
      bz += (p[0] * q[1] - p[1] * q[0]) * f;
    }
    return { x: bx, y: by, z: bz, b: Math.hypot(bx, by, bz) };
  }
  function inside(s: PlaygroundConfig, g: Geometry, x: number, z: number) {
    const side = z < 0 ? -1 : 1,
      r = Math.abs(x - (side * s.offset) / 2000);
    return Math.abs(z) <= g.l / 2 && r >= g.a && r <= g.a + g.t;
  }
  function critical(s: PlaygroundConfig, b: number, temp = s.temperature) {
    // Fits diverge near zero field: no numerical extrapolation below 1 T.
    if (b < 1) return null;
    const raw = (B: number, T: number) => {
      const tc = s.material === 'nbti' ? 9.2 : 16.8,
        t = T / tc;
      if (t >= 1) return 0;
      const h2 =
          (s.material === 'nbti' ? 14.5 : 30.7) * (1 - t ** (s.material === 'nbti' ? 1.7 : 1.52)),
        h = B / h2;
      if (h >= 1) return 0;
      return s.material === 'nbti'
        ? (h ** 0.57 * (1 - h) ** 0.9 * (1 - t ** 1.7) ** 2.32) / B
        : ((1 - t ** 1.52) * (1 - t * t) * Math.sqrt(h) * (1 - h) ** 2) / B;
    };
    return (s.reference * raw(b, temp)) / raw(s.material === 'nbti' ? 5 : 12, 4.2);
  }
  function requiredField(mesh: Winding, x: number, z: number): FieldVector {
    const result = field(mesh, x, z);
    if (!result) throw new RangeError('Field evaluation lies on a singular filament');
    return result;
  }
  function analyse(s: PlaygroundConfig) {
    const mesh = winding(s),
      g = mesh.g,
      centre = requiredField(mesh, 0, 0);
    const points = Array.from({ length: 41 }, (_, i) => {
      const z = g.l * (i / 40 - 0.5);
      return { position: z, ...requiredField(mesh, 0, z) };
    });
    const region = Array.from({ length: 11 }, (_, i) =>
      requiredField(mesh, 0, ((i / 10 - 0.5) * s.region) / 1000),
    );
    const variation =
      centre.b > 1e-12
        ? (100 * Math.max(...region.map((b) => Math.abs(b.b - centre.b)))) / centre.b
        : 0;
    // Sample the accessible bore-side boundary, not inside filaments. This is not a certified peak.
    let peak = 0;
    for (const sign of [-1, 1])
      for (let i = 0; i <= 12; i++) {
        const z = g.l * (i / 12 - 0.5),
          shift = ((z < 0 ? -1 : 1) * s.offset) / 2000;
        peak = Math.max(peak, requiredField(mesh, shift + sign * (g.a - 0.0005), z).b);
      }
    const x = s.px / 1000,
      z = s.pz / 1000,
      probe = inside(s, g, x, z) ? null : field(mesh, x, z);
    const refined = probe ? field(winding(s, s.resolution * 2), x, z) : null;
    const error =
      probe && refined && refined.b > 1e-12
        ? (100 * Math.abs(probe.b - refined.b)) / refined.b
        : null;
    const currentFactor = 1 + Math.abs(s.imbalance) / 100,
      activeJ = (g.current * currentFactor) / (g.area * s.fraction),
      jc = critical(s, peak);
    // Solve along the estimated peak-field load line, excluding the unsupported B<1T region.
    let limit: number | null = null;
    const tc = s.material === 'nbti' ? 9.2 : 16.8;
    if (s.temperature >= tc) limit = 0;
    else if (peak >= 1) {
      let lo = g.current / peak,
        hi = (g.current / peak) * (s.material === 'nbti' ? 14.5 : 30.7);
      // If the root lies below the supported 1 T fit domain, do not invent it.
      if ((lo * currentFactor) / (g.area * s.fraction) <= (critical(s, 1) ?? 0)) {
        for (let i = 0; i < 60; i++) {
          const mid = (lo + hi) / 2,
            jlim = critical(s, (peak * mid) / g.current);
          if ((mid * currentFactor) / (g.area * s.fraction) <= (jlim ?? 0)) lo = mid;
          else hi = mid;
        }
        limit = (lo + hi) / 2;
      }
    }
    const margin = limit !== null && limit > 0 ? 100 * (1 - g.current / limit) : null;
    // Long-solenoid scaling estimates use the mean winding radius; no finite-length correction.
    const inductance = (mu0 * g.turns * g.turns * Math.PI * (g.a + g.t / 2) ** 2) / g.l;
    const energy = 0.5 * inductance * g.current * g.current,
      pressure = centre.b ** 2 / (2 * mu0),
      force = pressure * Math.PI * g.a * g.a;
    const copperArea = g.area * (1 - s.fraction),
      resistance = (1.68e-8 * g.wireLength) / (copperArea * 1e-6);
    const fit = g.fill <= Math.PI / (2 * Math.sqrt(3));
    return {
      mesh,
      g,
      centre,
      points,
      variation,
      peak,
      probe,
      error,
      jc,
      activeJ,
      limit,
      margin,
      inductance,
      energy,
      pressure,
      force,
      resistance,
      fit,
      pass:
        fit &&
        centre.b >= s.target &&
        variation <= s.tolerance &&
        margin !== null &&
        margin >= 20 &&
        s.region <= s.l &&
        s.offset === 0 &&
        s.imbalance === 0,
    };
  }
  function grading(s: PlaygroundConfig) {
    // Separate infinite-solenoid 2-zone experiment: fixed overall J, not the finite-coil model.
    const g = geometry(s),
      fractions = [s.split / 100, 1 - s.split / 100],
      shares = [s.allocation / 100, 1 - s.allocation / 100];
    let b = 0;
    return fractions.map((f, i) => {
      const j = (100 * (shares[i] ?? 0)) / f,
        start = b;
      b += mu0 * j * 1e6 * g.t * f;
      return { thickness: g.t * f * 1000, j, start, end: b };
    });
  }
  return { mu0, defaults, geometry, winding, field, inside, critical, analyse, grading };
})();
export default PlaygroundModel;
