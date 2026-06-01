/**
 * File purpose: Builds tinyship-demo TypeScript service entries into deployable dist files with esbuild.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(rootDir, '..');

await mkdir(resolve(projectDir, 'dist'), { recursive: true });

const builds = [
  { entry: 'user', source: 'src/frontend/user.ts', outfile: 'dist/frontend/user.js' },
  { entry: 'admin', source: 'src/frontend/admin.ts', outfile: 'dist/frontend/admin.js' },
  { entry: 'backend', source: 'src/backend/api.ts', outfile: 'dist/backend/api.js' },
];

for (const build of builds) {
  await esbuild.build({
    entryPoints: [resolve(projectDir, build.source)],
    outfile: resolve(projectDir, build.outfile),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    external: ['@xiaomingio/tinyship-env/register'],
  });
}
