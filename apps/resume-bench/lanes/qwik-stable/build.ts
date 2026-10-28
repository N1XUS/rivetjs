import { writeBuildManifest } from "../../provenance.ts";
// Qwik 1 stable lane: Vite client + SSR builds via qwikVite(), then SSR of `/` with the client manifest.
import { execFile } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stableModule, stablePackage, stableRequire } from '../../stable-dependencies.ts';

const { build: viteBuild } = await import(stableModule('vite'));
const { qwikVite } = stableRequire('@builder.io/qwik/optimizer');
const qwikRoot = stablePackage('@builder.io/qwik').root;

const run = promisify(execFile);
const originalLaneDir = dirname(fileURLToPath(import.meta.url));
// Real-page suite: RESUME_BENCH_SOURCE points at a generated page source; the toolchain config stays this lane's.
const laneDir = process.env.RESUME_BENCH_SOURCE ?? originalLaneDir;
const tmpRoot = resolve(originalLaneDir, '../../.build/qwik-stable');

function config(clientOutDir: string, serverOutDir: string, ssr: boolean) {
  return {
    root: laneDir,
    base: '/',
    configFile: false,
    mode: 'production',
    logLevel: 'warn',
    resolve: { alias: [
      { find: /^@builder\.io\/qwik$/, replacement: join(qwikRoot, 'dist/core.prod.mjs') },
      { find: /^@builder\.io\/qwik\/jsx-runtime$/, replacement: join(qwikRoot, 'dist/core.prod.mjs') },
      { find: /^@builder\.io\/qwik\/server$/, replacement: join(qwikRoot, 'dist/server.mjs') },
    ] },
    ssr: { noExternal: true },
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
          // Stable Qwik receives the client manifest at prerender time (render.ts).
        },
      }),
      {
        name: 'qwik-stable-preloader-resolution',
        // Let Qwik's resolver emit this entry with preserveSignature before resolving its file.
        resolveId(id: string) {
          if (id === '@builder.io/qwik/preloader') return join(qwikRoot, 'dist/preloader.mjs');
        },
      },
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

  await rm(outDir, { recursive: true, force: true });
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
  await writeBuildManifest("qwik-stable", outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  await build(process.argv[2] ?? join(tmpRoot, 'out'));
}
