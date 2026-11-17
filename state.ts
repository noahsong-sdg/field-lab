import { experiments } from './experiments';

export interface FieldProgress {
  version: number;
  section: number;
  step: number;
  solved: number[];
  xp: boolean;
  values: number[];
  kept: (number | null)[];
  predictions: (number | null)[];
  probe: number;
}

type StoredRecord = Record<string, unknown>;
const record = (value: unknown): StoredRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as StoredRecord)
    : null;
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const integer = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

export const FieldState = (() => {
  const valid = (i: number, v: unknown): v is number => {
    const spec = experiments[i];
    if (!spec || typeof v !== 'number' || !Number.isFinite(v)) return false;
    return spec.options
      ? spec.options.some((option) => option[0] === v)
      : typeof spec.min === 'number' &&
          typeof spec.max === 'number' &&
          v >= spec.min &&
          v <= spec.max;
  };
  const empty = (): FieldProgress => ({
    version: 3,
    section: 0,
    step: 0,
    solved: [],
    xp: false,
    values: experiments.map((s) => s.start),
    kept: experiments.map(() => null),
    predictions: experiments.map(() => null),
    probe: 0.4,
  });
  const parse = (raw?: string | null): StoredRecord | null => {
    if (typeof raw !== 'string') return null;
    try {
      return record(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  };
  function restore(raw?: string | null, legacy?: string | null): FieldProgress {
    const out = empty(),
      data = parse(raw),
      old = parse(legacy);
    if (!data || (data.version !== 2 && data.version !== 3)) {
      if (old?.version === 1) {
        out.solved = [
          ...new Set(
            array(old.solved)
              .filter((n) => integer(n, 0, 19))
              .map((n) => Math.floor(n / 4) * 5 + (n % 4)),
          ),
        ];
        if (integer(old.section, 0, 4)) out.section = old.section;
        if (integer(old.step, 0, 3)) out.step = old.step;
      }
      return out;
    }
    out.solved = [
      ...new Set(array(data.solved).filter((n) => integer(n, 0, data.version === 3 ? 27 : 24))),
    ];
    for (const k of ['section', 'step'] as const) if (integer(data[k], 0, 4)) out[k] = data[k];
    if (data.version === 3 && out.section === 0 && integer(data.step, 5, 7)) out.step = data.step;
    const values = array(data.values),
      kept = array(data.kept),
      predictions = array(data.predictions);
    for (let i = 0; i < 5; i++) {
      const value = values[i],
        keep = kept[i],
        prediction = predictions[i];
      if (valid(i, value)) out.values[i] = value;
      if (valid(i, keep)) out.kept[i] = keep;
      if (integer(prediction, -1, 2)) out.predictions[i] = prediction;
    }
    if (typeof data.xp === 'boolean') out.xp = data.xp;
    if (
      typeof data.probe === 'number' &&
      Number.isFinite(data.probe) &&
      data.probe >= 0 &&
      data.probe <= 0.8
    )
      out.probe = data.probe;
    return out;
  }
  return { empty, restore, valid };
})();
export default FieldState;
