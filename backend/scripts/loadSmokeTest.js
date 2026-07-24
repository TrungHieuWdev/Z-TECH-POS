const target = process.env.LOAD_TEST_URL || 'http://localhost:5000/api/health/live';
const total = Math.max(1, Number(process.env.LOAD_TEST_REQUESTS || 500));
const concurrency = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 25));
const durations = [];
let completed = 0;
let failed = 0;
let issued = 0;

async function worker() {
  while (issued < total) {
    issued += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(5000) });
      if (!response.ok && response.status !== 429) failed += 1;
      else completed += 1;
      await response.arrayBuffer();
    } catch {
      failed += 1;
    } finally {
      durations.push(performance.now() - startedAt);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] || 0;
console.log({
  target,
  total,
  completed,
  failed,
  p50Ms: Number(percentile(0.5).toFixed(1)),
  p95Ms: Number(percentile(0.95).toFixed(1)),
  p99Ms: Number(percentile(0.99).toFixed(1))
});
if (failed > Math.max(2, total * 0.01)) process.exitCode = 1;
