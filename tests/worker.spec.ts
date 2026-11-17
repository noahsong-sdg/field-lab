import { test, expect, type Page } from '@playwright/test';
import type { ComputeReply } from '../playground-compute';

async function openPlayground(page: Page) {
  await page.goto('/');
  await page.locator('[data-stage="6"]').click();
  await expect(page.locator('#pg-keep')).toBeEnabled();
}

async function setCurrent(page: Page, value: string) {
  await page.locator('#pg-mode').selectOption('current');
  await page.locator('#pg-current-number').fill(value);
  await page.locator('#pg-current-number').press('Tab');
}

test('real module worker exactly matches synchronous computation and reports tagged errors', async ({
  page,
}) => {
  await page.goto('/');
  const comparisons = await page.evaluate(async () => {
    const computePath = '/playground-compute.ts';
    const modelPath = '/playground-model.ts';
    const { computePlayground } = (await import(
      computePath
    )) as typeof import('../playground-compute');
    const { PlaygroundModel } = (await import(modelPath)) as typeof import('../playground-model');
    const worker = new Worker('/playground.worker.ts', { type: 'module' });
    let id = 0;
    const request = (config: unknown) =>
      new Promise<ComputeReply>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<ComputeReply>) => resolve(event.data);
        worker.onerror = reject;
        worker.postMessage({ id: ++id, config });
      });
    try {
      const configurations = [
        { ...PlaygroundModel.defaults },
        { ...PlaygroundModel.defaults, resolution: 128, current: 610 },
        { ...PlaygroundModel.defaults, offset: 8, imbalance: 12, px: 149, pz: 400 },
        { ...PlaygroundModel.defaults, material: 'nb3sn' as const, temperature: 8, l: 300, a: 100 },
      ];
      const results = [];
      for (const config of configurations) {
        const expected = computePlayground(config);
        const actual = await request(config);
        results.push({
          id: actual.id,
          ok: actual.ok,
          equal: actual.ok && JSON.stringify(actual.result) === JSON.stringify(expected),
          hasMesh: actual.ok && 'mesh' in actual.result.analysis,
        });
      }
      const error = await request(null);
      return { results, error };
    } finally {
      worker.terminate();
    }
  });
  expect(comparisons.results).toEqual(
    [1, 2, 3, 4].map((id) => ({ id, ok: true, equal: true, hasMesh: false })),
  );
  expect(comparisons.error.id).toBe(5);
  expect(comparisons.error.ok).toBe(false);
});

for (const failure of ['missing', 'constructor', 'runtime'] as const) {
  test(`worker ${failure} failure falls back without losing controls or numerical results`, async ({
    page,
  }) => {
    await page.addInitScript((kind) => {
      if (kind === 'missing') {
        Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
      } else if (kind === 'constructor') {
        Object.defineProperty(window, 'Worker', {
          configurable: true,
          value: class {
            constructor() {
              throw new Error('Worker construction unavailable in this test');
            }
          },
        });
      } else {
        class FailingWorker extends EventTarget {
          onmessage: ((event: MessageEvent) => void) | null = null;
          onerror: ((event: ErrorEvent) => void) | null = null;
          onmessageerror: ((event: MessageEvent) => void) | null = null;
          postMessage() {
            queueMicrotask(() => {
              const error = new ErrorEvent('error', {
                message: 'Simulated worker execution failure',
                cancelable: true,
              });
              this.onerror?.(error);
              this.dispatchEvent(error);
            });
          }
          terminate() {}
        }
        Object.defineProperty(window, 'Worker', { configurable: true, value: FailingWorker });
      }
    }, failure);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openPlayground(page);
    await setCurrent(page, '620');
    await expect(page.locator('#pg-main-metrics')).toContainText('620.0 A');
    await expect(page.locator('#pg-keep')).toBeEnabled();
    await page.locator('#pg-keep').click();
    await expect(page.locator('#pg-restore')).toBeEnabled();
    await expect(page.locator('#pg-comparison')).toContainText('Kept');
    await setCurrent(page, '700');
    await expect(page.locator('#pg-main-metrics')).toContainText('700.0 A');
    await page.locator('#pg-restore').click();
    await expect(page.locator('#pg-main-metrics')).toContainText('620.0 A');
    expect(errors).toEqual([]);
  });
}

interface DelayedWorkerHarness {
  replies: (() => void)[];
  delivered: (() => void)[];
  requests: unknown[];
  release(): void;
  replayFirst(): void;
}

test('pending work coalesces, rejects stale results, and cannot corrupt keep or reset', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const harness: DelayedWorkerHarness = {
      replies: [],
      delivered: [],
      requests: [],
      release() {
        const reply = this.replies.shift();
        if (!reply) throw new Error('No delayed worker result available');
        this.delivered.push(reply);
        reply();
      },
      replayFirst() {
        this.delivered[0]?.();
      },
    };
    (window as unknown as { __workerTest: DelayedWorkerHarness }).__workerTest = harness;
    class DelayedWorker extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      native: Worker;
      constructor(url: string | URL, options?: WorkerOptions) {
        super();
        this.native = new NativeWorker(url, options);
        this.native.onmessage = (event) => {
          harness.replies.push(() => {
            const reply = new MessageEvent('message', { data: event.data });
            this.onmessage?.(reply);
            this.dispatchEvent(reply);
          });
        };
        this.native.onerror = (event) => {
          this.onerror?.(event);
          this.dispatchEvent(new ErrorEvent('error', { message: event.message }));
        };
      }
      postMessage(data: unknown) {
        harness.requests.push(data);
        this.native.postMessage(data);
      }
      terminate() {
        this.native.terminate();
      }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: DelayedWorker });
  });
  const queueLength = () =>
    page.evaluate(
      () =>
        (window as unknown as { __workerTest: DelayedWorkerHarness }).__workerTest.replies.length,
    );
  const requestCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __workerTest: DelayedWorkerHarness }).__workerTest.requests.length,
    );
  const release = () =>
    page.evaluate(() =>
      (window as unknown as { __workerTest: DelayedWorkerHarness }).__workerTest.release(),
    );
  await page.goto('/');
  await page.locator('[data-stage="6"]').click();
  await expect.poll(queueLength).toBe(1);
  await setCurrent(page, '450');
  await setCurrent(page, '700');
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'pending');
  await expect(page.locator('#pg-keep')).toBeDisabled();
  await expect(page.locator('#integrated-check')).toBeDisabled();
  expect(await requestCount()).toBe(1);
  const prematureGrade = await page.evaluate(() => {
    const detail = { stage: 6, pass: true, message: '' };
    document.dispatchEvent(new CustomEvent('check-design-stage', { detail }));
    return detail;
  });
  expect(prematureGrade.pass).toBe(false);
  expect(prematureGrade.message).toMatch(/comput/i);
  await release();
  await expect.poll(queueLength).toBe(1);
  expect(await requestCount()).toBe(2);
  await expect(page.locator('#pg-keep')).toBeDisabled();
  await release();
  await expect(page.locator('#pg-main-metrics')).toContainText('700.0 A');
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'ready');
  await page.evaluate(() =>
    (window as unknown as { __workerTest: DelayedWorkerHarness }).__workerTest.replayFirst(),
  );
  await expect(page.locator('#pg-main-metrics')).toContainText('700.0 A');
  await page.locator('#pg-keep').click();
  await expect(page.locator('#pg-restore')).toBeEnabled();
  await setCurrent(page, '800');
  await expect.poll(queueLength).toBe(1);
  await page.locator('#pg-reset').click();
  await expect(page.locator('#pg-restore')).toBeDisabled();
  await expect(page.locator('#pg-keep')).toBeDisabled();
  await release();
  await expect.poll(queueLength).toBe(1);
  await release();
  await expect(page.locator('#pg-main-metrics')).toContainText('500.0 A');
  await expect(page.locator('#pg-keep')).toBeEnabled();
  await expect(page.locator('#pg-restore')).toBeDisabled();
  await expect(page.locator('#pg-comparison')).not.toContainText('Kept:');
  await setCurrent(page, '900');
  await expect.poll(queueLength).toBe(1);
  await page.locator('#restart').evaluate((el) => {
    const menu = el.closest('details');
    if (menu) menu.open = true;
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#restart').click();
  await release(); // Already-delivered old-worker replies must remain harmless after termination.
  await expect(page.locator('#progress-label')).toHaveText('0/28 complete');
  await page.locator('[data-stage="6"]').click();
  await expect.poll(queueLength).toBe(1);
  await release();
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'ready');
  await expect(page.locator('#pg-mode')).toHaveValue('density');
  await expect(page.locator('#pg-l')).toHaveValue('105');
  await expect(page.locator('#pg-restore')).toBeDisabled();
});

test('a nonresponding worker times out to the latest synchronous result', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    class SilentWorker extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      postMessage() {}
      terminate() {}
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: SilentWorker });
  });
  await page.goto('/');
  await page.locator('[data-stage="6"]').click();
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'pending');
  await setCurrent(page, '640');
  await page.clock.fastForward(10_100);
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'fallback');
  await expect(page.locator('#pg-main-metrics')).toContainText('640.0 A');
  await expect(page.locator('#pg-keep')).toBeEnabled();
});

test('failed synchronous fallback clears busy state and keeps grading unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async () => {
    const modelPath = '/playground-model.ts';
    const { PlaygroundModel } = (await import(modelPath)) as typeof import('../playground-model');
    const original = PlaygroundModel.analyse;
    (window as unknown as { __restoreAnalyse: () => void }).__restoreAnalyse = () => {
      PlaygroundModel.analyse = original;
    };
    PlaygroundModel.analyse = () => {
      throw new Error('Simulated numerical failure');
    };
  });
  await page.locator('[data-stage="6"]').click();
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'error');
  await expect(page.locator('#playground')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#pg-keep')).toBeDisabled();
  await expect(page.locator('#integrated-check')).toBeDisabled();
  await expect(page.locator('#pg-compute')).toContainText('Unable to compute this design');
  const grade = await page.evaluate(() => {
    const detail = { stage: 6, pass: true, message: '' };
    document.dispatchEvent(new CustomEvent('check-design-stage', { detail }));
    return detail;
  });
  expect(grade.pass).toBe(false);
  await page.evaluate(() =>
    (window as unknown as { __restoreAnalyse: () => void }).__restoreAnalyse(),
  );
  await setCurrent(page, '650');
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'fallback');
  await expect(page.locator('#pg-main-metrics')).toContainText('650.0 A');
  await expect(page.locator('#pg-keep')).toBeEnabled();
  expect(errors).toEqual([]);
});
