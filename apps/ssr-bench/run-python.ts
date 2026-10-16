import { spawnSync } from "node:child_process";

// npm prepends Node's bin directory; a broken /usr/local/bin/python3 can then
// shadow Homebrew's working interpreter on macOS. Probe version and execution.
const configured = process.env.RIVET_BENCH_PYTHON;
const candidates = configured
  ? [configured]
  : ["python3", ...(process.platform === "darwin" ? ["/opt/homebrew/bin/python3"] : [])];
const interpreter = candidates.find(
  (candidate) =>
    spawnSync(candidate, ["-c", "import sys;sys.exit(0 if sys.version_info >= (3,12) else 1)"], { stdio: "ignore" })
      .status === 0,
);
if (!interpreter) {
  console.error("A working Python 3.12+ is required. Set RIVET_BENCH_PYTHON to its executable.");
  process.exit(1);
}
const result = spawnSync(interpreter, process.argv.slice(2), { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
