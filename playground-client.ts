import {
  computePlayground,
  type ComputeReply,
  type ComputeRequest,
  type PlaygroundComputation,
} from './playground-compute';
import type { PlaygroundConfig } from './playground-model';

type Snapshot = { key: string; config: PlaygroundConfig };
interface Callbacks {
  pending(): void;
  ready(result: PlaygroundComputation, key: string, fallback: boolean): void;
  failed(error: unknown): void;
}

/** One active job, one replaceable latest snapshot, and one completed cache entry. */
export class PlaygroundComputeClient {
  private worker: Worker | null = null;
  private started = false;
  private fallback = false;
  private disposed = false;
  private sequence = 0;
  private active: (Snapshot & { id: number }) | null = null;
  private latest: Snapshot | null = null;
  private cache: { key: string; result: PlaygroundComputation } | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly callbacks: Callbacks,
    private readonly createWorker = () =>
      new Worker(new URL('./playground.worker.ts', import.meta.url), { type: 'module' }),
  ) {}

  request(config: PlaygroundConfig): void {
    if (this.disposed) return;
    this.latest = { key: JSON.stringify(config), config: { ...config } };
    if (this.cache?.key === this.latest.key) {
      this.callbacks.ready(this.cache.result, this.cache.key, this.fallback);
      return;
    }
    this.callbacks.pending();
    if (!this.active) this.startLatest();
  }

  invalidate(): void {
    this.latest = null;
    this.cache = null;
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = null;
    this.active = null;
    this.started = false;
  }

  dispose(): void {
    this.disposed = true;
    this.invalidate();
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = null;
    this.active = null;
  }

  private startLatest(): void {
    if (!this.latest || this.disposed) return;
    if (!this.started && !this.fallback) {
      this.started = true;
      try {
        this.worker = this.createWorker();
        this.worker.onmessage = (event: MessageEvent<ComputeReply>) => this.receive(event.data);
        this.worker.onerror = (event) => {
          event.preventDefault();
          this.useFallback();
        };
        this.worker.onmessageerror = () => this.useFallback();
      } catch {
        this.fallback = true;
      }
    }
    if (this.fallback || !this.worker) {
      const snapshot = this.latest;
      try {
        this.complete(snapshot, computePlayground(snapshot.config));
      } catch (error) {
        this.callbacks.failed(error);
      }
      return;
    }
    this.active = { ...this.latest, id: ++this.sequence };
    const request: ComputeRequest = { id: this.active.id, config: this.active.config };
    // A worker that never starts/responds must not leave the UI permanently pending.
    this.timeout = setTimeout(() => this.useFallback(), 10_000);
    try {
      this.worker.postMessage(request);
    } catch {
      this.useFallback();
    }
  }

  private receive(reply: ComputeReply): void {
    if (!this.active || reply.id !== this.active.id || this.disposed) return;
    clearTimeout(this.timeout);
    const completed = this.active;
    this.active = null;
    if (!reply.ok) {
      this.useFallback();
      return;
    }
    if (completed.key === this.latest?.key) this.complete(completed, reply.result);
    else if (this.latest && this.cache?.key !== this.latest.key) this.startLatest();
  }

  private complete(snapshot: Snapshot, result: PlaygroundComputation): void {
    if (snapshot.key !== this.latest?.key || this.disposed) return;
    this.cache = { key: snapshot.key, result };
    this.callbacks.ready(result, snapshot.key, this.fallback);
  }

  private useFallback(): void {
    if (this.disposed) return;
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = null;
    this.active = null;
    this.fallback = true;
    this.startLatest();
  }
}
