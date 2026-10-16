"""Build and measure only Rivet's owned SSR Compose project, preserving raw evidence."""
import argparse
import datetime
import http.client
import json
import os
import platform
import socket
import subprocess
import threading
import time
import urllib.request
import html
import uuid
import hashlib
import math
from pathlib import Path
from report import write_reports
from load import validate_response

ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'apps/ssr-bench'
# A separate Compose project / loopback port prefix lets a smoke run coexist with another
# stack (images are shared by explicit name, so nothing is rebuilt or retagged).
# RIVET_BENCH_PROJECT is the older spelling of SSR_BENCH_PROJECT, still accepted.
PROJECT=os.environ.get('SSR_BENCH_PROJECT') or os.environ.get('RIVET_BENCH_PROJECT','rivet-ssr-bench')
PORT_PREFIX=os.environ.get('SSR_BENCH_PORT_PREFIX','181')
if not (PORT_PREFIX.isdigit() and len(PORT_PREFIX)==3):raise SystemExit('SSR_BENCH_PORT_PREFIX must be three digits (default 181)')
COMPOSE=['docker','compose','-p',PROJECT,'-f',str(APP/'compose.yaml')]
PORTS={name:int(PORT_PREFIX+suffix) for name,suffix in {'rivet':'01','solid':'02','qwik':'03','solid-stable':'11','qwik-stable':'12','solid-stable-string':'13','dotnet':'04','rivet-string':'05','rivet-compiled':'06','rivet-for':'07','rivet-compiled-baseline':'08','rivet-router':'09','solid-stable-static':'14','rivet-resume':'15','rivet-compiled-bun':'16','rivet-router-bun':'17','rivet-compiled-deno':'18','rivet-router-deno':'19','solid-stable-static-bun':'20','solid-stable-interactive':'21','rivet-router-uws':'22','rivet-resume-uws':'23','rivet-router-bunserve':'24','rivet-resume-bunserve':'25','rivet-router-trixie':'26','rivet-resume-trixie':'27','rivet-compiled-uws':'28','solid-stable-static-uws':'29','rivet-compiled-trixie':'30','solid-stable-static-trixie':'31'}.items()}
# Request path per lane (default /page). rivet-resume = the router build's interactive resumable route.
PATHS={'rivet-resume':'/resume','rivet-resume-uws':'/resume','rivet-resume-bunserve':'/resume','rivet-resume-trixie':'/resume'}  # bun/deno router lanes measure /page (same as rivet-router)
# GC profiles (B2): identical for every Node lane; Razor gets the matching .NET knobs. Passed to Compose as
# SSR_BENCH_NODE_FLAGS / SSR_BENCH_DOTNET_GC_ENV (compose.yaml defaults = tuned).
GC_PROFILES={'tuned':{'SSR_BENCH_NODE_FLAGS':'--single-threaded-gc --max-semi-space-size=8','SSR_BENCH_DOTNET_GC_ENV':'DOTNET_gcConcurrent=0 DOTNET_GCgen0size=0x1000000',
                       'SSR_BENCH_DENO_FLAGS':'--v8-flags=--single-threaded-gc,--max-semi-space-size=8','SSR_BENCH_BUN_GC_ENV':'BUN_JSC_useConcurrentGC=0'},
             'default':{'SSR_BENCH_NODE_FLAGS':'','SSR_BENCH_DOTNET_GC_ENV':'','SSR_BENCH_DENO_FLAGS':'','SSR_BENCH_BUN_GC_ENV':''}}
def path(framework):return PATHS.get(framework,'/page')
BACKEND_METRICS=f'http://127.0.0.1:{PORT_PREFIX}10'

# Load generators. 'node' (default) is the multi-threaded raw-socket generator in loadgen/,
# built FROM the same digest-pinned Node image as Dockerfile.node. 'python' is the legacy
# GIL-bound load.py, kept for A/B comparison of the harness itself.
LOAD_IMAGES={'node':'rivet-ssr-bench-load:v2','python':'rivet-ssr-bench-load:local'}
LOADGEN=APP/'loadgen'
LOADGEN_SOURCES=['client.ts','loadgen.ts','validate.ts']

BASELINE_IMAGE='rivet-ssr-bench-node:b01eba3-baseline'
BASELINE_IMAGE_ID='sha256:1a6ae220bb5653b26d234de80899a5d5dd796b3ddf45b0abf5b2fc847707ada0'

def verify_baseline_image(image):
    """Reject a missing/replaced historic artifact instead of timing newly built code as the old baseline."""
    if image.get('Id')!=BASELINE_IMAGE_ID:
        raise RuntimeError('Pinned baseline image does not match the verified b01eba3 artifact: '+str(image.get('Id')))


def make_run_directory(root):
    """Create a unique directory so later commands cannot overwrite previous measurement evidence."""
    name=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')+'-'+uuid.uuid4().hex[:8]
    target=Path(root).resolve()/'runs'/name;target.mkdir(parents=True,exist_ok=False)
    return target

def publish_run_index(root, run):
    """Publish an escaped report index and latest pointer while preserving every prior run."""
    root=Path(root).resolve();reports=sorted((root/'runs').glob('*/report.html'),reverse=True)
    links=''.join('<li><a href="'+html.escape(str(path.relative_to(root)))+'">'+html.escape(path.parent.name)+'</a></li>' for path in reports)
    temporary=root/'report.tmp';temporary.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Rivet SSR runs</title><h1>Rivet SSR benchmark runs</h1><p>Newest first. Each run preserves its own raw requests and environment.</p><ul>'+links+'</ul></html>');temporary.replace(root/'report.html')
    temporary=root/'latest.tmp';temporary.write_text(json.dumps({'run':str(Path(run).relative_to(root))}));temporary.replace(root/'latest.json')

def participant_states(engine, ids):
    """Capture each participant independently, including OOM state when another endpoint fails."""
    states={}
    for key,container in ids.items():
        try:states[key]=engine.get(f'/containers/{container}/json')['State']
        except Exception as error:states[key]={'inspection_error':str(error)}
    return states

def failure_evidence(engine, ids, samples, raw, error):
    """Preserve failed-run samples, available request results, and all participant states."""
    summary=raw['summary'] if raw else {'rps':0,'successful':0,'failed':None,'p50_ms':None,'p99_ms':None}
    states=participant_states(engine,ids)
    oom=[key+' OOMKilled' for key,state in states.items() if state.get('OOMKilled')]
    return {'load':summary,'samples':samples,'resources':{key:resource_delta(value,summary['successful']) for key,value in samples.items() if len(value)>=2},
            'container_state':states,'error':type(error).__name__+': '+str(error),
            'warning':'Measurement failed: '+str(error)+('; '+', '.join(oom) if oom else '')}

def loadgen_source_hash(directory=LOADGEN):
    """Same digest loadgen.ts --hash prints: sha256 over name NUL content NUL for each source."""
    digest=hashlib.sha256()
    for name in LOADGEN_SOURCES:digest.update(name.encode()+b'\0'+(Path(directory)/name).read_bytes()+b'\0')
    return digest.hexdigest()

def generator_headroom(implementation, cpu_seconds, elapsed, cpu_quota, raw_generator=None):
    """Generator CPU use against what it can actually use: its quota, or one core under the Python GIL."""
    capacity=min(1.0,cpu_quota) if implementation=='python' else cpu_quota
    used=cpu_seconds/elapsed if elapsed else 0
    value={'implementation':implementation,'cpu_quota':cpu_quota,'capacity_cores':capacity,'cpu_cores_used':used,
           'utilization':used/capacity if capacity else None,'headroom_pct':max(0.0,100*(1-used/capacity)) if capacity else None}
    if raw_generator:
        value.update({key:raw_generator.get(key) for key in ['threads','connections','worker_elu','max_worker_elu','reconnects','node','source_sha256','schedule_lag_p99_ms','schedule_lag_max_ms']})
        # The node generator measures its own process CPU over the load window only; the cgroup
        # delta also contains container start-up and result serialization, so keep it as a cross-check.
        if raw_generator.get('cpu_seconds') is not None:
            used=raw_generator['cpu_seconds']/elapsed if elapsed else 0
            value.update(cgroup_cpu_cores_used=value['cpu_cores_used'],cpu_cores_used=used,utilization=used/capacity if capacity else None,
                         headroom_pct=max(0.0,100*(1-used/capacity)) if capacity else None)
    return value

def measurement_warnings(resources, load, rate=0, generator=None):
    """Flag quota pressure, generator saturation, missed arrivals, and response failures."""
    warnings=[];elapsed=load['duration_seconds']
    if resources['backend']['cpu_seconds']/elapsed>1.6:warnings.append('Backend near 2-CPU quota')
    if generator is None or generator['implementation']=='python':
        if resources['load_generator']['cpu_seconds']/elapsed>.8:warnings.append('Generator CPU may limit throughput (Python GIL)')
    else:
        if generator['utilization'] is not None and generator['utilization']>.7:warnings.append(f"Generator CPU near quota ({generator['utilization']*100:.0f}% used)")
        if (generator.get('max_worker_elu') or 0)>.85:warnings.append(f"Generator thread saturated (ELU {generator['max_worker_elu']:.2f})")
        if (generator.get('schedule_lag_p99_ms') or 0)>5:warnings.append(f"Generator schedule lag (p99 {generator['schedule_lag_p99_ms']:.1f} ms)")
    if rate and generator and generator['implementation']!='python':
        if load.get('p99_admission_delay_ms',0)>max(10,1000/rate):warnings.append(f"Open-loop admission delay p99 {load['p99_admission_delay_ms']:.1f} ms exceeds one interval (offered rate above capacity or too few connections)")
    elif rate and load.get('max_admission_delay_ms',0)>max(10,1000/rate):warnings.append('Fixed-arrival admission delay exceeds one interval')
    if load.get('unsent'):warnings.append('Open-loop arrivals unsent at drain cap')
    if load['failed']:warnings.append('Failed responses')
    return warnings

def parse_args(argv=None):
    """Validate workload dimensions and apply quick defaults without hiding explicit overrides."""
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--quick',action='store_true');p.add_argument('--frameworks',default='rivet,solid,solid-stable,qwik,qwik-stable,dotnet')
    p.add_argument('--rows',default=None);p.add_argument('--concurrency',default=None)
    p.add_argument('--duration',type=float,default=None);p.add_argument('--warmup',type=float,default=None)
    p.add_argument('--repeats',type=int,default=None);p.add_argument('--rate',type=float,default=0)
    p.add_argument('--article',action='store_true');p.add_argument('--skip-build',action='store_true')
    p.add_argument('--stop',action='store_true');p.add_argument('--out',default=str(ROOT/'.artifacts/ssr-bench'))
    p.add_argument('--generator',choices=sorted(LOAD_IMAGES),default='node',help='load generator: node (multi-threaded, default) or python (legacy, GIL-bound)')
    p.add_argument('--generator-cpus',type=float,default=2.0,help='generator container CPU quota (default 2)')
    p.add_argument('--generator-threads',type=int,default=None,help='node generator worker threads (default ceil(generator-cpus))')
    p.add_argument('--prewarm',type=float,default=None,help='seconds of unrecorded load per lane before the matrix (JIT tiering: .NET needs >5 s); default 10, quick 0')
    p.add_argument('--cores',type=int,default=1,help='frontend container CPU quota (default 1, the comparison setting); the rivet-router lanes run that many node adapter workers (start({ workers })), other lanes stay one process')
    p.add_argument('--gc',choices=sorted(GC_PROFILES),default='tuned',help='GC profile applied identically to every Node lane (+ .NET counterpart): tuned (default) or default runtime settings')
    p.add_argument('--strings',action='store_true',help='escaping variant: rows carry text values (10%% markup-significant + non-ASCII), validated exactly after HTML parsing')
    p.add_argument('--grid',action='store_true',help='text-grid variant (strings=2, Razor-adversarial): every field a 24-64 char ASCII string, 20%% escape-bearing, validated exactly after HTML parsing')
    p.add_argument('--sample-every',type=int,default=32,help='node generator: strictly validate every Nth response (plus first two per connection and any length change)')
    args=p.parse_args(argv);args.frameworks=args.frameworks.split(',')
    try: args.rows=[int(x) for x in (args.rows or ('100' if args.quick else '100,1000')).split(',')];args.concurrency=[int(x) for x in (args.concurrency or ('1,10' if args.quick else '1,10,100')).split(',')]
    except ValueError: p.error('rows and concurrency must be comma-separated integers')
    args.duration=args.duration if args.duration is not None else (2 if args.quick else 10)
    args.warmup=args.warmup if args.warmup is not None else (1 if args.quick else 3)
    args.repeats=args.repeats if args.repeats is not None else (1 if args.quick else 3)
    args.prewarm=args.prewarm if args.prewarm is not None else (0 if args.quick else 10)
    if any(f not in PORTS for f in args.frameworks) or not args.frameworks:p.error('unknown framework')
    if not args.rows or any(n<0 or n>5000 for n in args.rows):p.error('rows must be between 0 and 5000')
    if not args.concurrency or any(n<1 or n>500 for n in args.concurrency):p.error('concurrency must be between 1 and 500')
    if not 0<=args.prewarm<=120:p.error('invalid prewarm')
    if not 0<args.duration<=120 or not 0<=args.warmup<=60 or not 1<=args.repeats<=20 or not 0<=args.rate<=100000:p.error('invalid duration, warmup, repeats, or rate')
    if args.strings and args.grid:p.error('--strings and --grid are exclusive')
    if args.grid:args.strings=2
    if args.generator=='python' and args.strings:p.error('--strings/--grid need the node generator')
    if args.generator=='python' and args.rate>5000:p.error('python generator supports rate up to 5000')
    if not 0<args.generator_cpus<=16 or not 1<=args.sample_every<=100000:p.error('invalid generator-cpus or sample-every')
    args.generator_threads=args.generator_threads or max(1,math.ceil(args.generator_cpus))
    if not 1<=args.generator_threads<=64:p.error('generator-threads must be between 1 and 64')
    if not 1<=args.cores<=16:p.error('cores must be between 1 and 16')
    return args

def compose_env(args):
    """Environment for Compose: the selected GC profile (identical for every Node lane)."""
    return {**os.environ,**GC_PROFILES[args.gc],'SSR_BENCH_CORES':str(args.cores)}

def startup_command(args):
    """Prevent implicit Compose builds during skip-build runs; start only selected owned lanes."""
    return COMPOSE+['--profile','variants','up','-d']+(['--no-build'] if args.skip_build else [])+args.frameworks


def command(args, **kwargs):
    """Run an explicit command, raising on failure and retaining stdout for metadata."""
    return subprocess.run(args,check=True,text=True,stdout=subprocess.PIPE,**kwargs).stdout.strip()

def fetch_json(url):
    """Read a bounded local metrics endpoint with a short timeout."""
    with urllib.request.urlopen(url,timeout=3) as response:return json.load(response)

class Engine:
    """Read cumulative Docker counters over the active local engine socket."""
    def __init__(self):
        context=json.loads(command(['docker','context','inspect']))[0]
        endpoint=os.environ.get('DOCKER_HOST') or context['Endpoints']['docker']['Host']
        if not endpoint.startswith('unix://'):raise RuntimeError('Local Unix Docker Engine socket required')
        self.path=endpoint[7:]
    def get(self, path):
        """Issue a single Engine API read with its own bounded connection."""
        connection=http.client.HTTPConnection('localhost',timeout=5)
        connection.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);connection.sock.settimeout(5);connection.sock.connect(self.path)
        try:
            connection.request('GET',path);response=connection.getresponse()
            if response.status!=200:raise RuntimeError(f'Engine HTTP {response.status}')
            return json.loads(response.read())
        finally:connection.close()
    def sample(self, container):
        """Record total CPU time, working-set memory, throttling, and container identity."""
        data=self.get(f'/containers/{container}/stats?stream=false&one-shot=true')
        memory=data['memory_stats'];cpu=data['cpu_stats']
        return {'time':time.monotonic(),'cpu_ns':cpu['cpu_usage']['total_usage'],
                'memory_bytes':max(0,memory.get('usage',0)-memory.get('stats',{}).get('inactive_file',0)),
                'throttled_ns':cpu.get('throttling_data',{}).get('throttled_time',0)}

def resource_delta(samples, completed):
    """Compute whole-container CPU deltas and observed memory peaks; never divide by failures."""
    if len(samples)<2:raise ValueError('Need at least two resource samples')
    cpu=max(0,max(s['cpu_ns'] for s in samples)-samples[0]['cpu_ns'])/1e9
    return {'cpu_seconds':cpu,'cpu_ms_per_response':cpu*1000/completed if completed else None,
            'peak_memory_bytes':max(s['memory_bytes'] for s in samples),
            'throttled_seconds':max(0,max(s['throttled_ns'] for s in samples)-samples[0]['throttled_ns'])/1e9}

def wait_ready(frameworks):
    """Wait for the backend and requested frontends, then verify a complete native RPC page."""
    for base in [BACKEND_METRICS]+[f'http://127.0.0.1:{PORTS[f]}' for f in frameworks]:
        for attempt in range(90):
            try:fetch_json(base+'/health');break
            except Exception:
                if attempt==89:raise
                time.sleep(.5)
    for framework in frameworks:
        with urllib.request.urlopen(f'http://127.0.0.1:{PORTS[framework]}{path(framework)}?rows=2&token=validation') as r:
            if not validate_response(r.status,r.read(),2,'validation'):raise RuntimeError(f'{framework} failed semantic preflight')

def lane_command(engine, framework):
    """Entrypoint + argv + GC env of a running lane container, as Docker reports it."""
    try:
        info=engine.get('/containers/'+command(COMPOSE+['ps','-q',framework])+'/json')
        env=[e for e in info['Config'].get('Env') or [] if e.startswith(('DOTNET_GC_ENV=','BUN_GC_ENV=','NODE_OPTIONS='))]
        return {'path':info['Path'],'args':info['Args'],'env':env,'image':info['Config'].get('Image')}
    except Exception as error:return {'error':str(error)}

def load_command(args, name, output, config, filename):
    """docker run argv for one isolated generator container on the benchmark network."""
    run=['docker','run','-d','--name',name,'--network',PROJECT+'_default','--cpus',str(args.generator_cpus),'--memory','512m','-v',f'{output}:/out']
    if args.generator=='python':
        return run+['-v',f'{APP}:/app:ro',LOAD_IMAGES['python'],'python','/app/load.py','--config',json.dumps(config),'--out','/out/'+filename,'--hold']
    return run+[LOAD_IMAGES['node'],'node','/loadgen/loadgen.ts','--config',json.dumps(config),'--out','/out/'+filename,'--hold']

def verify_generator_image(args):
    """Refuse to time a stale generator: the v2 image must carry exactly the checked-out loadgen sources."""
    if args.generator!='node':return None
    image=LOAD_IMAGES['node'];expected=loadgen_source_hash()
    actual=command(['docker','run','--rm','--network','none',image,'node','/loadgen/loadgen.ts','--hash'])
    if actual!=expected:raise RuntimeError(f'{image} was built from different loadgen sources ({actual[:12]} != {expected[:12]}); rebuild without --skip-build or run: docker build -t {image} -f apps/ssr-bench/Dockerfile.loadgen apps/ssr-bench/loadgen')
    return expected

def trial(engine, framework, rows, concurrency, args, output, index, duration):
    """Run one isolated load generator and sample frontend, backend, and generator during it."""
    token=f'trial-{index}';config={'url':f'http://{framework}:8080{path(framework)}?rows={rows}&token={token}&article={int(args.article)}'+(f'&strings={int(args.strings)}' if args.strings else ''),'rows':rows,'token':token,'concurrency':concurrency,'duration':duration,'rate':args.rate,'article':args.article}
    if args.generator=='node':config.update(threads=args.generator_threads,sample_every=args.sample_every,strings=args.strings)
    filename=f'raw-{index}.json';name=f'rivet-ssr-bench-load-{os.getpid()}'
    frontend=command(COMPOSE+['ps','-aq',framework]);backend=command(COMPOSE+['ps','-aq','backend'])
    ids={'frontend':frontend,'backend':backend};samples={key:[] for key in ids}
    container=None;sampling_errors=[];raw=None
    try:
        samples={key:[engine.sample(value)] for key,value in ids.items()}
        load_before=os.getloadavg()[0]
        before=fetch_json(f'http://127.0.0.1:{PORTS[framework]}/metrics');rpc_before=fetch_json(BACKEND_METRICS+'/metrics')
        result_path=output/filename
        result_path.unlink(missing_ok=True)
        container=command(load_command(args,name,output,config,filename))
        ids['load_generator']=container;samples['load_generator']=[engine.sample(container)]
        done=threading.Event()
        def sample_loop():
            while not done.wait(.25):
                for key,value in ids.items():
                    try:samples[key].append(engine.sample(value))
                    except Exception as error:sampling_errors.append(str(error))
        thread=threading.Thread(target=sample_loop);thread.start()
        try:
            limit=time.monotonic()+duration+45
            while not result_path.exists():
                state=engine.get(f'/containers/{container}/json')['State']
                if not state['Running']:raise RuntimeError(f'Load generator exited {state["ExitCode"]}, OOM={state.get("OOMKilled")}: '+command(['docker','logs',container]))
                if time.monotonic()>limit:raise TimeoutError('Load generator did not finish within drain deadline')
                time.sleep(.1)
        finally:done.set();thread.join()
        for key,value in ids.items():
            try:samples[key].append(engine.sample(value))
            except Exception as error:sampling_errors.append(str(error))
        state=engine.get(f'/containers/{container}/json')['State']
        raw=json.loads((output/filename).read_text());after=fetch_json(f'http://127.0.0.1:{PORTS[framework]}/metrics');rpc_after=fetch_json(BACKEND_METRICS+'/metrics')
        resources={key:resource_delta(value,raw['summary']['successful']) for key,value in samples.items()}
        host_load=[load_before,os.getloadavg()[0]]
        generator=generator_headroom(args.generator,resources['load_generator']['cpu_seconds'],raw['summary']['duration_seconds'],args.generator_cpus,raw.get('generator'))
        warning=measurement_warnings(resources,raw['summary'],args.rate,generator)
        if sampling_errors:warning.append('Resource sampling incomplete')
        return {'framework':framework,'rows':rows,'article':args.article,'strings':args.strings,'gc':args.gc,'concurrency':concurrency,'load':raw['summary'],'resources':resources,'samples':samples,'raw_file':filename,'generator':generator,
                'frontend_counter_delta':{key:after[key]-before[key] for key in ['completed','failed','cancelled','rpcMs','parseMs','renderMs'] if key in before and key in after},
                'backend_counter_delta':{key:rpc_after[key]-rpc_before[key] for key in ['calls','completed','cancelled','failed']},
                'sampling_errors':sampling_errors,'warning':'; '.join(warning+([f'Host load {max(host_load):.0f} > {os.cpu_count()} cores'] if max(host_load)>(os.cpu_count() or 1) else [])),'rate':args.rate,
                'host_load_1m':host_load,
                'container_state':participant_states(engine,ids)}
    except Exception as error:
        return {'framework':framework,'rows':rows,'article':args.article,'concurrency':concurrency,'raw_file':filename,
                **failure_evidence(engine,ids,samples,raw,error)}
    finally:
        if container:command(['docker','rm','-f',container])

def main():
    """Build once, rotate repeated trials, save evidence after each, and optionally stop owned services."""
    args=parse_args();output_root=Path(args.out).resolve();output=make_run_directory(output_root)
    if 'rivet-compiled-baseline' in args.frameworks:
        verify_baseline_image(json.loads(command(['docker','image','inspect',BASELINE_IMAGE]))[0])
    if not args.skip_build:
        subprocess.run(COMPOSE+['--profile','variants','build'],check=True,env=compose_env(args))
        if args.generator=='python':subprocess.run(['docker','build','-t',LOAD_IMAGES['python'],'-f',str(APP/'Dockerfile.load'),str(ROOT)],check=True)
        else:subprocess.run(['docker','build','-t',LOAD_IMAGES['node'],'-f',str(APP/'Dockerfile.loadgen'),str(LOADGEN)],check=True)
    generator_source=verify_generator_image(args)
    subprocess.run(startup_command(args),check=True,env=compose_env(args))
    wait_ready(args.frameworks);engine=Engine()
    metadata={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'host':platform.platform(),'machine':platform.machine(),'cpus':os.cpu_count(),
              'docker':engine.get('/info'),'options':vars(args),'scope':'production static SSR + unary native gRPC; experimental Rivet emitter',
              'frontend_quota':{'cpus':args.cores,'memory_mib':512},'backend_quota':{'cpus':2,'memory_mib':1024},'generator_quota':{'cpus':args.generator_cpus,'memory_mib':512},
              'generator':{'implementation':args.generator,'image':LOAD_IMAGES[args.generator],'threads':args.generator_threads if args.generator=='node' else None,
                           'sample_every':args.sample_every if args.generator=='node' else 1,'source_sha256':generator_source,'compose_project':PROJECT},
              'versions':{f:fetch_json(f'http://127.0.0.1:{PORTS[f]}/health') for f in args.frameworks},
              'images':json.loads(command(['docker','image','inspect',os.environ.get('RIVET_BENCH_NODE_IMAGE','rivet-ssr-bench-node:local'),'rivet-ssr-bench-backend','rivet-ssr-bench-dotnet',LOAD_IMAGES[args.generator]]+([BASELINE_IMAGE] if 'rivet-compiled-baseline' in args.frameworks else [])+([os.environ.get('RIVET_BENCH_BUN_IMAGE','rivet-ssr-bench-bun:local')] if any(f.endswith(('-bun','-bunserve')) for f in args.frameworks) else [])+([os.environ.get('RIVET_BENCH_UWS_IMAGE','rivet-ssr-bench-uws:local')] if any(f.endswith(('-uws','-trixie')) for f in args.frameworks) else [])+(['rivet-ssr-bench-deno:local'] if any(f.endswith('-deno') for f in args.frameworks) else [])))}
    metadata['run_id']=output.name
    # Provenance every stored/compared number must carry (B1): generator identity, timing window, GC profile, and
    # the command each lane container actually runs (proves identical runtime flags).
    metadata['provenance']={'generator':args.generator,'generator_sha256':generator_source,'duration':args.duration,'warmup':args.warmup,'repeats':args.repeats,
                            'rate':args.rate,'strings':args.strings,'article':args.article,'gc':args.gc,'gc_settings':GC_PROFILES[args.gc],'sample_every':args.sample_every,
                            'prewarm':args.prewarm,'generator_cpus':args.generator_cpus,'generator_threads':args.generator_threads if args.generator=='node' else None,
                            'commands':{f:lane_command(engine,f) for f in args.frameworks}}
    data={'metadata':metadata,'cases':[]};index=0
    builds={}
    for framework in args.frameworks:
        if framework=='dotnet':continue
        container=command(COMPOSE+['ps','-q',framework])
        builds[framework]=json.loads(command(['docker','exec',container,'cat','/workspace/apps/ssr-bench/dist/builds.json']))
    if builds:
        metadata['server_builds_by_framework']=builds
        metadata['server_builds']=builds.get('rivet-compiled',next(iter(builds.values())))
    # Prewarm every lane (largest page, moderate concurrency) so the first recorded trial is not the JIT's cold start.
    metadata['prewarm']={}
    if args.prewarm:
        for framework in args.frameworks:
            case=trial(engine,framework,max(args.rows),min(10,max(args.concurrency)),args,output,f'prewarm-{framework}',args.prewarm)
            metadata['prewarm'][framework]={'rps':case['load']['rps'],'failed':case['load']['failed'],'error':case.get('error')}
            print(f"prewarm {framework}: {case['load']['rps']:.1f} successes/s",flush=True)
    try:
        for rows in args.rows:
            for concurrency in args.concurrency:
                for repeat in range(args.repeats):
                    order=args.frameworks[repeat%len(args.frameworks):]+args.frameworks[:repeat%len(args.frameworks)]
                    for framework in order:
                        try:
                            warmup=trial(engine,framework,rows,concurrency,args,output,f'warmup-{index}',args.warmup) if args.warmup else None
                            case=warmup if warmup and warmup.get('error') else trial(engine,framework,rows,concurrency,args,output,index,args.duration)
                        except Exception as error:
                            case={'framework':framework,'rows':rows,'article':args.article,'concurrency':concurrency,
                                  'load':{'rps':0,'successful':0,'failed':None,'p50_ms':None,'p99_ms':None},
                                  'warning':'Measurement failed: '+str(error),'error':type(error).__name__,
                                  'container_state':engine.get('/containers/'+command(COMPOSE+['ps','-aq',framework])+'/json')['State']}
                        case['repeat']=repeat
                        data['cases'].append(case);write_reports(data,output);publish_run_index(output_root,output);index+=1
                        headroom=(case.get('generator') or {}).get('headroom_pct')
                        print(f"{framework} rows={rows} c={concurrency}: {case['load']['rps']:.1f} successes/s, failures={case['load']['failed']}"+(f", generator headroom {headroom:.0f}%" if headroom is not None else '')+(f" [{case['warning']}]" if case.get('warning') else ''),flush=True)
    finally:
        write_reports(data,output)
        publish_run_index(output_root,output)
        if args.stop:subprocess.run(COMPOSE+['--profile','variants','down'],check=True)
    if any(c['load']['failed'] or c.get('sampling_errors') or c.get('error') for c in data['cases']):raise SystemExit(1)

if __name__=='__main__':main()
