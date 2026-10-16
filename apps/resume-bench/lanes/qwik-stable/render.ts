// Child-process SSR of `/`, matching the preview lane process isolation.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [serverEntry, manifestPath, outFile] = process.argv.slice(2) as [string, string, string];
const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
const { default: render } = (await import(pathToFileURL(serverEntry).href)) as {
  default: (options: { manifest: unknown }) => Promise<{ html: string }>;
};
// Default stable Qwik loader and prefetch settings; only the manifest is supplied.
const result = await render({ manifest });
await writeFile(outFile, result.html);
process.exit(0);
