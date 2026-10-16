import { writeBuildManifest } from "../../provenance.ts";
// Qwik 2 lane: Vite client + SSR builds via qwikVite(), then SSR of `/` with the client manifest.
import { execFile } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build as viteBuild, type InlineConfig } from 'vite';
import { qwikVite } from '@qwik.dev/core/optimizer';

const run = promisify(execFile);
const laneDir = dirname(fileURLToPath(import.meta.url));
const tmpRoot = resolve(laneDir, '../../.build/qwik');

function config(clientOutDir: string, serverOutDir: string, ssr: boolean): InlineConfig {
  return {
    root: laneDir,
    base: '/',
    configFile: false,
    mode: 'production',
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir: ssr ? serverOutDir : clientOutDir,
      emptyOutDir: true,
      minify: !ssr,
      sourcemap: false,
      ssr: ssr ? join(laneDir, 'src/entry.ssr.tsx') : undefined,
    },
    plugins: [
      qwikVite({
        srcDir: join(laneDir, 'src'),
        lint: false,
        client: { input: join(laneDir, 'src/root.tsx'), outDir: clientOutDir },
        ssr: {
          input: join(laneDir, 'src/entry.ssr.tsx'),
          outDir: serverOutDir,
          manifestInputPath: ssr ? join(clientOutDir, 'q-manifest.json') : undefined,
        },
      }),
    ],
  };
}

export async function build(outDir: string): Promise<void> {
  outDir = resolve(outDir);
  const clientOutDir = join(tmpRoot, 'client');
  const serverOutDir = join(tmpRoot, 'server');
  await rm(tmpRoot, { recursive: true, force: true });

  await viteBuild(config(clientOutDir, serverOutDir, false));
  await viteBuild(config(clientOutDir, serverOutDir, true));

  await mkdir(outDir, { recursive: true });
  await cp(clientOutDir, outDir, {
    recursive: true,
    filter: (src) => !src.endsWith('q-manifest.json'),
  });
  await run(process.execPath, [
    join(laneDir, 'render.ts'),
    join(serverOutDir, 'entry.ssr.js'),
    join(clientOutDir, 'q-manifest.json'),
    join(outDir, 'index.html'),
  ]);
  await writeBuildManifest("qwik", outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  await build(process.argv[2] ?? join(tmpRoot, 'out'));
}
