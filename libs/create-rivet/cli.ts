#!/usr/bin/env node
// `create-rivet` bin (`npm create rivet@latest`): see ./main.ts.
import { main } from "./main.ts";

process.exitCode = await main(process.argv.slice(2), {
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
  cwd: process.cwd(),
  env: process.env,
});
