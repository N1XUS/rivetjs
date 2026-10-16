"""THROWAWAY SPIKE driver: apps/ssr-bench/benchmark.py unchanged, plus the rust-ceiling lanes from compose.rust.yaml.

Run from the repo root (Python 3.12+), in an isolated Compose project so the main bench stack is untouched:
  SSR_BENCH_PROJECT=rivet-ssr-rspike SSR_BENCH_PORT_PREFIX=182 python3 apps/ssr-bench/spikes/rust-ceiling/bench.py \
    --frameworks=rivet-compiled,dotnet,rust-ceiling,rust-ceiling-mt,rust-ceiling-json --rows=100,1000 \
    --concurrency=1,10,100 --duration=10 --warmup=3 --repeats=3 --skip-build --stop --out .artifacts/ssr-bench-rspike
(--skip-build: build the Node/.NET images with the main bench first; this script builds the Rust image itself.)
"""
import subprocess
import sys
from pathlib import Path

SPIKE = Path(__file__).resolve().parent
sys.path.insert(0, str(SPIKE.parents[1]))
import benchmark as b  # noqa: E402

b.COMPOSE += ['-f', str(SPIKE / 'compose.rust.yaml')]
b.PORTS.update({name: int(b.PORT_PREFIX + suffix) for name, suffix in {'rust-ceiling': '20', 'rust-ceiling-mt': '21', 'rust-ceiling-json': '22'}.items()})
if __name__ == '__main__':
    lanes = [lane for lane in ('rust-ceiling', 'rust-ceiling-mt', 'rust-ceiling-json') if any(lane in arg for arg in sys.argv)]
    if lanes:
        subprocess.run(b.COMPOSE + ['--profile', 'variants', 'build', lanes[0]], check=True)
    b.main()
