import { createRouter, Router, defineRoute } from "@rivetjs/runtime/router/dom";
import { mount, Provider, lazyComponent } from "@rivetjs/runtime/dom";
import { createRoot, effect, signal, createContext, useContext, onCleanup } from "@rivetjs/reactivity";
const assert = (value, label) => {
  if (!value) throw Error(label);
};
const fails = (fn) => {
  try {
    fn();
  } catch {
    return true;
  }
  return false;
};
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
};
const historyEvent = (action) =>
  new Promise((done) => {
    window.addEventListener("popstate", done, { once: true });
    action();
  });

export async function navigation(host) {
  history.replaceState(null, "", "/");
  assert(defineRoute("/", { path: "/wrong", render: () => null }).path === "/", "defineRoute uses explicit path");
  assert(
    fails(() => createRouter()),
    "live owner required",
  );
  let adds = 0,
    removes = 0,
    router,
    reads = 0;
  const trackedWindow = {
    location: window.location,
    history: window.history,
    addEventListener(...args) {
      adds++;
      window.addEventListener(...args);
    },
    removeEventListener(...args) {
      removes++;
      window.removeEventListener(...args);
    },
  };
  const scope = createRoot(() => {
    router = createRouter({ window: trackedWindow });
    effect(() => {
      router.location();
      reads++;
    });
  });
  assert(adds === 1 && reads === 1, "one owned popstate listener");
  router.location().pathname = "/mutated";
  assert(router.location().pathname === "/", "fresh immutable location snapshots");
  router.navigate("/one?q=a#hash");
  assert(router.location().search === "?q=a" && reads === 2, "push updates reactive URL");
  router.navigate(new URL(location.href));
  assert(reads === 2, "same href does not invalidate");
  const entries = history.length;
  router.navigate(new URL(location.href), { revalidate: true });
  assert(reads === 3 && router.location().search === "?q=a" && history.length === entries, "revalidate re-runs location readers once, same entry");
  router.navigate("two");
  await historyEvent(() => history.back());
  assert(router.location().pathname === "/one", "back popstate");
  await historyEvent(() => history.forward());
  assert(router.location().pathname === "/two", "forward popstate");
  const length = history.length;
  router.navigate("/replaced", { replace: true });
  assert(history.length === length && router.location().pathname === "/replaced", "replace history");
  for (const to of ["javascript:alert(1)", "data:text/plain,a", "https://elsewhere.test/", "//elsewhere.test/"]) {
    assert(
      fails(() => router.navigate(to)),
      "unsafe URL rejects",
    );
    assert(location.pathname === "/replaced" && history.length === length, "reject precedes history mutation");
  }
  const beforeDispose = reads;
  router.dispose();
  scope.dispose();
  router.dispose();
  assert(removes === 1, "owner and explicit disposal are idempotent");
  assert(fails(() => router.navigate("/")) && fails(() => router.location()), "disposed access rejects");
  window.dispatchEvent(new PopStateEvent("popstate"));
  assert(reads === beforeDispose, "disposed subscriptions released");
  return "passed";
}

export async function routes(host) {
  history.replaceState(null, "", "/item/first?q=one");
  const token = createContext("outer"),
    jobs = [],
    clickContexts = [];
  let router,
    setups = 0,
    cleanups = 0;
  const Result = ({ data, match }) => {
    setups++;
    onCleanup(() => cleanups++);
    return (
      <button onClick={() => clickContexts.push(useContext(token))}>
        {data + ":" + match.params.id + match.url.search}
      </button>
    );
  };
  const routes = [
    defineRoute("/item/:id", {
      load(work, match) {
        const job = deferred();
        jobs.push({ ...job, work, match });
        return job.promise;
      },
      render(data, match) {
        return <Result data={data} match={match} />;
      },
    }),
    defineRoute("/sync", {
      render() {
        return <strong>sync</strong>;
      },
    }),
    defineRoute("/error", {
      load() {
        throw Error("route error");
      },
      render() {
        return null;
      },
    }),
  ];
  const stop = mount(() => {
    router = createRouter();
    return (
      <Provider token={token} value="inner">
        <Router
          router={router}
          routes={routes}
          fallback={() => <i>pending</i>}
          error={(cause) => <mark>{cause.message}</mark>}
          notFound={(url) => <em>{url.pathname}</em>}
        />
      </Provider>
    );
  }, host);
  assert(host.textContent === "pending" && jobs.length === 1, "initial loader fallback");
  router.navigate("/item/a%2Fb?q=two#hash");
  assert(jobs[0].work.signal.aborted && jobs.length === 2, "navigation aborts pending work");
  assert(jobs[1].match.params.id === "a/b" && jobs[1].match.url.hash === "#hash", "encoded params and URL");
  assert(jobs[1].work.get(token) === "inner", "captured loader context");
  jobs[0].resolve("obsolete");
  await flush();
  assert(setups === 0, "late route load ignored");
  jobs[1].resolve("current");
  await flush();
  assert(host.textContent === "current:a/b?q=two", "current route commits");
  host.querySelector("button").click();
  assert(clickContexts[0] === "inner", "render event context");
  router.navigate("?q=three");
  assert(cleanups === 1 && jobs.length === 3, "same route query replaces region");
  router.navigate("/sync");
  assert(jobs[2].work.signal.aborted && host.textContent === "sync", "sync route immediate");
  router.navigate("/error");
  assert(host.textContent === "route error", "loader errors use route boundary");
  router.navigate("/missing");
  assert(host.textContent === "/missing", "not found URL");
  router.navigate("/item/final");
  stop();
  jobs[3].resolve("late unmounted");
  await flush();
  assert(jobs[3].work.signal.aborted && host.innerHTML === "", "unmount cancels and clears");
  return "passed";
}

export async function reentrant(host) {
  history.replaceState(null, "", "/start");
  const unrelated = signal(0);
  let observed = 0,
    router,
    cleanups = 0;
  const outside = createRoot(() =>
    effect(() => {
      observed = unrelated();
    }),
  );
  const Owned = () => {
    onCleanup(() => {
      cleanups++;
      router.navigate("/final");
    });
    return <b>owned</b>;
  };
  const stop = mount(() => {
    router = createRouter();
    return (
      <Router
        router={router}
        routes={[
          defineRoute("/start", {
            render() {
              router.navigate("/owned");
              return <i>stale</i>;
            },
          }),
          defineRoute("/owned", {
            render() {
              return <Owned />;
            },
          }),
          defineRoute("/next", {
            render() {
              return <i>next</i>;
            },
          }),
          defineRoute("/final", {
            render() {
              return <strong>final</strong>;
            },
          }),
        ]}
      />
    );
  }, host);
  assert(host.textContent === "owned", "synchronous render navigation replaces stale output");
  router.navigate("/next");
  assert(host.textContent === "final" && cleanups === 1, "cleanup reentrant navigation");
  stop();
  unrelated.set(2);
  assert(observed === 2, "unrelated owner preserved");
  outside.dispose();
  return "passed";
}

export async function lateLazy(host) {
  history.replaceState(null, "", "/lazy");
  const job = deferred();
  let setup = 0,
    router;
  const Lazy = lazyComponent(() => job.promise);
  const stop = mount(() => {
    router = createRouter();
    return (
      <Router
        router={router}
        routes={[
          defineRoute("/lazy", {
            render() {
              return <Lazy />;
            },
          }),
        ]}
      />
    );
  }, host);
  router.dispose();
  stop();
  job.resolve({
    default: () => {
      setup++;
      return <b>too late</b>;
    },
  });
  await flush();
  assert(setup === 0 && host.innerHTML === "", "dispose/unmount before lazy import completion");
  return "passed";
}

// `hold` keeps the current route mounted until the next commits (its view shows while the first
// route loads); `swap` wraps every route commit.
export async function holdSwap(host) {
  history.replaceState(null, "", "/a");
  const jobs = [],
    swaps = [];
  let router;
  const placeholder = document.createElement("p");
  placeholder.textContent = "server";
  const stop = mount(() => {
    router = createRouter();
    const routes = [
      defineRoute("/:name", {
        load: (work, match) => {
          const job = deferred();
          jobs.push(job);
          return job.promise.then(() => match.params.name);
        },
        render: (name) => <h1>{name}</h1>,
      }),
    ];
    return (
      <Router
        router={router}
        routes={routes}
        hold={() => placeholder}
        swap={(apply, next) => {
          swaps.push(next.textContent);
          apply();
        }}
      />
    );
  }, host);
  assert(host.textContent === "server" && swaps.length === 0, "hold view while the first route loads");
  jobs[0].resolve();
  await flush();
  assert(host.textContent === "a" && swaps.join() === "a", "first commit swaps");
  router.navigate("/b");
  assert(host.textContent === "a", "old route held while loading");
  jobs[1].resolve();
  await flush();
  assert(host.textContent === "b" && swaps.join() === "a,b", "second commit swaps");
  stop();
  return "passed";
}

export async function hashOnly(host) {
  history.replaceState(null, "", "/page?q=1");
  const hashes = [];
  let loads = 0,
    setups = 0,
    cleanups = 0,
    router;
  const routes = [
    defineRoute("/page", {
      load(work, match) {
        loads++;
        return match.url.search;
      },
      render(data) {
        setups++;
        onCleanup(() => cleanups++);
        return <b>{data}</b>;
      },
    }),
  ];
  const stop = mount(() => {
    router = createRouter();
    effect(() => hashes.push(router.location().hash));
    return <Router router={router} routes={routes} />;
  }, host);
  await flush();
  assert(loads === 1 && setups === 1 && host.textContent === "?q=1", "initial route");
  router.navigate("#a");
  await flush();
  assert(router.location().hash === "#a" && loads === 1 && cleanups === 0, "hash-only push keeps the route");
  assert(hashes.join() === ",#a", "location readers still see hash changes");
  await historyEvent(() => history.back());
  await flush();
  assert(router.location().hash === "" && loads === 1 && cleanups === 0, "hash-only popstate keeps the route");
  router.navigate("?q=2#a");
  await flush();
  assert(loads === 2 && cleanups === 1 && host.textContent === "?q=2", "query change reruns the route");
  router.navigate("/page?q=2");
  await flush();
  assert(loads === 2 && cleanups === 1, "dropping the hash keeps the route");
  stop();
  return "passed";
}

// A directory index file URL (`/docs/index.html`, as static hosts serve it) routes as its directory.
export async function indexFile(host) {
  history.replaceState(null, "", "/docs/index.html?q=1#top");
  let router;
  const routes = [defineRoute("/docs", { render: () => <b>docs</b> })];
  const stop = mount(() => {
    router = createRouter();
    return <Router router={router} routes={routes} />;
  }, host);
  await flush();
  assert(location.pathname + location.search + location.hash === "/docs/?q=1#top", "address rewritten in place: " + location.href);
  assert(router.location().pathname === "/docs/" && host.textContent === "docs", "the directory's route renders: " + host.textContent);
  stop();
  history.replaceState(null, "", "/");
  return "passed";
}
