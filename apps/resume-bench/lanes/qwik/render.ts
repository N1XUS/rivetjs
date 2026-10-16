// Child-process SSR of `/`: imports the Qwik SSR bundle, renders with the client manifest, writes
// the document. Runs out-of-process because Qwik 2 RC's scheduler holds a module-level
// MessageChannel open, which would otherwise keep the caller's event loop alive forever.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [serverEntry, manifestPath, outFile] = process.argv.slice(2) as [string, string, string];
const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
const { default: render } = (await import(pathToFileURL(serverEntry).href)) as {
  default: (options: { manifest: unknown }) => Promise<{ html: string }>;
};
// Default qwikLoader ('module') and preloader settings; only the manifest is supplied.
const result = await render({ manifest });
await writeFile(outFile, result.html);
process.exit(0);
