// Ported from angular/components src/cdk/layout/breakpoints-observer.spec.ts (MIT, © Google LLC).
import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import {
  Breakpoints,
  breakpointState,
  createBreakpointObserver,
  createMediaMatcher,
  type BreakpointObserver,
  type BreakpointState,
  type MediaQueryListLike,
} from "../layout/index.ts";

class FakeMediaQueryList implements MediaQueryListLike {
  private _listeners: ((mql: { matches: boolean }) => void)[] = [];
  matches: boolean;
  media: string;
  constructor(matches: boolean, media: string) {
    this.matches = matches;
    this.media = media;
  }
  /** Toggles the matches state and "emits" a change event asynchronously. */
  setMatches(matches: boolean) {
    this.matches = matches;
    setTimeout(() => this._listeners.forEach((listener) => listener(this)));
  }
  addListener(callback: (mql: { matches: boolean }) => void) {
    this._listeners.push(callback);
  }
  removeListener(callback: (mql: { matches: boolean }) => void) {
    const index = this._listeners.indexOf(callback);
    if (index > -1) this._listeners.splice(index, 1);
  }
  get listenerCount() {
    return this._listeners.length;
  }
}

class FakeMediaMatcher {
  private _queries = new Map<string, FakeMediaQueryList>();
  get queryCount(): number {
    return this._queries.size;
  }
  matchMedia(query: string): FakeMediaQueryList {
    const mql = new FakeMediaQueryList(true, query);
    this._queries.set(query, mql);
    return mql;
  }
  get(query: string) {
    return this._queries.get(query);
  }
  setMatchesQuery(query: string, matches: boolean) {
    if (this._queries.has(query)) this._queries.get(query)!.setMatches(matches);
    else throw Error("This query is not being observed.");
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const debounceTime = 20;

describe("BreakpointObserver", () => {
  let breakpointObserver: BreakpointObserver;
  let mediaMatcher: FakeMediaMatcher;
  beforeEach(() => {
    mediaMatcher = new FakeMediaMatcher();
    breakpointObserver = createBreakpointObserver(mediaMatcher);
  });

  it("retrieves the whether a query is currently matched", () => {
    assert.ok(breakpointObserver.isMatched("everything starts as true in the FakeMediaMatcher"));
  });

  it("reuses the same MediaQueryList for matching queries", () => {
    assert.equal(mediaMatcher.queryCount, 0);
    breakpointObserver.observe("query1");
    assert.equal(mediaMatcher.queryCount, 1);
    breakpointObserver.observe("query1");
    assert.equal(mediaMatcher.queryCount, 1);
    breakpointObserver.observe("query2");
    assert.equal(mediaMatcher.queryCount, 2);
    breakpointObserver.observe("query1");
    assert.equal(mediaMatcher.queryCount, 2);
  });

  it("splits combined query strings into individual matchMedia listeners", () => {
    breakpointObserver.observe("query1, query2");
    assert.equal(mediaMatcher.queryCount, 2);
    breakpointObserver.observe("query1");
    assert.equal(mediaMatcher.queryCount, 2);
    breakpointObserver.observe("query2, query3");
    assert.equal(mediaMatcher.queryCount, 3);
  });

  it("accepts an array of queries", () => {
    const queries = ["1 query", "2 query", "red query", "blue query"];
    breakpointObserver.observe(queries);
    assert.equal(mediaMatcher.queryCount, queries.length);
  });

  it("completes all events when the breakpoint manager is destroyed", () => {
    let first = 0,
      second = 0;
    breakpointObserver.observe("test1").subscribe({ complete: () => first++ });
    breakpointObserver.observe("test2").subscribe({ complete: () => second++ });
    assert.equal(first + second, 0);
    breakpointObserver.destroy();
    assert.equal(first, 1);
    assert.equal(second, 1);
    assert.equal(mediaMatcher.get("test1")!.listenerCount, 0, "listeners removed");
  });

  it("emits an event on the observable when values change", async () => {
    const query = "(width: 999px)";
    let queryMatchState = false;
    breakpointObserver.observe(query).subscribe((state) => (queryMatchState = state.matches));
    await wait(debounceTime);
    assert.ok(queryMatchState);
    mediaMatcher.setMatchesQuery(query, false);
    await wait(debounceTime);
    assert.equal(queryMatchState, false);
  });

  it("emits an event on the observable with the matching state of all queries provided", async () => {
    const queryOne = "(width: 999px)";
    const queryTwo = "(width: 700px)";
    let state: BreakpointState = { matches: false, breakpoints: {} };
    breakpointObserver.observe([queryOne, queryTwo]).subscribe((breakpoint) => (state = breakpoint));
    assert.deepEqual(state.breakpoints, { [queryOne]: true, [queryTwo]: true });
    mediaMatcher.setMatchesQuery(queryOne, false);
    mediaMatcher.setMatchesQuery(queryTwo, false);
    await wait(debounceTime);
    assert.deepEqual(state.breakpoints, { [queryOne]: false, [queryTwo]: false });
    mediaMatcher.setMatchesQuery(queryOne, true);
    mediaMatcher.setMatchesQuery(queryTwo, false);
    await wait(debounceTime);
    assert.deepEqual(state.breakpoints, { [queryOne]: true, [queryTwo]: false });
  });

  it("emits a true matches state when the query is matched", () => {
    const query = "(width: 999px)";
    breakpointObserver.observe(query).subscribe();
    mediaMatcher.setMatchesQuery(query, true);
    assert.ok(breakpointObserver.isMatched(query));
  });

  it("emits a false matches state when the query is not matched", async () => {
    const query = "(width: 999px)";
    breakpointObserver.observe(query).subscribe();
    mediaMatcher.setMatchesQuery(query, false);
    await wait(debounceTime);
    assert.equal(breakpointObserver.isMatched(query), false);
  });

  it("emits one event when multiple queries change", async () => {
    let calls = 0;
    const queryOne = "(width: 700px)";
    const queryTwo = "(width: 999px)";
    let skipFirst = true;
    breakpointObserver.observe([queryOne, queryTwo]).subscribe(() => (skipFirst ? (skipFirst = false) : calls++));
    mediaMatcher.setMatchesQuery(queryOne, false);
    mediaMatcher.setMatchesQuery(queryTwo, false);
    await wait(debounceTime);
    assert.equal(calls, 1);
  });

  it("should not complete other subscribers when preceding subscriber completes", async () => {
    const queryOne = "(width: 700px)";
    const queryTwo = "(width: 999px)";
    const breakpoint = breakpointObserver.observe([queryOne, queryTwo]);
    let emitted: number[] = [];
    const skipOne = (fn: () => void) => {
      let first = true;
      return () => (first ? (first = false) : fn());
    };
    const subs = [
      breakpoint.subscribe(skipOne(() => emitted.push(1))),
      // take(1) after skip(1): unsubscribes itself after its first change.
      (() => {
        let sub: { unsubscribe(): void } | undefined;
        let done = false;
        sub = breakpoint.subscribe(
          skipOne(() => {
            if (done) return;
            done = true;
            emitted.push(2);
            sub?.unsubscribe();
          }),
        );
        return sub;
      })(),
      breakpoint.subscribe(skipOne(() => emitted.push(3))),
      breakpoint.subscribe(skipOne(() => emitted.push(4))),
    ];
    mediaMatcher.setMatchesQuery(queryOne, true);
    mediaMatcher.setMatchesQuery(queryTwo, false);
    await wait(debounceTime);
    assert.deepEqual(emitted, [1, 2, 3, 4]);
    emitted = [];
    mediaMatcher.setMatchesQuery(queryOne, false);
    mediaMatcher.setMatchesQuery(queryTwo, true);
    await wait(debounceTime);
    assert.deepEqual(emitted, [1, 3, 4]);
    subs.forEach((s) => s.unsubscribe());
  });
});

describe("MediaMatcher (server)", () => {
  it("noop matcher: only all / empty queries match", () => {
    const matcher = createMediaMatcher();
    assert.equal(matcher.matchMedia("all").matches, true);
    assert.equal(matcher.matchMedia("").matches, true);
    assert.equal(matcher.matchMedia(Breakpoints.Handset).matches, false);
  });
});

describe("breakpointState (signal)", () => {
  it("server / initial state from `initial`, then follows the observer once connected", async () => {
    const mediaMatcher = new FakeMediaMatcher();
    const observer = createBreakpointObserver(mediaMatcher);
    const bp = breakpointState([Breakpoints.XSmall, Breakpoints.Small], { initial: { [Breakpoints.XSmall]: true }, observer: () => observer });
    assert.deepEqual(untrack(bp.state), { matches: true, breakpoints: { [Breakpoints.XSmall]: true, [Breakpoints.Small]: false } });
    const disconnect = bp.connect();
    assert.equal(untrack(bp.state).breakpoints[Breakpoints.Small], true, "fake matcher: everything matches");
    mediaMatcher.setMatchesQuery(Breakpoints.XSmall, false);
    mediaMatcher.setMatchesQuery(Breakpoints.Small, false);
    await wait(debounceTime);
    assert.equal(untrack(bp.state).matches, false);
    disconnect();
  });
});
