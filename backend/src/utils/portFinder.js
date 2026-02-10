import detectPort from 'detect-port';

export async function findAvailablePort(preferred = 0) {
  return detectPort(preferred);
}
