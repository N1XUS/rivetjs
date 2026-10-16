// Build one Rivet lane: node apps/island-bench/build-lane.ts <rivet-bridge-react|rivet-native> → apps/island-bench/dist/<lane>.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const lane = process.argv[2]!;
const { build } = (await import(`./lanes/${lane}/build.ts`)) as { build(outDir: string): Promise<void> };
await build(resolve(fileURLToPath(new URL("./dist/", import.meta.url)), lane));
console.log("built " + lane);
