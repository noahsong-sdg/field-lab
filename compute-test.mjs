import assert from 'node:assert/strict';
import { PlaygroundModel as M } from './playground-model.ts';
import { computePlayground, handleComputeRequest } from './playground-compute.ts';

// Independent copy of the original renderer's field-map sampling contract.
function originalMap(config, o) {
  const zlim = Math.max(0.35, o.g.l * 0.65, (Math.abs(config.pz) / 1000) * 1.1);
  const xlim = Math.max(0.15, (o.g.a + o.g.t) * 1.3, (Math.abs(config.px) / 1000) * 1.1);
  const samples = [];
  for (let iz = -6; iz <= 6; iz++) {
    for (let ix = -3; ix <= 3; ix++) {
      const z = (iz * zlim) / 7,
        x = (ix * xlim) / 4;
      if (M.inside(config, o.g, x, z)) continue;
      const vector = M.field(o.mesh, x, z);
      if (!vector || vector.b < 1e-9) continue;
      samples.push({ x, z, vector });
    }
  }
  return { zlim, xlim, samples };
}
const cases = [
  {},
  { resolution: 128 },
  { offset: 20 },
  { imbalance: -20 },
  { px: 200, pz: -400 },
  { px: 90 },
  { a: 125, t: 80, l: 450 },
  { a: 25, t: 5, l: 60 },
  { mode: 'density', j: 200, material: 'nb3sn', temperature: 10 },
  { mode: 'volume', a: 100, l: 150 },
  { mode: 'conductor', a: 100, l: 150 },
];
for (const [id, changes] of cases.entries()) {
  const config = { ...M.defaults, ...changes };
  const before = structuredClone(config);
  const original = M.analyse(config);
  const { mesh: _mesh, ...analysis } = original;
  const expected = { analysis, map: originalMap(config, original) };
  const actual = computePlayground(config);
  assert.deepEqual(actual, expected, `exact numerical parity: case ${id}`);
  assert.deepEqual(config, before, 'does not mutate configuration');
  assert.ok(!('mesh' in actual.analysis), 'mesh is not sent to the UI');
  assert.ok(actual.map.samples.length <= 13 * 7);
  assert.deepEqual(structuredClone(actual), actual, 'results are worker-cloneable');
  assert.deepEqual(handleComputeRequest({ id, config }), { id, ok: true, result: expected });
}
assert.equal(computePlayground(M.defaults).map.zlim, 0.35);
assert.equal(computePlayground(M.defaults).map.xlim, 0.15);
const failure = handleComputeRequest({ id: 941, config: null });
assert.equal(failure.id, 941);
assert.equal(failure.ok, false);
assert.equal(typeof failure.error, 'string');
assert.ok(failure.error.length > 0, 'computation exceptions become tagged errors');
assert.deepEqual(structuredClone(failure), failure);
console.log(
  'Worker computation: exact analysis/map parity, cloneability and tagged errors passed.',
);
