"""Small static reports that expose errors and avoid universal ranking claims."""
import html
import json
from pathlib import Path

def generator_cells(case):
    """Generator identity, CPU used vs. usable capacity, headroom, busiest thread and strict-validation share."""
    gen=case.get('generator') or {};validation=case.get('load',{}).get('validation') or {}
    used=gen.get('cpu_cores_used');capacity=gen.get('capacity_cores');elu=gen.get('max_worker_elu')
    strict=validation.get('strict');checked=validation.get('length_checked')
    return [gen.get('implementation',''),
            f"{used:.2f}/{capacity:g}" if used is not None and capacity else None,
            round(gen['headroom_pct']) if gen.get('headroom_pct') is not None else None,
            round(elu,2) if elu is not None else None,
            f"{strict}/{strict+checked}" if strict is not None and checked is not None else ('all' if gen.get('implementation')=='python' else None)]

def mode(case):
    load=case.get('load',{})
    return load.get('mode') or (f"open {case['rate']:g}/s" if case.get('rate') else 'closed')

def html_report(data):
    """Render untrusted measurement labels as escaped HTML in a sortable-free results table."""
    rows=[]
    for case in data['cases']:
        load=case['load']; frontend=case.get('resources',{}).get('frontend',{})
        phases=case.get('frontend_counter_delta',{});completed=phases.get('completed',0)
        phase_means=[round(phases.get(key,0)/completed,3) if completed else None for key in ['rpcMs','parseMs','renderMs']]
        version=data.get('metadata',{}).get('versions',{}).get(case['framework'],{}).get('version','')
        output_mode=data.get('metadata',{}).get('versions',{}).get(case['framework'],{}).get('outputMode','')
        values=[case['framework'],version,output_mode,case['rows'],case.get('article',False),case['concurrency'],case.get('repeat',0),
                case.get('gc',''),case.get('strings',False),round(load['rps'],2),load['p50_ms'],load['p99_ms'],load.get('p50_ttfb_ms'),load.get('p99_ttfb_ms'),load['failed'],
                frontend.get('cpu_ms_per_response'),round(frontend.get('peak_memory_bytes',0)/1048576,2),
                load.get('mean_response_bytes'),load.get('max_admission_delay_ms'),*phase_means,mode(case),*generator_cells(case),case.get('warning','')]
        rows.append('<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in values)+'</tr>')
    return '''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rivet SSR benchmark</title><style>body{font:15px system-ui;margin:32px}table{border-collapse:collapse}td,th{padding:9px;border:1px solid #ddd;text-align:left}pre{white-space:pre-wrap}p{max-width:960px}</style></head><body><h1>Rivet SSR foundation benchmark</h1><p>Static SSR + one native gRPC call per response. The rivet lane uses the hand-written streaming emitter; rivet-compiled uses current compiled JSX; rivet-compiled-baseline uses the pinned b01eba3 compiled artifact. This static fixture does not compare browser reactivity or resumability. The solid and qwik lanes retain the Solid 2 and Qwik 2 previews; solid-stable and qwik-stable use separately pinned stable releases. The optional solid-stable-string control buffers the identical Solid 1 page with public renderToString; solid-stable keeps its streaming API. Competitors use production builds and retain generated metadata. Results apply to this fixture and machine. Errors and backend/load-generator saturation invalidate ranking claims. Phase columns show mean wall time, including writer waits, per completed frontend page. Missing counters stay blank, not zero. Generator columns: CPU cores used / usable capacity (its quota; one core for the GIL-bound Python generator), headroom left, busiest worker thread's event-loop utilization, and strictly validated / total successful responses (the rest matched a strictly validated page's exact byte length, status and completion markers). A case is only generator-independent with clear headroom (no generator warning).</p><table><thead><tr>'''+''.join('<th>'+label+'</th>' for label in ['Framework','Version','Output mode','Rows','Article','Concurrency','Repeat','GC profile','Strings','Success/s','p50 ms','p99 ms','TTFB p50 ms','TTFB p99 ms','Failures','CPU ms/response','Peak working MiB','HTML bytes','Max admission delay ms','RPC ms','Parse ms','Render ms','Mode','Generator','Gen CPU used/capacity','Gen headroom %','Gen max thread ELU','Strict-validated','Notes'])+'</tr></thead><tbody>'+''.join(rows)+'</tbody></table><h2>Environment and limits</h2><pre>'+html.escape(json.dumps(data['metadata'],indent=2))+'</pre></body></html>'

def write_reports(data, directory):
    """Save raw JSON, a browser report, and a compact Markdown comparison."""
    target=Path(directory); target.mkdir(parents=True,exist_ok=True)
    (target/'results.json').write_text(json.dumps(data,indent=2))
    (target/'report.html').write_text(html_report(data))
    lines=['# SSR foundation measurements','', 'Static fixture controls: rivet hand emitter, rivet-compiled current compiled JSX, rivet-compiled-baseline pinned b01eba3 compiled artifact. Solid/Qwik stable releases and previews have separate lanes and exact versions. The optional solid-stable-string control uses buffered renderToString; solid-stable remains streaming. These are not full interactive-framework comparisons. See results.json for resource counters, errors, pinned images, and environment.','', '| Framework | Version | Output mode | Rows | Article | Concurrency | Repeat | Mode | Success/s | p99 ms | Failures | Generator | Gen headroom % | Notes |','|---|---|---|---:|---|---:|---:|---|---:|---:|---:|---|---:|---|']
    for c in data['cases']:
        version=data.get('metadata',{}).get('versions',{}).get(c['framework'],{}).get('version','')
        output_mode=data.get('metadata',{}).get('versions',{}).get(c['framework'],{}).get('outputMode','')
        v=c['load'];g=generator_cells(c)
        lines.append(f"| {c['framework']} | {version} | {output_mode} | {c['rows']} | {c.get('article',False)} | {c['concurrency']} | {c.get('repeat',0)} | {mode(c)} | {v['rps']:.2f} | {v['p99_ms']} | {v['failed']} | {g[0]} | {'' if g[2] is None else g[2]} | {c.get('warning','')} |")
    (target/'report.md').write_text('\n'.join(lines)+'\n')
