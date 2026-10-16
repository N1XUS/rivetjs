"""Serve only generated SSR reports on loopback."""
import argparse
import functools
import http.server
from pathlib import Path

def main():
    """Expose an existing result directory for local browser inspection."""
    parser=argparse.ArgumentParser();parser.add_argument('--dir',default='.artifacts/ssr-bench');parser.add_argument('--port',type=int,default=18120)
    args=parser.parse_args();root=Path(args.dir).resolve()
    if not (root/'report.html').is_file():parser.error('Run the benchmark first: report.html does not exist')
    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root))
    print(f'http://127.0.0.1:{args.port}/report.html',flush=True)
    with http.server.ThreadingHTTPServer(('127.0.0.1',args.port),handler) as server:server.serve_forever()

if __name__=='__main__':main()
