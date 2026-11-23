// Deployment aliases may lag their immutable deployment. Never accept a mixed build.
export async function awaitCoherentBuild<T extends { passed: boolean }>(
  probe: () => Promise<T>,
  pause = () => new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  attempts = 15,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await probe();
    if (result.passed) return result;
    if (attempt + 1 < attempts) await pause();
  }
  throw Error('Deployed HTML and JavaScript did not become a coherent build.');
}
