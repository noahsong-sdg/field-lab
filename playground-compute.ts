import { PlaygroundModel, type FieldVector, type PlaygroundConfig } from './playground-model';

export type PlaygroundAnalysis = Omit<ReturnType<typeof PlaygroundModel.analyse>, 'mesh'>;
export interface FieldMap {
  zlim: number;
  xlim: number;
  samples: { x: number; z: number; vector: FieldVector }[];
}
export interface PlaygroundComputation {
  analysis: PlaygroundAnalysis;
  map: FieldMap;
}
export interface ComputeRequest {
  id: number;
  config: PlaygroundConfig;
}
export type ComputeReply =
  | { id: number; ok: true; result: PlaygroundComputation }
  | { id: number; ok: false; error: string };

/** Pure physics work shared by the worker and parity tests. No DOM or drawing sizes. */
export function computePlayground(config: PlaygroundConfig): PlaygroundComputation {
  const { mesh, ...analysis } = PlaygroundModel.analyse(config);
  const { g } = analysis;
  const zlim = Math.max(0.35, g.l * 0.65, (Math.abs(config.pz) / 1000) * 1.1);
  const xlim = Math.max(0.15, (g.a + g.t) * 1.3, (Math.abs(config.px) / 1000) * 1.1);
  const samples: FieldMap['samples'] = [];
  // Keep the original renderer's grid, iteration order and filtering exactly.
  for (let iz = -6; iz <= 6; iz++)
    for (let ix = -3; ix <= 3; ix++) {
      const z = (iz * zlim) / 7;
      const x = (ix * xlim) / 4;
      if (PlaygroundModel.inside(config, g, x, z)) continue;
      const vector = PlaygroundModel.field(mesh, x, z);
      if (!vector || vector.b < 1e-9) continue;
      samples.push({ x, z, vector });
    }
  // The segment mesh can be large. It is used only here, never cloned to the UI.
  return { analysis, map: { zlim, xlim, samples } };
}

/** Every response carries the input ID so the UI can discard stale work. */
export function handleComputeRequest(request: ComputeRequest): ComputeReply {
  try {
    return { id: request.id, ok: true, result: computePlayground(request.config) };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
