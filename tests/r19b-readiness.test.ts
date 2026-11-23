import { it, expect, vi } from 'vitest';
import { awaitCoherentBuild } from '../scripts/build-readiness';
it('waits for the new HTML and every script hash instead of accepting an old deployment', async () => {
  const probe = vi
    .fn()
    .mockResolvedValueOnce({ passed: false, reason: 'old HTML' })
    .mockResolvedValueOnce({ passed: false, reason: 'script mismatch' })
    .mockResolvedValueOnce({ passed: true, reason: 'all matching' });
  const pause = vi.fn(async () => {});
  expect((await awaitCoherentBuild(probe, pause, 3)).passed).toBe(true);
  expect(probe).toHaveBeenCalledTimes(3);
  expect(pause).toHaveBeenCalledTimes(2);
});
it('fails closed after bounded attempts when deployment coherence never arrives', async () => {
  const probe = vi.fn(async () => ({ passed: false }));
  const pause = vi.fn(async () => {});
  await expect(awaitCoherentBuild(probe, pause, 3)).rejects.toThrow(
    'did not become a coherent build',
  );
  expect(probe).toHaveBeenCalledTimes(3);
  expect(pause).toHaveBeenCalledTimes(2);
});
