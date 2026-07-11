/**
 * File purpose: Builds tinyship-demo TypeScript service entries into deployable dist files with esbuild.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(rootDir, '..');

const builds = [
  { entry: 'user', source: 'src/frontend/user.ts', outfile: 'apps/user/dist/user.js' },
  { entry: 'admin', source: 'src/frontend/admin.ts', outfile: 'apps/admin/dist/admin.js' },
  { entry: 'backend', source: 'src/backend/api.ts', outfile: 'apps/backend/dist/api.js' },
];

for (const build of builds) {
  await mkdir(dirname(resolve(projectDir, build.outfile)), { recursive: true });
  await esbuild.build({
    entryPoints: [resolve(projectDir, build.source)],
    outfile: resolve(projectDir, build.outfile),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
  });
}
