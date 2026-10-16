import { mount, Async, Provider, lazyComponent, clientOnly } from "@rivetjs/runtime/dom";
import { signal, createContext, useContext, onCleanup, effect, getOwner } from "@rivetjs/reactivity";
const assert = (v, message) => {
  if (!v) throw Error(message);
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
export async function run(host) {
  const token = createContext("default"),
    version = signal(0),
    jobs = [],
    contexts = [];
  let fallbackSetups = 0,
    fallbackCleanups = 0,
    resolvedSetups = 0,
    resolvedCleanups = 0;
  const Fallback = () => {
    fallbackSetups++;
    onCleanup(() => fallbackCleanups++);
    return <i>waiting</i>;
  };
  const Result = ({ value }) => {
    resolvedSetups++;
    onCleanup(() => resolvedCleanups++);
    return <button onClick={() => contexts.push(useContext(token))}>{value}</button>;
  };
  const stop = mount(
    () => (
      <section>
        <h1>stable</h1>
        <Provider token={token} value="inner">
          <Async
            load={(work) => {
              const id = version();
              const job = deferred();
              jobs.push({ ...job, id, work });
              return job.promise;
            }}
            fallback={() => <Fallback />}
          >
            {(value) => <Result value={value} />}
          </Async>
        </Provider>
      </section>
    ),
    host,
  );
  const section = host.querySelector("section"),
    h1 = host.querySelector("h1");
  assert(fallbackSetups === 1, "fallback setup");
  assert(getOwner() === null, "no owner while waiting");
  version.set(1);
  assert(jobs[0].work.signal.aborted && fallbackCleanups === 1, "supersession abort cleanup");
  assert(jobs[1].work.get(token) === "inner", "work context after await");
  jobs[0].resolve("obsolete");
  await flush();
  assert(resolvedSetups === 0, "obsolete never renders");
  jobs[1].resolve("current");
  await flush();
  assert(
    host.querySelector("button").textContent === "current" && resolvedSetups === 1 && fallbackCleanups === 2,
    "current commit",
  );
  host.querySelector("button").click();
  assert(contexts[0] === "inner", "resolved listener context");
  assert(host.querySelector("section") === section && host.querySelector("h1") === h1, "unaffected nodes");
  const staleButton = host.querySelector("button");
  version.set(2);
  assert(resolvedCleanups === 1, "resolved replacement cleanup");
  stop();
  assert(jobs[2].work.signal.aborted, "unmount abort");
  staleButton.click();
  version.set(99);
  assert(contexts.length === 1 && jobs.length === 3, "unmount removes listeners and load tracking");
  let disposed = false;
  try {
    jobs[2].work.run(() => null);
  } catch {
    disposed = true;
  }
  assert(disposed, "disposed explicit work rejects");
  jobs[2].reject(Error("late ignored"));
  await flush();
  assert(host.innerHTML === "", "unmount clears");
  let syncFallback = 0;
  const stopSync = mount(
    () => (
      <Async
        load={() => "sync"}
        fallback={() => {
          syncFallback++;
          return "bad";
        }}
      >
        {(value) => <b>{value}</b>}
      </Async>
    ),
    host,
  );
  assert(syncFallback === 0 && host.textContent === "sync", "sync load skips fallback");
  stopSync();
  const svgJob = deferred();
  let svgWork;
  const stopSvg = mount(
    () => (
      <svg>
        <Async
          load={(work) => {
            svgWork = work;
            return svgJob.promise;
          }}
        >
          {() => <circle cx={1} />}
        </Async>
      </svg>
    ),
    host,
  );
  const circle = svgWork.run(() => <circle cy={2} />);
  svgJob.resolve(circle);
  await flush();
  assert(host.querySelector("circle").namespaceURI === "http://www.w3.org/2000/svg", "async SVG context");
  stopSvg();
  const other = document.implementation.createHTMLDocument("other"),
    otherHost = other.body,
    otherJob = deferred();
  let otherWork;
  const stopOther = mount(
    () => (
      <Async
        load={(work) => {
          otherWork = work;
          return otherJob.promise;
        }}
      >
        {(value) => value}
      </Async>
    ),
    otherHost,
  );
  otherJob.resolve(otherWork.run(() => <span>other</span>));
  await flush();
  assert(otherHost.querySelector("span").ownerDocument === other, "second document");
  stopOther();
  let imports = 0,
    setups = 0,
    cleanups = 0;
  const module = deferred();
  const Lazy = lazyComponent(
    () => {
      imports++;
      return module.promise;
    },
    undefined,
    { fallback: () => <i>lazy</i> },
  );
  const Loaded = ({ label }) => {
    setups++;
    onCleanup(() => cleanups++);
    return <strong>{label}</strong>;
  };
  const stopLazy = mount(() => <Lazy label="one" />, host);
  assert(imports === 0, "import starts asynchronously");
  await flush();
  assert(imports === 1 && host.textContent === "lazy", "lazy load");
  stopLazy();
  module.resolve({ default: Loaded });
  await flush();
  assert(setups === 0, "unmounted lazy never invokes");
  const stopAgain = mount(() => <Lazy label="two" />, host);
  await flush();
  assert(imports === 1 && setups === 1 && host.textContent === "two", "cached function fresh setup");
  stopAgain();
  assert(cleanups === 1, "lazy cleanup");
  let attempts = 0;
  const Retry = clientOnly(
    () => {
      attempts++;
      if (attempts === 1) return Promise.reject(Error("import failed"));
      return Promise.resolve({ default: Loaded });
    },
    undefined,
    { fallback: (props) => <em>{props.label}</em>, error: (err) => <small>{err.message}</small> },
  );
  const stopRetry = mount(() => <Retry label="fallback" />, host);
  assert(host.textContent === "fallback", "client fallback props");
  await flush();
  assert(host.textContent === "import failed", "lazy error UI");
  stopRetry();
  const stopSuccess = mount(() => <Retry label="retry" />, host);
  await flush();
  assert(host.textContent === "retry" && attempts === 2, "failed import retries");
  stopSuccess();
  return "passed";
}
export async function failure(host) {
  const job = deferred();
  const stop = mount(
    () => (
      <Async load={() => job.promise} fallback={() => "retained"}>
        {(value) => value}
      </Async>
    ),
    host,
  );
  job.reject(Error("visible async failure"));
  await flush();
  assert(host.textContent === "retained", "fallback retained on default failure");
  return stop;
}
const Chunk = lazyComponent(() => import("./chunk.mjs"), undefined, { fallback: () => <i>chunk pending</i> });
export function startChunk(host) {
  return mount(() => <Chunk label="actual chunk" />, host);
}
export async function callbacks(host) {
  let cleanup = 0,
    fallback = 0;
  const Broken = () => {
    onCleanup(() => cleanup++);
    return <span>partial</span>;
  };
  let error;
  try {
    mount(
      () => (
        <Async
          load={() => {
            throw Error("sync failure");
          }}
        >
          {() => null}
        </Async>
      ),
      host,
    );
  } catch (cause) {
    error = cause;
  }
  assert(error?.message === "sync failure" && host.innerHTML === "", "sync error rollback");
  const stopHandled = mount(
    () => (
      <Async
        load={() => {
          throw Error("handled");
        }}
        error={(cause) => <b>{cause.message}</b>}
        fallback={() => {
          fallback++;
          return "wrong";
        }}
      >
        {() => null}
      </Async>
    ),
    host,
  );
  assert(host.textContent === "handled" && fallback === 0, "sync error handles without fallback");
  stopHandled();
  const stopThenable = mount(
    () => (
      <Async
        load={() => ({
          get then() {
            throw Error("then getter");
          },
        })}
        error={(cause) => <b>{cause.message}</b>}
      >
        {() => null}
      </Async>
    ),
    host,
  );
  assert(host.textContent === "then getter", "promise assimilation uses load error policy");
  stopThenable();
  let thenReads = 0;
  const callableThen = function (resolve) {
    assert(this.receiver === "original", "then receiver");
    resolve("callable then");
  };
  callableThen.call = null;
  const stopCallable = mount(
    () => (
      <Async
        load={() => ({
          receiver: "original",
          get then() {
            thenReads++;
            return callableThen;
          },
        })}
        error={(cause) => cause.message}
      >
        {(value) => value}
      </Async>
    ),
    host,
  );
  await flush();
  assert(host.textContent === "callable then" && thenReads === 1, "then invocation ignores mutable call property");
  stopCallable();
  try {
    mount(
      () => (
        <Async
          load={() => Promise.resolve("value")}
          fallback={() => {
            const partial = <Broken />;
            throw Error("fallback failed");
          }}
        >
          {(value) => value}
        </Async>
      ),
      host,
    );
  } catch (cause) {
    error = cause;
  }
  assert(error?.message === "fallback failed" && cleanup === 1 && host.innerHTML === "", "fallback callback rollback");
  return "passed";
}
export async function commitFailure(host) {
  let cleanup = 0,
    loadCleanup = 0,
    loadRuns = 0;
  const loadSignal = signal(0);
  const Partial = () => {
    onCleanup(() => cleanup++);
    return <b>partial</b>;
  };
  const stop = mount(
    () => (
      <Async
        load={() => {
          onCleanup(() => loadCleanup++);
          effect(() => {
            loadSignal();
            loadRuns++;
          });
          return Promise.resolve(1);
        }}
        fallback={() => "pending"}
      >
        {() => {
          const partial = <Partial />;
          throw Error("commit failed");
        }}
      </Async>
    ),
    host,
  );
  await flush();
  loadSignal.set(1);
  assert(loadCleanup === 1 && loadRuns === 1, "commit failure releases load-owned subscriptions");
  assert(cleanup === 1 && host.innerHTML.replace(/<!--.*?-->/g, "") === "", "commit throw cleans generation");
  stop();
  assert(cleanup === 1 && loadCleanup === 1, "commit cleanup once");
  return "passed";
}

export async function errorCallbackFailure(host) {
  let cleanup = 0;
  const Partial = () => {
    onCleanup(() => cleanup++);
    return <b>partial</b>;
  };
  const stop = mount(
    () => (
      <Async
        load={() => Promise.reject(Error("load failed"))}
        fallback={() => "pending"}
        error={() => {
          const partial = <Partial />;
          throw Error("error callback failed");
        }}
      >
        {() => null}
      </Async>
    ),
    host,
  );
  await flush();
  assert(cleanup === 1 && host.textContent === "", "error callback partial cleanup");
  stop();
  assert(cleanup === 1, "error callback cleanup once");
  return "passed";
}
export async function reentrant(host) {
  const version = signal(0),
    jobs = [],
    cleanups = [];
  let committed = 0;
  const stop = mount(
    () => (
      <Async
        load={(work) => {
          const generation = version(),
            job = deferred();
          jobs.push({ ...job, work, generation });
          onCleanup(() => cleanups.push(generation));
          return job.promise;
        }}
        fallback={() => "pending"}
      >
        {(value) => {
          committed++;
          if (value === "first") version.set(1);
          return value;
        }}
      </Async>
    ),
    host,
  );
  jobs[0].resolve("first");
  await flush();
  assert(
    jobs.length === 2 && jobs[0].work.signal.aborted && !jobs[1].work.signal.aborted && host.textContent === "pending",
    "reentrant children preserves replacement fallback",
  );
  jobs[1].resolve("second");
  await flush();
  assert(
    host.textContent === "second" && committed === 2 && cleanups.join(",") === "0",
    "reentrant replacement commits",
  );
  stop();
  assert(cleanups.join(",") === "0,1", "reentrant cleanup once");
  const unmountJob = deferred();
  let stopUnmount;
  stopUnmount = mount(
    () => (
      <Async load={() => unmountJob.promise} fallback={() => "pending"}>
        {() => {
          stopUnmount();
          return "after unmount";
        }}
      </Async>
    ),
    host,
  );
  unmountJob.resolve();
  await flush();
  assert(host.innerHTML === "", "unmount during children stays empty");
  const errorVersion = signal(0),
    errorJobs = [];
  const stopError = mount(
    () => (
      <Async
        load={(work) => {
          errorVersion();
          const job = deferred();
          errorJobs.push({ ...job, work });
          return job.promise;
        }}
        fallback={() => "pending"}
        error={() => {
          errorVersion.set(1);
          return "obsolete error";
        }}
      >
        {(value) => value}
      </Async>
    ),
    host,
  );
  errorJobs[0].reject(Error("first rejection"));
  await flush();
  assert(
    errorJobs.length === 2 && !errorJobs[1].work.signal.aborted && host.textContent === "pending",
    "reentrant error preserves replacement",
  );
  errorJobs[1].resolve("error recovered");
  await flush();
  assert(host.textContent === "error recovered", "reentrant error replacement commits");
  stopError();
  const fallbackVersion = signal(0),
    fallbackJobs = [];
  let fallbackRuns = 0;
  const stopFallback = mount(
    () => (
      <Async
        load={(work) => {
          fallbackVersion();
          const job = deferred();
          fallbackJobs.push({ ...job, work });
          return job.promise;
        }}
        fallback={() => {
          fallbackRuns++;
          if (fallbackRuns === 1) fallbackVersion.set(1);
          return "fallback";
        }}
      >
        {(value) => value}
      </Async>
    ),
    host,
  );
  assert(
    fallbackJobs.length === 2 && !fallbackJobs[1].work.signal.aborted,
    "reentrant initial fallback preserves replacement",
  );
  fallbackJobs[1].resolve("fallback recovered");
  await flush();
  assert(host.textContent === "fallback recovered", "reentrant fallback replacement commits");
  stopFallback();
  return "passed";
}
export async function reentrantCleanup(host) {
  const version = signal(0),
    jobs = [];
  let fallbackCleanups = 0;
  const Pending = ({ generation }) => {
    onCleanup(() => {
      fallbackCleanups++;
      if (generation === 0) version.set(1);
    });
    return <i>pending cleanup</i>;
  };
  const stop = mount(
    () => (
      <Async
        load={(work) => {
          const generation = version(),
            job = deferred();
          jobs.push({ ...job, work, generation });
          return job.promise;
        }}
        fallback={() => <Pending generation={version()} />}
      >
        {(value) => value}
      </Async>
    ),
    host,
  );
  jobs[0].resolve("obsolete");
  await flush();
  assert(
    jobs.length === 2 &&
      jobs[0].work.signal.aborted &&
      !jobs[1].work.signal.aborted &&
      host.textContent === "pending cleanup",
    "cleanup invalidation retains replacement",
  );
  jobs[1].resolve("latest");
  await flush();
  assert(host.textContent === "latest" && fallbackCleanups === 2, "cleanup replacement commits");
  stop();
  assert(fallbackCleanups === 2, "cleanup invalidation is once only");
  const workVersion = signal(0),
    workJobs = [];
  const stopWork = mount(
    () => (
      <Async
        load={(work) => {
          workVersion();
          const job = deferred();
          workJobs.push({ ...job, work });
          return job.promise;
        }}
        fallback={() => "pending work"}
      >
        {(value) => value}
      </Async>
    ),
    host,
  );
  let disposed = false;
  try {
    workJobs[0].work.run(() => {
      workVersion.set(1);
      return "stale work";
    });
  } catch {
    disposed = true;
  }
  assert(
    disposed && workJobs.length === 2 && !workJobs[1].work.signal.aborted,
    "work.run detects reentrant disposal without stopping replacement",
  );
  workJobs[1].resolve("work latest");
  await flush();
  assert(host.textContent === "work latest", "work replacement commits");
  stopWork();
  return "passed";
}

// `hold`: the committed output stays mounted and live until the next generation commits; `swap`
// wraps each non-fallback commit and may apply it later (stale applies are no-ops).
export async function holdSwap(host) {
  const version = signal(0),
    jobs = [],
    swaps = [];
  let setups = 0,
    cleanups = 0,
    clicks = 0,
    fallbacks = 0,
    deferApply = false;
  const Page = ({ value }) => {
    setups++;
    onCleanup(() => cleanups++);
    const count = signal(0);
    return (
      <button onClick={() => (clicks++, count.set(count() + 1))}>
        {value} {count()}
      </button>
    );
  };
  const stop = mount(
    () => (
      <Async
        hold
        load={() => {
          const id = version();
          const job = deferred();
          jobs.push({ ...job, id });
          return job.promise;
        }}
        fallback={() => (fallbacks++, <i>first</i>)}
        error={(cause) => <b>{String(cause)}</b>}
        swap={(apply, next) => {
          swaps.push({ apply, next, text: next.textContent });
          if (!deferApply) apply();
        }}
      >
        {(value) => <Page value={value} />}
      </Async>
    ),
    host,
  );
  assert(fallbacks === 1 && host.textContent === "first" && swaps.length === 0, "first generation commits its fallback without swap");
  jobs[0].resolve("one");
  await flush();
  assert(host.textContent === "one 0" && swaps.length === 1 && swaps[0].text === "one 0", "swap gets the detached output");
  assert(swaps[0].next.nodeType === 11, "detached output is a fragment");
  version.set(1);
  assert(fallbacks === 1 && cleanups === 0 && host.textContent === "one 0", "held: no fallback, old output kept mounted");
  host.querySelector("button").click();
  assert(clicks === 1 && host.textContent === "one 1", "held output stays live while loading");
  deferApply = true;
  jobs[1].resolve("two");
  await flush();
  assert(swaps.length === 2 && host.textContent === "one 1" && cleanups === 0, "deferred apply keeps the old output");
  swaps[1].apply();
  assert(host.textContent === "two 0" && cleanups === 1 && setups === 2, "apply disposes the held output and inserts the new one");
  // A superseded generation's late apply is a no-op that discards its output.
  version.set(2);
  jobs[2].resolve("three");
  await flush();
  version.set(3);
  swaps[2].apply();
  assert(host.textContent === "two 0" && cleanups === 2 && setups === 3, "stale apply discards");
  deferApply = false;
  jobs[3].reject("boom");
  await flush();
  assert(swaps.length === 4 && host.textContent === "boom" && cleanups === 3, "error output commits through swap");
  stop();
  return "passed";
}
