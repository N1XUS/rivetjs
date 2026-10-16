import { test } from 'vitest';
import assert from 'node:assert/strict';
import { signal, effect, batch, createRoot } from '@rivetjs/reactivity';

test('50,000 independent effects can commit together and settle across successive batches', () => {
  let runs=0;
  const scope=createRoot(()=>Array.from({length:50000},()=>{
    const state=signal(0);
    effect(()=>{state();runs++;});
    return state;
  }));
  try {
    assert.equal(runs,50000);
    batch(()=>scope.value.forEach(state=>state.set(1)));
    assert.equal(runs,100000);
    batch(()=>scope.value.forEach(state=>state.set(2)));
    assert.equal(runs,150000);
  } finally {scope.dispose();}
});

test('feedback cycles still fail and the scheduler recovers after the error', () => {
  const armed=signal(false), left=signal(0), right=signal(0);
  const scope=createRoot(()=>{
    effect(()=>{if(armed())right.set(left()+1);});
    effect(()=>{if(armed())left.set(right()+1);});
  });
  try {assert.throws(()=>armed.set(true),/did not settle/);}finally{scope.dispose();}
  let value: number | undefined;
  const fresh=signal(0), stop=effect(()=>value=fresh());
  fresh.set(2);assert.equal(value,2);stop();
});

test('a requeued effect runs after peers already waiting in the same batch', () => {
  const state=signal(0), seen: string[]=[];
  const scope=createRoot(()=>{
    effect(()=>{const value=state();seen.push(`first:${value}`);if(value===1)state.set(2);});
    effect(()=>seen.push(`second:${state()}`));
  });
  try {batch(()=>state.set(1));assert.deepEqual(seen,['first:0','second:0','first:1','second:2','first:2']);}
  finally {scope.dispose();}
});
