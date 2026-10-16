"""Verified closed-loop or fixed-arrival HTTP load, run in an isolated container."""
import argparse
import concurrent.futures
import http.client
import json
import math
import re
from functools import lru_cache
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

FIELDS=re.compile(rb'<dd\b[^>]*>(?:<!--.*?-->)*([^<]*)(?:<!--.*?-->)*</dd>',re.S)
ROWS=re.compile(rb'<article\b[^>]*\bdata-row="([^"]*)"')

@lru_cache(maxsize=16)
def expected_content(rows):
    """Cache deterministic fixture row identities and field bytes outside measured requests."""
    return ([str(row).encode() for row in range(rows)],
            [str(row*100+field).encode() for row in range(rows) for field in range(10)])

def validate_response(status, body, rows, token, article=False):
    """Accept complete pages only when every row/value and requested article content matches."""
    if not (status==200 and b'</html>' in body and b'<!--complete-->' in body
            and ('data-token="'+token+'"').encode() in body):return False
    identities,fields=expected_content(rows)
    if ROWS.findall(body)!=identities or FIELDS.findall(body)!=fields:return False
    if article:
        return (b'<h1>Benchmark article</h1>' in body and b'<strong>gRPC</strong>' in body
                and body.count(b'<h2>Section</h2>')==32
                and body.count(b'<em>emphasis</em>')==32
                and body.count(b'href="https://example.com"')==32
                and body.count(b'<li>First item</li>')==32 and body.count(b'<li>Second item</li>')==32)
    return True

def summarize(requests, duration):
    """Summarize successful responses while retaining failures and admission delay."""
    good=[r for r in requests if r['ok']]
    times=sorted(r['latency_ms'] for r in good)
    def percentile(p): return times[max(0,math.ceil(len(times)*p)-1)] if times else None
    return {'attempts':len(requests),'successful':len(good),'failed':len(requests)-len(good),
            'rps':len(good)/duration,'duration_seconds':duration,'p50_ms':percentile(.5),
            'p95_ms':percentile(.95),'p99_ms':percentile(.99),
            'mean_ttfb_ms':sum(r['ttfb_ms'] for r in good)/len(good) if good else None,
            'mean_response_bytes':sum(r['bytes'] for r in good)/len(good) if good else None,
            'max_admission_delay_ms':max((r.get('admission_delay_ms',0) for r in requests),default=0)}

def run_load(url, rows, token, concurrency, duration, rate=0, article=False):
    """Reuse one HTTP connection per worker; rate mode records queue delay from intended arrival."""
    endpoint=urlsplit(url); local=threading.local(); lock=threading.Lock(); requests=[]
    expected_content(rows)
    started=time.perf_counter(); deadline=started+duration
    def one(scheduled=None):
        begin=time.perf_counter(); scheduled=scheduled if scheduled is not None else begin
        value={'ok':False,'bytes':0,'ttfb_ms':0,'admission_delay_ms':(begin-scheduled)*1000}
        try:
            if not hasattr(local,'connection'): local.connection=http.client.HTTPConnection(endpoint.hostname,endpoint.port,timeout=15)
            local.connection.request('GET',endpoint.path+'?'+endpoint.query)
            response=local.connection.getresponse(); value['ttfb_ms']=(time.perf_counter()-scheduled)*1000
            body=response.read(); value['latency_ms']=(time.perf_counter()-scheduled)*1000
            check_start=time.perf_counter()
            value.update(ok=validate_response(response.status,body,rows,token,article),bytes=len(body),status=response.status)
            value['validation_ms']=(time.perf_counter()-check_start)*1000
        except Exception as error:
            value['error']=type(error).__name__
            if hasattr(local,'connection'): local.connection.close(); del local.connection
        value.setdefault('latency_ms',(time.perf_counter()-scheduled)*1000)
        with lock: requests.append(value)
    def worker():
        while time.perf_counter()<deadline: one()
        if hasattr(local,'connection'): local.connection.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        if rate:
            futures=[]
            for index in range(math.ceil(duration*rate)):
                scheduled=started+index/rate
                remaining=scheduled-time.perf_counter()
                if remaining>0: time.sleep(remaining)
                futures.append(pool.submit(one,scheduled))
            for future in futures: future.result()
        else:
            for future in [pool.submit(worker) for _ in range(concurrency)]: future.result()
    elapsed=time.perf_counter()-started
    return {'summary':summarize(requests,elapsed),'requests':requests}

def main():
    """Run a supplied workload and write every response measurement to JSON."""
    parser=argparse.ArgumentParser(); parser.add_argument('--config',required=True); parser.add_argument('--out',required=True);parser.add_argument('--hold',action='store_true')
    args=parser.parse_args(); config=json.loads(args.config)
    result=run_load(**config); target=Path(args.out);temporary=target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result));temporary.replace(target)
    # Keep cumulative cgroup counters readable until the controller samples and removes us.
    if args.hold:time.sleep(60)

if __name__=='__main__': main()
