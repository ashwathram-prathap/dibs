// Only invoked for a submitted answer rejected by the server, never while typing.
export async function submittedSpelling(
  catalog: { slug: string; version: string; rowChunkSize?: number },
  answer: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./spelling.worker.ts', import.meta.url), { type: 'module' });
    const finish = (value: string | null) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(value);
    };
    const timeout = setTimeout(() => finish(null), 10000);
    worker.onmessage = (e) => finish(typeof e.data === 'string' ? e.data : null);
    worker.onerror = () => finish(null);
    worker.postMessage({ catalog, answer });
  });
}
