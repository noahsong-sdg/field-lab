const FieldState = (() => {
  const specs = typeof experiments === 'undefined' ? require('./experiments.js') : experiments;
  const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const valid = (i, v) => Number.isFinite(v) && (specs[i].options ? specs[i].options.some(o => o[0] === v) : v >= specs[i].min && v <= specs[i].max);
  const empty = () => ({ version: 3, section: 0, step: 0, solved: [], xp: false, values: specs.map(s => s.start), kept: specs.map(() => null), predictions: specs.map(() => null), probe: .4 });
  const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  function restore(raw, legacy) {
    const out = empty(), data = parse(raw), old = parse(legacy);
    if (![2, 3].includes(data?.version)) {
      if (old?.version === 1) {
        out.solved = [...new Set((Array.isArray(old.solved) ? old.solved : []).filter(n => integer(n, 0, 19)).map(n => Math.floor(n / 4) * 5 + n % 4))];
        if (integer(old.section, 0, 4)) out.section = old.section;
        if (integer(old.step, 0, 3)) out.step = old.step;
      }
      return out;
    }
    out.solved = [...new Set((Array.isArray(data.solved) ? data.solved : []).filter(n => integer(n, 0, data.version === 3 ? 27 : 24)))];
    for (const k of ['section', 'step']) if (integer(data[k], 0, 4)) out[k] = data[k];
    if (data.version === 3 && out.section === 0 && integer(data.step, 5, 7)) out.step = data.step;
    for (let i = 0; i < 5; i++) {
      if (valid(i, data.values?.[i])) out.values[i] = data.values[i];
      if (valid(i, data.kept?.[i])) out.kept[i] = data.kept[i];
      if (integer(data.predictions?.[i], -1, 2)) out.predictions[i] = data.predictions[i];
    }
    if (typeof data.xp === 'boolean') out.xp = data.xp;
    if (Number.isFinite(data.probe) && data.probe >= 0 && data.probe <= .8) out.probe = data.probe;
    return out;
  }
  return { empty, restore, valid };
})();
if (typeof module !== 'undefined') module.exports = FieldState;
