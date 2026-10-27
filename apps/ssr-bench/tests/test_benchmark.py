"""Behavioral tests for workload validation, measurements, and safe reports."""
import sys
import unittest
import threading
import http.server
import time
import tempfile
import json
import subprocess
import shutil
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from load import validate_response, summarize, run_load
from benchmark import parse_args, resource_delta
import benchmark
from report import html_report

class BenchmarkTests(unittest.TestCase):
    """Checks that failed output cannot become a winning benchmark result."""
    def test_cli_rejects_invalid_work(self):
        for args in [['--rows=-1'], ['--concurrency=0'], ['--duration=0'], ['--frameworks=unknown']]:
            with self.assertRaises(SystemExit): parse_args(args)
        self.assertEqual(parse_args(['--quick']).repeats, 1)

    def test_stable_and_preview_lanes_are_distinct_default_participants(self):
        args=parse_args([])
        for name in ['solid','qwik','solid-stable','qwik-stable']:
            self.assertIn(name,args.frameworks)
        self.assertEqual(benchmark.PORTS['solid-stable'],18111)
        self.assertEqual(benchmark.PORTS['qwik-stable'],18112)
        self.assertEqual(len(set(benchmark.PORTS.values())),len(benchmark.PORTS))

    @unittest.skipUnless(shutil.which('docker'),'Docker Compose CLI required for resolved configuration')
    def test_stable_lanes_share_preview_resource_and_service_controls(self):
        config=json.loads(subprocess.run(benchmark.COMPOSE+['config','--format','json'],
                                        check=True,text=True,capture_output=True).stdout)
        for stable,preview in [('solid-stable','solid'),('qwik-stable','qwik')]:
            lane=config['services'][stable]; control=config['services'][preview]
            self.assertEqual(lane['cpus'],control['cpus'])
            self.assertEqual(lane['mem_limit'],control['mem_limit'])
            self.assertEqual(lane['image'],control['image'])
            self.assertEqual(lane['environment']['GRPC_URL'],control['environment']['GRPC_URL'])
            self.assertEqual(lane['environment']['FRAMEWORK'],stable)
            self.assertEqual(lane['ports'][0]['host_ip'],'127.0.0.1')

    def test_report_shows_exact_stable_version_beside_lane(self):
        report=html_report({'metadata':{'versions':{'solid-stable':{'version':'1.9.15'}}},'cases':[
            {'framework':'solid-stable','rows':0,'concurrency':1,'load':{'rps':1,'p50_ms':1,'p99_ms':1,'failed':0}}]})
        self.assertIn('solid-stable</td><td>1.9.15</td>',report)
        self.assertIn('qwik-stable',report)

    def test_solid_stable_string_is_an_explicit_buffered_control(self):
        args=parse_args(['--frameworks=solid-stable,solid-stable-string','--skip-build'])
        self.assertEqual(args.frameworks,['solid-stable','solid-stable-string'])
        self.assertNotIn('solid-stable-string',parse_args([]).frameworks)
        self.assertEqual(benchmark.PORTS['solid-stable-string'],18113)
        self.assertEqual(benchmark.PORTS['react-static'],18133)
        self.assertEqual(benchmark.PORTS['react-interactive'],18134)
        self.assertIn('--profile',benchmark.startup_command(args))
        self.assertIn('--no-build',benchmark.startup_command(args))
        report=html_report({'metadata':{'versions':{'solid-stable-string':{
            'version':'1.9.15','outputMode':'buffered-renderToString'}}},'cases':[
            {'framework':'solid-stable-string','rows':0,'concurrency':1,
             'load':{'rps':1,'p50_ms':1,'p99_ms':1,'failed':0}}]})
        self.assertIn('solid-stable-string</td><td>1.9.15</td><td>buffered-renderToString</td>',report)

    @unittest.skipUnless(shutil.which('docker'),'Docker Compose CLI required for resolved configuration')
    def test_solid_stable_string_retains_stream_lane_controls(self):
        config=json.loads(subprocess.run(benchmark.COMPOSE+['--profile','variants','config','--format','json'],
                                        check=True,text=True,capture_output=True).stdout)
        lane=config['services']['solid-stable-string']; control=config['services']['solid-stable']
        for key in ['cpus','mem_limit','image','build','depends_on']:
            self.assertEqual(lane[key],control[key])
        self.assertEqual(lane['environment']['GRPC_URL'],control['environment']['GRPC_URL'])
        self.assertEqual(lane['environment']['NODE_ENV'],'production')
        self.assertEqual(lane['environment']['FRAMEWORK'],'solid-stable-string')
        self.assertEqual(lane['ports'][0]['published'],'18113')
        self.assertEqual(lane['ports'][0]['host_ip'],'127.0.0.1')
        self.assertEqual(lane['profiles'],['variants'])

    def test_old_compiled_baseline_workload_is_explicit_and_uses_skip_build(self):
        args=parse_args(['--frameworks=rivet-compiled-baseline,rivet-compiled,dotnet','--rows=1000,5000',
                         '--concurrency=1','--repeats=3','--duration=10','--warmup=3','--skip-build'])
        self.assertEqual(args.frameworks,['rivet-compiled-baseline','rivet-compiled','dotnet'])
        self.assertEqual(args.rows,[1000,5000])
        self.assertEqual(args.concurrency,[1])
        self.assertTrue(args.skip_build)
        self.assertEqual(benchmark.PORTS['rivet-compiled-baseline'],18108)
        self.assertNotIn('rivet-compiled-baseline',parse_args([]).frameworks)

    @unittest.skipUnless(shutil.which('docker'),'Docker Compose CLI required for resolved configuration')
    def test_old_compiled_compose_lane_cannot_rebuild_current_source(self):
        config=json.loads(subprocess.run(benchmark.COMPOSE+['--profile','variants','config','--format','json'],
                                        check=True,text=True,capture_output=True).stdout)
        self.assertIn('rivet-compiled-baseline',config['services'])
        baseline=config['services']['rivet-compiled-baseline']
        current=config['services']['rivet-compiled']
        self.assertEqual(baseline['image'],'rivet-ssr-bench-node:b01eba3-baseline')
        self.assertFalse(baseline.get('build'))
        self.assertEqual(current['image'],'rivet-ssr-bench-node:local')
        self.assertTrue(current['build'])
        self.assertEqual(baseline['environment']['FRAMEWORK'],'rivet-compiled')
        self.assertEqual(baseline['environment']['GRPC_URL'],'backend:8081')
        self.assertEqual(baseline['cpus'],current['cpus'])
        self.assertEqual(baseline['mem_limit'],current['mem_limit'])
        self.assertEqual(baseline['ports'][0]['published'],'18108')
        self.assertEqual(baseline['ports'][0]['host_ip'],'127.0.0.1')
        self.assertEqual(baseline['profiles'],['variants'])

    def test_skip_build_startup_cannot_trigger_implicit_compose_build(self):
        self.assertTrue(callable(getattr(benchmark,'startup_command',None)))
        args=parse_args(['--frameworks=rivet-compiled-baseline,rivet-compiled,dotnet','--skip-build'])
        command=benchmark.startup_command(args)
        self.assertIn('--no-build',command)
        self.assertEqual(command[-3:],args.frameworks)
        self.assertNotIn('--no-build',benchmark.startup_command(parse_args([])))

    def test_old_baseline_rejects_retagged_image(self):
        self.assertTrue(callable(getattr(benchmark,'verify_baseline_image',None)))
        benchmark.verify_baseline_image({'Id':'sha256:1a6ae220bb5653b26d234de80899a5d5dd796b3ddf45b0abf5b2fc847707ada0'})
        with self.assertRaisesRegex(RuntimeError,'baseline.*image'):
            benchmark.verify_baseline_image({'Id':'sha256:replacement'})

    def test_report_names_old_pinned_compiled_artifact_separately(self):
        report=html_report({'metadata':{},'cases':[]})
        self.assertIn('rivet-compiled-baseline',report)
        self.assertIn('b01eba3',report)
        self.assertIn('current compiled JSX',report)

    def test_partial_wrong_and_error_responses_fail(self):
        body=b'<main data-token="trial"></main></html><!--complete-->'
        self.assertTrue(validate_response(200,body,0,'trial'))
        for status, data in [(502,body), (200,body[:-16]), (200,body.replace(b'trial',b'other'))]:
            self.assertFalse(validate_response(status,data,0,'trial'))
        self.assertFalse(validate_response(200,body,1,'trial'))

    def test_summary_counts_errors_and_reports_tail(self):
        result=summarize([{'ok':True,'latency_ms':10,'ttfb_ms':4,'bytes':100}, {'ok':False,'latency_ms':200,'ttfb_ms':0,'bytes':3}],2)
        self.assertEqual(result['successful'],1)
        self.assertEqual(result['failed'],1)
        self.assertEqual(result['rps'],.5)
        self.assertEqual(result['p99_ms'],10)
        self.assertEqual(result['attempts'],2)

    def test_cpu_is_cumulative_delta_and_memory_is_peak(self):
        first={'cpu_ns':1000000000,'memory_bytes':30,'throttled_ns':100}
        last={'cpu_ns':1750000000,'memory_bytes':20,'throttled_ns':200}
        value=resource_delta([first,{'cpu_ns':1500000000,'memory_bytes':80,'throttled_ns':180},last],3)
        self.assertEqual(value['cpu_seconds'],.75)
        self.assertEqual(value['cpu_ms_per_response'],250)
        self.assertEqual(value['peak_memory_bytes'],80)
        self.assertEqual(resource_delta([first,last],0)['cpu_ms_per_response'],None)

    def test_report_escapes_data_and_shows_errors(self):
        html=html_report({'metadata':{},'cases':[{'framework':'<script>alert(1)</script>','rows':1,'concurrency':1,'load':{'failed':2,'successful':0,'rps':0,'p50_ms':None,'p99_ms':None},'resources':{}}]})
        self.assertNotIn('<script>',html)
        self.assertIn('&lt;script&gt;',html)
        self.assertIn('2',html)

    def test_exited_container_counter_reset_does_not_erase_cpu(self):
        samples=[{'cpu_ns':0,'memory_bytes':10,'throttled_ns':0},
                 {'cpu_ns':1000000000,'memory_bytes':20,'throttled_ns':20},
                 {'cpu_ns':0,'memory_bytes':0,'throttled_ns':0}]
        self.assertEqual(resource_delta(samples,2)['cpu_seconds'],1)

    def test_real_fixed_arrival_records_admission_delay_and_partial_failures(self):
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                time.sleep(.02)
                body=b'<main data-token="trial"></main></html><!--complete-->' if self.path.startswith('/good') else b'<html>partial'
                self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            def log_message(self,*args):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        thread=threading.Thread(target=server.serve_forever);thread.start()
        try:
            base=f'http://127.0.0.1:{server.server_port}'
            good=run_load(base+'/good',0,'trial',1,.05,rate=200)['summary']
            self.assertEqual(good['successful'],10)
            self.assertGreater(good['max_admission_delay_ms'],50)
            bad=run_load(base+'/bad',0,'trial',1,.04)['summary']
            self.assertGreater(bad['failed'],0);self.assertEqual(bad['successful'],0)
        finally:server.shutdown();server.server_close();thread.join()

    def test_wrong_values_duplicate_rows_and_missing_articles_are_failures(self):
        cells=b''.join(b'<dd>'+str(i).encode()+b'</dd>' for i in range(10))
        body=b'<main data-token="trial"><article data-row="0">'+cells+b'</article></main></html><!--complete-->'
        self.assertTrue(validate_response(200,body,1,'trial'))
        self.assertFalse(validate_response(200,body.replace(b'<dd>5</dd>',b'<dd>999</dd>'),1,'trial'))
        self.assertFalse(validate_response(200,body.replace(b'data-row="0"',b'data-row="1"'),1,'trial'))
        self.assertFalse(validate_response(200,body,1,'trial',article=True))

    def test_new_runs_preserve_prior_raw_and_reports(self):
        with tempfile.TemporaryDirectory() as directory:
            first=benchmark.make_run_directory(directory)
            (first/'raw-0.json').write_text('first');(first/'report.html').write_text('report one')
            second=benchmark.make_run_directory(directory)
            (second/'raw-0.json').write_text('second');(second/'report.html').write_text('report two')
            benchmark.publish_run_index(directory,second)
            self.assertNotEqual(first,second)
            self.assertEqual((first/'raw-0.json').read_text(),'first')
            self.assertIn(first.name,(Path(directory)/'report.html').read_text())
            self.assertIn(second.name,(Path(directory)/'report.html').read_text())

    def test_backend_oom_failure_preserves_all_states_and_samples(self):
        class Engine:
            def get(self,path):return {'State':{'OOMKilled':'backend' in path,'Running':False}}
        raw={'summary':{'successful':2,'failed':1},'requests':[{'ok':False}]}
        samples={'backend':[{'cpu_ns':0,'memory_bytes':10,'throttled_ns':0},{'cpu_ns':5,'memory_bytes':20,'throttled_ns':0}]}
        evidence=benchmark.failure_evidence(Engine(),{'frontend':'frontend','backend':'backend','load_generator':'load'},samples,raw,OSError('backend metrics unavailable'))
        self.assertTrue(evidence['container_state']['backend']['OOMKilled'])
        self.assertEqual(evidence['samples'],samples)
        self.assertEqual(evidence['load']['failed'],1)
        self.assertIn('OSError',evidence['error'])

    def test_gil_and_arrival_limitations_produce_warnings(self):
        resources={'backend':{'cpu_seconds':.1},'load_generator':{'cpu_seconds':.9}}
        load={'duration_seconds':1,'max_admission_delay_ms':100,'failed':0}
        warnings=benchmark.measurement_warnings(resources,load,rate=100)
        self.assertTrue(any('admission' in item.lower() for item in warnings))
        self.assertTrue(any('GIL' in item for item in warnings))

    def test_node_generator_is_default_and_reports_headroom_against_its_quota(self):
        args=parse_args(['--quick'])
        self.assertEqual(args.generator,'node');self.assertEqual(args.generator_threads,2);self.assertEqual(args.sample_every,32)
        self.assertEqual(parse_args(['--generator-cpus=3']).generator_threads,3)
        with self.assertRaises(SystemExit):parse_args(['--generator=python','--rate=6000'])
        node=benchmark.generator_headroom('node',3.0,2.0,2.0,{'threads':2,'max_worker_elu':.4,'worker_elu':[.4,.3]})
        self.assertEqual(node['utilization'],.75);self.assertEqual(node['headroom_pct'],25);self.assertEqual(node['threads'],2)
        python=benchmark.generator_headroom('python',1.8,2.0,2.0)
        self.assertEqual(python['capacity_cores'],1.0);self.assertAlmostEqual(python['headroom_pct'],10)

    def test_node_generator_warnings_use_quota_and_thread_saturation_not_gil(self):
        resources={'backend':{'cpu_seconds':.1},'load_generator':{'cpu_seconds':.9}}
        load={'duration_seconds':1,'max_admission_delay_ms':0,'failed':0}
        calm=benchmark.generator_headroom('node',.9,1,2.0,{'max_worker_elu':.5})
        self.assertEqual(benchmark.measurement_warnings(resources,load,0,calm),[])
        busy=benchmark.generator_headroom('node',1.6,1,2.0,{'max_worker_elu':.95})
        warnings=benchmark.measurement_warnings(resources,dict(load,unsent=3),0,busy)
        self.assertTrue(any('near quota' in w for w in warnings));self.assertTrue(any('thread saturated' in w for w in warnings))
        self.assertTrue(any('unsent' in w for w in warnings));self.assertFalse(any('GIL' in w for w in warnings))
        own=benchmark.generator_headroom('node',1.9,1,2.0,{'cpu_seconds':.5,'max_worker_elu':.2})
        self.assertEqual(own['cpu_cores_used'],.5);self.assertEqual(own['cgroup_cpu_cores_used'],1.9);self.assertEqual(own['headroom_pct'],75)
        lagging=benchmark.generator_headroom('node',.2,1,2.0,{'schedule_lag_p99_ms':9.0})
        late=benchmark.measurement_warnings(resources,dict(load,p99_admission_delay_ms=50,max_admission_delay_ms=60),100,lagging)
        self.assertTrue(any('schedule lag' in w for w in late));self.assertTrue(any('admission delay p99' in w for w in late))

    def test_load_command_runs_pinned_generator_image_on_project_network(self):
        node=benchmark.load_command(parse_args(['--quick']),'n',Path('/tmp/out'),{'rows':1},'raw-0.json')
        self.assertIn('rivet-ssr-bench-load:v2',node);self.assertIn('/loadgen/loadgen.ts',node)
        self.assertIn(benchmark.PROJECT+'_default',node);self.assertNotIn(f'{benchmark.APP}:/app:ro',node)
        python=benchmark.load_command(parse_args(['--quick','--generator=python']),'n',Path('/tmp/out'),{'rows':1},'raw-0.json')
        self.assertIn('rivet-ssr-bench-load:local',python);self.assertIn('/app/load.py',python)

    @unittest.skipUnless(shutil.which('node'),'Node required for the generator source digest')
    def test_generator_source_digest_matches_loadgen_hash(self):
        printed=subprocess.run(['node',str(benchmark.LOADGEN/'loadgen.ts'),'--hash'],check=True,text=True,capture_output=True).stdout.strip()
        self.assertEqual(printed,benchmark.loadgen_source_hash())

    def test_report_shows_generator_headroom_and_validation_share(self):
        case={'framework':'rivet','rows':1,'concurrency':10,'load':{'failed':0,'successful':100,'rps':50,'p50_ms':1,'p99_ms':2,'mode':'open-loop',
              'validation':{'strict':7,'length_checked':93}},'resources':{},
              'generator':benchmark.generator_headroom('node',.5,1,2.0,{'max_worker_elu':.31})}
        report=html_report({'metadata':{},'cases':[case]})
        self.assertIn('Gen headroom %',report);self.assertIn('<td>75</td>',report);self.assertIn('7/100',report);self.assertIn('0.31',report)

    @unittest.skipUnless(shutil.which('docker'),'Docker Compose CLI required for resolved configuration')
    def test_every_node_lane_gets_the_same_gc_profile(self):
        """B2: GC flags are a run-level profile, never a Rivet-only advantage."""
        for profile,flags in [('tuned',['--single-threaded-gc','--max-semi-space-size=8']),('default',[])]:
            args=parse_args(['--gc',profile])
            config=json.loads(subprocess.run(benchmark.COMPOSE+['--profile','variants','config','--format','json'],check=True,text=True,capture_output=True,env=benchmark.compose_env(args)).stdout)
            settings=benchmark.GC_PROFILES[profile]
            for name,service in config['services'].items():
                if name in ('backend','dotnet'):continue
                command=service['command']
                if name.endswith(('-bun','-bunserve')):  # JavaScriptCore (bun / Bun.serve lanes): GC env only (no semi-space knob)
                    self.assertIn('$BUN_GC_ENV',command[-1].replace('$$','$'),name)
                    self.assertEqual(service['environment'].get('BUN_GC_ENV',''),settings['SSR_BENCH_BUN_GC_ENV'],f'{name} {profile}')
                elif name.endswith('-deno'):  # same V8 flags as Node, via --v8-flags
                    self.assertEqual(command[:3],['deno','run','-A'],name)
                    self.assertEqual([a for a in command[3:-1] if a],[settings['SSR_BENCH_DENO_FLAGS']] if settings['SSR_BENCH_DENO_FLAGS'] else [],f'{name} {profile}')
                else:
                    self.assertEqual(command[0],'node',name);self.assertEqual(command[1:-1],flags,f'{name} {profile}')
            gc=config['services']['dotnet']['environment']['DOTNET_GC_ENV']
            self.assertEqual(gc,benchmark.GC_PROFILES[profile]['SSR_BENCH_DOTNET_GC_ENV'])

    def test_resume_lane_path_and_strings_variant(self):
        self.assertEqual(benchmark.path('rivet-resume'),'/resume');self.assertEqual(benchmark.path('rivet-router'),'/page')
        self.assertTrue(parse_args(['--strings']).strings)
        with self.assertRaises(SystemExit):parse_args(['--strings','--generator','python'])
        self.assertEqual(parse_args(['--grid']).strings,2)
        with self.assertRaises(SystemExit):parse_args(['--grid','--strings'])
        with self.assertRaises(SystemExit):parse_args(['--grid','--generator','python'])
        for name in ['solid-stable-static','rivet-resume']:self.assertIn(name,benchmark.PORTS)

if __name__=='__main__': unittest.main()
