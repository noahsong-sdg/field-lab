/* Iron-free teaching models. SI units unless explicitly normalized. */
export const FieldModel = (() => {
  const mu0 = 4 * Math.PI * 1e-7;
  const shape = (alpha: number, beta: number) =>
    mu0 * beta * Math.log((alpha + Math.hypot(alpha, beta)) / (1 + Math.hypot(1, beta)));
  const solenoid = (beta: number, z = 0) =>
    0.5 * 1e8 * 0.075 * (shape(1.5, beta - z / 0.075) + shape(1.5, beta + z / 0.075));
  const transverse = (n: number, x: number, y: number) => {
    // Book's complex convention: B = By + i Bx; normalize mu0*g_n/2 to 1.
    let re = 1,
      im = 0;
    for (let k = 0; k < n - 1; k++) [re, im] = [re * x - im * y, re * y + im * x];
    return { x: -im, y: -re };
  };
  const toroid = (r: number) => (mu0 * 1e6) / (2 * Math.PI * r);
  const loopAxis = (z: number) => 1 / Math.pow(1 + z * z, 1.5);
  const mirror = (separation: number, z: number) =>
    (loopAxis(z - separation / 2) + loopAxis(z + separation / 2)) / 2;
  const loopExact = (z: number) => (mu0 * 1000) / (2 * Math.pow(1 + z * z, 1.5));
  const polygonLoop = (n: number, z = 0.5) => {
    // Integrate each straight segment exactly using eq. 3.39; observation is (0,0,z).
    let bz = 0;
    for (let k = 0; k < n; k++) {
      const t1 = (2 * Math.PI * k) / n,
        t2 = (2 * Math.PI * (k + 1)) / n;
      const p: [number, number, number] = [Math.cos(t1), Math.sin(t1), -z],
        q: [number, number, number] = [Math.cos(t2), Math.sin(t2), -z];
      const a = Math.hypot(...p),
        b = Math.hypot(...q),
        dot = p.reduce((sum, v, i) => sum + v * (q[i] ?? 0), 0);
      bz += ((p[0] * q[1] - p[1] * q[0]) * (a + b)) / (a * b * (a * b + dot));
    }
    return (mu0 * 1000 * bz) / (4 * Math.PI);
  };
  const error = (n: number) => 100 * Math.abs(polygonLoop(n) / loopExact(0.5) - 1);
  return { mu0, shape, solenoid, transverse, toroid, mirror, loopExact, polygonLoop, error };
})();
export default FieldModel;
