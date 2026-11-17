// Diagnostic benchmark, not a CI timing gate. Start the dev server first.
import { firefox } from '@playwright/test';
import os from 'node:os';
const browser = await firefox.launch({
  headless: true,
  ...(process.env.FIREFOX_EXECUTABLE_PATH
    ? { executablePath: process.env.FIREFOX_EXECUTABLE_PATH }
    : {}),
});
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.profileFrames = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((timestamp) => {
        const start = performance.now();
        try {
          callback(timestamp);
        } finally {
          window.profileFrames.push(performance.now() - start);
        }
      });
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
  await page.locator('[data-stage="6"]').click();
  await page.locator('#pg-reset').click();
  await page.waitForTimeout(1000);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model || 'not exposed',
      userAgent: await page.evaluate(() => navigator.userAgent),
    }),
  );
  for (const resolution of ['32', '128']) {
    await page.locator('#pg-resolution').selectOption(resolution);
    await page.waitForTimeout(300);
    const rows = await page.evaluate(async () => {
      const rows = [];
      for (let i = 0; i < 35; i++) {
        window.profileFrames = [];
        const element = document.querySelector('#pg-a');
        const output = document.querySelector('#pg-compute');
        const start = performance.now();
        const rendered = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Result timeout'));
          }, 10000);
          const observer = new MutationObserver(() => {
            if (output.textContent.includes('segments in the field model')) {
              clearTimeout(timer);
              observer.disconnect();
              resolve(performance.now() - start);
            }
          });
          observer.observe(output, { childList: true, characterData: true, subtree: true });
        });
        element.value = String(50 + (i % 4) * 5);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        const latency = await rendered;
        // Keep at least the baseline's 140ms interval without overlapping requests.
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, 140 - latency)));
        if (i >= 5)
          rows.push({ raf: Math.max(...window.profileFrames), latency, text: output.textContent });
      }
      return rows;
    });
    const stats = (key) => {
      const values = rows.map((row) => row[key]).sort((a, b) => a - b);
      return {
        median: (values[14] + values[15]) / 2,
        p95: values[Math.ceil(0.95 * values.length) - 1],
        min: values[0],
        max: values[29],
      };
    };
    console.log(
      JSON.stringify({
        resolution,
        samples: rows.length,
        rafMs: stats('raf'),
        resultLatencyMs: stats('latency'),
        rows,
      }),
    );
  }
} finally {
  await browser.close();
}
