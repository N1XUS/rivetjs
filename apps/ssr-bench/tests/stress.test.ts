import { test } from 'vitest';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';

interface Metrics { calls: number; cancelled: number; completed: number; rss?: number; rssBytes?: number }

test('aborted RPCs, slow readers, and repeated pages release request ownership and recover',async()=>{
  const metrics=async(port:number)=>(await (await fetch(`http://127.0.0.1:${port}/metrics`)).json()) as Metrics;
  const beforeBackend=await metrics(18110);
  const evidence:{port:number;before:Metrics;rounds:Metrics[]}[]=[];
  for(const port of [18101,18102,18103,18104,18111,18112]) {
    const before=await metrics(port);
    const abort=new AbortController();
    const pending=fetch(`http://127.0.0.1:${port}/page?rows=1&delay_ms=2000`,{signal:abort.signal});
    const seen=await metrics(18110);
    for(let attempt=0;attempt<100;attempt++) {
      if((await metrics(18110)).calls>seen.calls)break;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    abort.abort();await assert.rejects(pending);
    await new Promise<void>((resolve,reject)=>{
      const request=get(`http://127.0.0.1:${port}/page?rows=5000&token=slow-reader`,response=>{
        response.pause();setTimeout(()=>{response.destroy();request.destroy();resolve();},100);
      });
      request.on('error',(error:NodeJS.ErrnoException)=>{if(error.code==='ECONNRESET')resolve();else reject(error);});
      request.setTimeout(15000,()=>{request.destroy();reject(new Error('Slow reader never received headers'));});
    });
    const rounds:Metrics[]=[];
    for(let round=0;round<3;round++) {
      for(let batch=0;batch<4;batch++) {
        await Promise.all(Array.from({length:5},async(_,index)=>{
          const response=await fetch(`http://127.0.0.1:${port}/page?rows=250&token=memory-${round}-${batch}-${index}`);
          assert.equal(response.status,200);const body=await response.text();assert.match(body,/<!--complete-->/);
        }));
      }
      rounds.push(await metrics(port));
    }
    const after=rounds.at(-1)!;
    assert.ok(after.completed-before.completed>=60);
    assert.ok((after.rss??after.rssBytes!)<512*1024*1024);
    evidence.push({port,before,rounds});
  }
  const afterBackend=await metrics(18110);
  assert.ok(afterBackend.cancelled-beforeBackend.cancelled>=6);
  await mkdir('.artifacts',{recursive:true});
  await writeFile('.artifacts/ssr-stress.json',JSON.stringify({beforeBackend,afterBackend,evidence},null,2));
});
