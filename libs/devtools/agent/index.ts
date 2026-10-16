// DevTools page agent (`@rivetjs/devtools/agent`), injected by the dev server as the first module script:
// installs the hook before app modules run, keeps the model, draws the overlay, and serves the panel
// (docked iframe over a MessageChannel, or a pop-out window over a BroadcastChannel). Never imports app
// or framework code; its own failures are reported as `agent` errors, never thrown into the page.
import { createHook, type AgentHook, type RawEvent } from "./hook.ts";
import { Model, type Outgoing } from "./model.ts";
import { Libs } from "./libs.ts";
import { Perf, heatColor, type EventEntry, type FrameEntry, type ResourceEntry, type ShiftEntry } from "./perf.ts";
import { domSpecs, patchReflow, type ReflowPatch } from "./reflow.ts";
import { createOverlay, describeElement, rectOf, type Overlay } from "./overlay.ts";
import { appFrame, locate, parseStack } from "./source.ts";
import { dispatch, type Handlers } from "./requests.ts";
import { claimSession } from "./session.ts";
import { BATCH, SOURCE, UI_PATH, VERSION, channelName, type Envelope, type ErrorEntry, type HmrEntry, type Events, type PageMode } from "../protocol.ts";

const KEY = Symbol.for("rivet.devtools");
const STORE = "rivet-devtools:";
const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const hot = (import.meta as { hot?: { on(event: string, listener: (payload: never) => void): void } }).hot;

interface Link {
  post(batch: Envelope[]): void;
  close(): void;
}
const store = {
  get: (key: string): string | null => {
    try {
      return sessionStorage.getItem(STORE + key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null): void => {
    try {
      if (value === null) sessionStorage.removeItem(STORE + key);
      else sessionStorage.setItem(STORE + key, value);
    } catch {}
  },
};

/** Install the hook and agent once per page. */
export function start(): AgentHook {
  const scope = globalThis as { [KEY]?: AgentHook };
  if (scope[KEY]) return scope[KEY];
  const reopen = store.get("open");
  const hook = createHook(1);
  // The panel was open before this load: capture creation stacks from the start.
  hook.stacks = reopen !== null;
  scope[KEY] = hook;
  const model = new Model(
    () => hook.debug,
    () => hook,
  );
  const libs = new Libs(model, base);
  libs.watchConsole();
  // Pane data changes coalesce per frame.
  const changedLibs = new Set<Events["lib.changed"]["lib"]>();
  libs.onChange = (lib) => {
    if (!link) return;
    // One placeholder per frame, expanded into one event per changed lib at flush.
    if (!changedLibs.size) queue.push({ t: "lib.changed", d: () => ({ lib: "router" }) });
    changedLibs.add(lib);
    schedule();
  };
  let link: Link | null = null,
    seq = 0,
    nextError = 1,
    scheduled = false,
    perfQueued = false;
  // Performance indicators: observers from page start (buffered), runs while recording.
  const perf = new Perf({
    componentAt: (node) => (node instanceof Node ? model.componentAt(node) : null),
    ref: (id) => model.perfRef(id),
    locate: (stack) => model.appFrames(stack),
    describe: (node) => model.describeNode(node),
  });
  model.perf = perf;
  perf.onChange = () => {
    if (!link || perfQueued) return;
    perfQueued = true;
    queue.push({ t: "perf.changed", d: () => ((perfQueued = false), {}) });
    schedule();
  };
  const queue: Outgoing[] = [];
  const hmr: HmrEntry[] = JSON.parse(store.get("hmr") ?? "[]") as HmrEntry[];
  const errors: ErrorEntry[] = [];
  /** Elements of `a11y` errors (by error id), for hover highlight; as long as the page keeps them. */
  const errorTargets = new Map<number, WeakRef<Element>>();
  const hints = new Map<string, string>();

  const send = <K extends keyof Events>(t: K, d: Events[K]): void => {
    if (!link) return;
    queue.push({ t, d: () => d } as Outgoing);
    schedule();
  };
  const envelope = (t: string, d: unknown, r?: number): Envelope => ({ v: VERSION, s: ++seq, t, ts: performance.now(), d, ...(r !== undefined ? { r } : {}) });
  function schedule(): void {
    if (scheduled || !link) return;
    scheduled = true;
    if (document.hidden) setTimeout(flush, 100);
    else requestAnimationFrame(flush);
  }
  function flush(): void {
    scheduled = false;
    if (!link) return;
    const items = [
      ...model.drain(),
      ...queue
        .splice(0)
        .flatMap((item): Outgoing[] => (item.t === "lib.changed" ? [...changedLibs].map((lib) => ({ t: "lib.changed", d: () => ({ lib }) })) : [item])),
    ];
    changedLibs.clear();
    if (!items.length) return;
    const batch: Envelope[] = [];
    for (const item of items.slice(0, BATCH)) {
      try {
        batch.push(envelope(item.t, item.d()));
      } catch (error) {
        agentError(error);
      }
    }
    if (items.length > BATCH) batch.push(envelope("dropped", items.length - BATCH));
    link.post(batch);
  }

  function agentError(error: unknown): void {
    try {
      addError("agent", error);
    } catch {}
  }
  function addHmr(entry: HmrEntry): void {
    hmr.push(entry);
    if (hmr.length > 200) hmr.shift();
    store.set("hmr", JSON.stringify(hmr.slice(-50)));
    send("hmr", entry);
  }
  function addError(kind: ErrorEntry["kind"], cause: unknown, extra: Partial<ErrorEntry> = {}, target?: Element): void {
    const error = cause instanceof Error ? cause : null;
    const message = error ? error.name + ": " + error.message : String(cause);
    const hint = [...hints].find(([text]) => error?.message === text || message.endsWith(text))?.[1];
    const entry: ErrorEntry = { id: nextError++, kind, message, ts: performance.now(), frames: parseStack(error?.stack), ...(hint ? { hint } : {}), ...extra };
    errors.push(entry);
    if (target) errorTargets.set(entry.id, new WeakRef(target));
    if (errors.length > 200) errorTargets.delete(errors.shift()!.id);
    send("error", entry);
    const frame = appFrame(entry.frames);
    if (frame)
      locate(frame).then((file) => {
        entry.file = file;
        send("error", entry);
      }, agentError);
  }

  // Façade and hot events: the model first, then the HMR / error logs.
  hook.on = (event: RawEvent) => {
    try {
      model.handle(event);
      if (event.t.startsWith("lib.")) libs.handle(event);
      const d = event.d;
      if (event.t === "hot.update")
        addHmr({ kind: "component", ts: event.ts, id: d.id as string, instances: d.instances as number, state: (d.reset as "refresh-reset" | null) ?? "kept" });
      else if (event.t === "hot.reset") {
        const last = hmr.findLast((entry) => entry.kind === "component" && entry.id === d.id);
        if (last && last.state === "kept") {
          last.state = d.reason as "shape" | "kind";
          store.set("hmr", JSON.stringify(hmr.slice(-50)));
          send("hmr", last);
        }
      } else if (event.t === "a11y") {
        // Dev accessibility checks (runtime dev/a11y.ts): listed with the errors, with rule, element and component.
        const element = typeof Element !== "undefined" && d.element instanceof Element ? d.element : undefined;
        const at = element ? model.componentAt(element) : null;
        const comp = at !== null ? model.perfRef(at) : null;
        const rule = typeof d.rule === "string" ? d.rule : undefined;
        const text = String(d.message).replace(/^Rivet a11y \[[^\]]*\]: /, "");
        addError(
          "a11y",
          text,
          { ...(rule ? { rule } : {}), ...(element ? { element: describeElement(element) } : {}), ...(comp ? { comp: { id: comp.id, name: comp.name } } : {}) },
          element,
        );
      } else if (event.t === "error.island") {
        // RV2149 (`@rivetjs/bridge/adapter` islandRecovered): a framework island re-rendered on the client after a
        // hydration error; listed with the errors, the island root as its element (hover highlights it).
        const element = typeof Element !== "undefined" && d.element instanceof Element ? d.element : undefined;
        addError("runtime", String(d.message), element ? { element: describeElement(element) } : {}, element);
      } else if (event.t === "error.hint") {
        // The hinted text becomes the thrown error's message: attach the hint when it surfaces.
        const message = d.message as string,
          at = message.indexOf(" — ");
        hints.set(message, at >= 0 ? message.slice(at + 3) : message);
        if (hints.size > 50) hints.delete(hints.keys().next().value!);
      }
      if (link) schedule();
    } catch (error) {
      agentError(error);
    }
  };

  window.addEventListener("error", (event) => addError("runtime", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => addError("rejection", event.reason));
  hot?.on("vite:beforeUpdate", (payload: { updates: { path: string }[] }) =>
    addHmr({ kind: "update", ts: performance.now(), files: [...new Set(payload.updates.map((u) => u.path))] }),
  );
  hot?.on("vite:invalidate", (payload: { path: string; message?: string }) =>
    addHmr({ kind: "invalidate", ts: performance.now(), files: [payload.path], ...(payload.message ? { message: payload.message } : {}) }),
  );
  hot?.on("vite:beforeFullReload", (payload: { path?: string }) =>
    addHmr({ kind: "reload", ts: performance.now(), ...(payload.path ? { files: [payload.path] } : {}) }),
  );
  hot?.on("vite:error", (payload: { err: { message: string; stack?: string; id?: string; loc?: { file?: string; line: number; column: number } } }) => {
    const err = payload.err;
    addHmr({ kind: "error", ts: performance.now(), message: err.message, ...(err.id ? { files: [err.id] } : {}) });
    const file = err.loc?.file ?? err.id;
    addError(
      "vite",
      Object.assign(new Error(err.message), { name: "Vite error", stack: err.stack ?? "" }),
      file ? { file: { file, line: err.loc?.line ?? 1, col: (err.loc?.column ?? 0) + 1 } } : {},
    );
  });

  // Panel connection: recording (level 2, stacks) while a panel is connected and visible.
  const recording = (on: boolean) => {
    hook.level = on ? 2 : 1;
    if (on) hook.stacks = true;
  };
  function connect(next: Link): void {
    if (link && link !== next) link.close();
    link = next;
    model.connected = true;
    recording(true);
  }
  function disconnect(which: Link): void {
    if (link !== which) return;
    link = null;
    model.connected = false;
    model.onUpdate = null;
    model.handles.clear();
    recording(false);
  }
  const overlay: Overlay = createOverlay({
    url: () => base + UI_PATH,
    onToggle(open) {
      store.set("open", open ? "dock" : null);
      if (link) recording(open);
      if (!open) model.onUpdate = null;
    },
    onLoad(frame) {
      // The docked panel loaded: hand it one end of a fresh channel.
      if (!frame.contentWindow) return;
      const channel = new MessageChannel();
      const port = channel.port1;
      const docked: Link = {
        post: (batch) => port.postMessage(batch),
        close: () => port.close(),
      };
      port.onmessage = (event) => receive(event.data as Envelope | Envelope[], docked);
      frame.contentWindow.postMessage({ source: SOURCE, session: session.id }, location.origin, [channel.port2]);
    },
  });
  // Pop-out windows talk over a BroadcastChannel named by the session (survives page reloads). It opens
  // once the session claim settled (a duplicated tab regenerates a copied session first, `session.ts`).
  let broadcast: BroadcastChannel | null = null;
  const popped: Link = {
    post: (batch) => broadcast?.postMessage(batch),
    close: () => {},
  };
  const session = claimSession({
    stored: store.get("session"),
    save: (id) => store.set("session", id),
    listen(id) {
      if (broadcast) {
        disconnect(popped);
        broadcast.close();
      }
      const channel = (broadcast = new BroadcastChannel(channelName(id)));
      channel.onmessage = (event) => {
        const data = event.data as Envelope | Envelope[] | { bye: true };
        if ((data as { bye?: true }).bye) return disconnect(popped);
        receive(data as Envelope | Envelope[], popped);
      };
      channel.postMessage({ ready: true });
    },
  });
  function popout(): void {
    overlay.detach();
    store.set("open", "popout");
    window.open(base + UI_PATH + "#" + session.id, "rivet-devtools-" + session.id, "popup,width=1000,height=720");
  }

  // Flashes: DOM updates while highlighting is on, merged per frame; with `heat`, colored by how often
  // each node updated in the last second.
  const pending = new Set<object>();
  const heat = new WeakMap<object, { n: number; ts: number }>();
  let flashOn = false;
  const flashUpdates = (node: object) => {
    if (pending.size === 0)
      requestAnimationFrame(() =>
        quiet(() => {
          const now = performance.now();
          const groups = new Map<string | undefined, DOMRect[]>();
          for (const at of pending) {
            const rect = rectOf(at);
            if (!rect) continue;
            let color: string | undefined;
            if (perf.options.heat) {
              const seen = heat.get(at);
              const n = seen && now - seen.ts < 1000 ? seen.n + 1 : 1;
              heat.set(at, { n, ts: now });
              color = heatColor(n);
            }
            let list = groups.get(color);
            if (!list) groups.set(color, (list = []));
            list.push(rect);
          }
          pending.clear();
          for (const [color, rects] of groups) overlay.flash(rects, color);
        }),
      );
    pending.add(node);
  };
  const syncFlash = () => {
    model.onUpdate = flashOn || perf.options.heat ? flashUpdates : null;
  };

  // Forced-reflow detection: a prototype patch while enabled (persisted for the session, so a reload
  // installs it before app modules run). Reads count inside framework runs and event handlers only.
  let reflow: ReflowPatch | null = null;
  let handling: { target: EventTarget | null } | null = null;
  const quiet = <T>(fn: () => T): T => (reflow ? reflow.quiet(fn) : fn());
  const HANDLED = ["click", "input", "change", "keydown", "keyup", "pointerdown", "pointerup", "submit", "focusin", "focusout", "scroll", "wheel"];
  const onDispatch = (event: Event) => {
    if (handling) return;
    handling = { target: event.target };
    setTimeout(() => (handling = null), 0);
  };
  function setReflow(on: boolean): void {
    perf.options.reflow = on;
    if (on && !reflow) {
      reflow = patchReflow(
        domSpecs(window),
        (read, receiver) => {
          const running = hook.current ?? null;
          if (!running && !handling) return;
          const limit = Error.stackTraceLimit;
          Error.stackTraceLimit = 30;
          const stack = new Error("layout read");
          Error.stackTraceLimit = limit;
          const at = receiver instanceof Node ? receiver : handling?.target instanceof Node ? handling.target : null;
          const comp = running ? model.compId(running) : at ? model.componentAt(at) : null;
          perf.reflow(read, comp, stack, performance.now(), running ? "run" : "handler");
        },
        (fn) => setTimeout(fn, 0),
      );
      for (const type of HANDLED) window.addEventListener(type, onDispatch, { capture: true, passive: true });
    } else if (!on && reflow) {
      reflow.uninstall();
      reflow = null;
      for (const type of HANDLED) window.removeEventListener(type, onDispatch, { capture: true });
    }
  }
  try {
    const saved = JSON.parse(store.get("perf") ?? "{}") as Partial<typeof perf.options>;
    if (saved.shifts) perf.options.shifts = true;
    if (saved.heat) perf.options.heat = true;
    if (saved.reflow) setReflow(true);
  } catch {}
  syncFlash();

  // Observers (buffered: shifts and frames since navigation start).
  const observe = (type: string, onEntry: (entry: never) => void, extra: Record<string, unknown> = {}): boolean => {
    if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes(type)) return false;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          try {
            onEntry(entry as never);
          } catch (error) {
            agentError(error);
          }
        }
      }).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      return true;
    } catch {
      return false;
    }
  };
  perf.supports.layoutShift = observe("layout-shift", (entry: ShiftEntry) => perf.shift(entry));
  perf.supports.loaf = observe("long-animation-frame", (entry: FrameEntry) => perf.frame(entry));
  if (!perf.supports.loaf) perf.supports.longtask = observe("longtask", (entry: FrameEntry) => perf.frame(entry));
  perf.supports.event = observe("event", (entry: EventEntry) => perf.event(entry), { durationThreshold: 16 });
  observe("resource", (entry: ResourceEntry) => perf.resource(entry));
  perf.onShift = (rects) =>
    quiet(() =>
      overlay.flash(
        rects.map((r) => new DOMRect(r.x ?? 0, r.y ?? 0, r.width, r.height)),
        "#a855f7",
      ),
    );
  for (const type of ["pointerdown", "keydown"])
    window.addEventListener(type, (event) => perf.input(type === "pointerdown" ? "click" : "keydown", event.target, event.timeStamp), {
      capture: true,
      passive: true,
    });
  // Resumed dev pages: components are not instantiated in the browser until the page switches to client
  // render (the dev entry's hot-update fallback). Performance measures the resumed page until then;
  // inspection tabs ask for the switch (`page.inspect`), which the dev entry announces either way.
  const page: PageMode = { resumed: false, switched: false };
  const detectPage = () => {
    page.resumed = document.querySelector('[data-rivet-dev="resume"]') !== null;
    perf.resumed = page.resumed || document.querySelector('script[type="rivet/state"]') !== null;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", detectPage, { once: true });
  else detectPage();
  let switchStart = 0,
    inspecting = false;
  const switched: (() => void)[] = [];
  document.addEventListener("rivet:dev-client-render", (event) => {
    const phase = ((event as CustomEvent).detail as { phase?: string } | null)?.phase;
    if (phase === "start") switchStart = performance.now();
    else if (phase === "done") {
      Object.assign(page, { switched: true, by: inspecting ? "devtools" : "hmr", at: switchStart });
      perf.clientRender(switchStart, performance.now());
      for (const done of switched.splice(0)) done();
      send("page.mode", { ...page });
    }
  });
  const inspect = (): PageMode | Promise<PageMode> => {
    if (!page.resumed || page.switched) return { ...page };
    inspecting = true;
    return new Promise((resolve) => {
      switched.push(() => resolve({ ...page }));
      setTimeout(() => resolve({ ...page }), 10_000);
      document.dispatchEvent(new CustomEvent("rivet:devtools-inspect"));
    });
  };
  // Picker: hover highlights the nearest component; click selects it.
  let stopPicking: (() => void) | null = null;
  function pick(): void {
    stopPicking?.();
    const target = (event: Event) => {
      const node = event.composedPath()[0] as Node | undefined;
      return node && !overlay.owns(node) ? node : null;
    };
    const move = (event: PointerEvent) => {
      const node = target(event);
      const id = node ? model.componentAt(node) : null;
      highlight(id);
      send("pick.hover", { id });
    };
    const click = (event: MouseEvent) => {
      const node = target(event);
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      const id = model.componentAt(node);
      finish();
      send("pick.done", { id });
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      finish();
      send("pick.done", { id: null });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("keydown", key, true);
      highlight(null);
      stopPicking = null;
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", key, true);
    stopPicking = finish;
  }
  function highlight(id: number | null): void {
    quiet(() => {
      const rect = id === null ? null : rectOf(model.region(id));
      overlay.highlight(rect, id === null ? undefined : model.tree().length ? label(id) : undefined);
    });
  }
  const label = (id: number): string | undefined => {
    const find = (nodes: ReturnType<Model["tree"]>): string | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node.name;
        const inner = find(node.children);
        if (inner) return inner;
      }
      return undefined;
    };
    return find(model.tree());
  };

  const handlers: Handlers = {
    hello: () => ({ v: VERSION, mode: "serve", features: ["components", "signals", "updates", "hmr", "errors", "performance"], level: hook.level, session: session.id }),
    "level.set": ({ level }) => {
      hook.level = level;
      return { level };
    },
    "tree.get": () => model.tree(),
    "owner.get": ({ id }) => model.owner(id),
    "signals.get": () => model.allSignals(),
    "graph.get": ({ id, dir, depth }) => model.graph(id, dir, depth),
    "value.inspect": ({ h, offset, ancestors }) => model.inspect(h, offset, ancestors),
    "value.text": ({ h }) => model.text(h),
    "signal.set": ({ id, json }) => model.setSignal(id, json, hook),
    "signal.setPath": ({ id, path, json }) => model.setSignalPath(id, path, json, hook),
    "value.edit": ({ target, path, op }) => model.edit(target, path, op, hook),
    "override.clear": ({ target }) => ({ ok: model.clearOverride(target) }),
    "signal.details": ({ id }) => model.signalDetails(id),
    "contexts.get": () => model.contexts(),
    "libs.get": () => libs.available(),
    "router.get": () => libs.routerInfo(),
    "i18n.get": () => libs.i18nInfo(),
    "forms.get": () => libs.formsInfo(),
    "perf.get": () => {
      perf.recording = hook.level >= 2;
      return perf.info();
    },
    "perf.options": (next) => {
      if (next.reflow !== undefined && next.reflow !== perf.options.reflow) setReflow(next.reflow);
      if (next.shifts !== undefined) perf.options.shifts = next.shifts;
      if (next.heat !== undefined) {
        perf.options.heat = next.heat;
        syncFlash();
      }
      store.set("perf", JSON.stringify(perf.options));
      return { ...perf.options };
    },
    "perf.reset": () => (perf.reset(), null),
    "page.mode": () => ({ ...page }),
    "page.inspect": () => inspect(),
    highlight: ({ id }) => (highlight(id), null),
    "error.highlight": ({ id }) => {
      const element = id === null ? undefined : errorTargets.get(id)?.deref();
      quiet(() => overlay.highlight(element?.isConnected ? rectOf(element) : null, element ? describeElement(element) : undefined));
      return null;
    },
    "pick.start": () => (pick(), null),
    "pick.stop": () => (stopPicking?.(), null),
    "updates.flash": ({ on }) => {
      flashOn = on;
      syncFlash();
      return null;
    },
    "updates.reset": () => (model.resetCounts(), null),
    "editor.open": async ({ file, line, col }) => {
      const response = await fetch(base + "__open-in-editor?file=" + encodeURIComponent(file + ":" + line + ":" + col));
      return { ok: response.ok };
    },
    "dock.close": () => (overlay.close(), null),
    "dock.popout": () => (popout(), null),
  };
  let warnedVersion = false;
  function receive(data: Envelope | Envelope[], from: Link): void {
    for (const message of Array.isArray(data) ? data : [data]) {
      if (!message || typeof message.t !== "string") continue;
      if (message.t === "hello") {
        const v = (message.d as { v?: unknown } | null)?.v;
        // A stale prebuilt panel: it shows a banner from our `welcome`; say so in the page console too.
        if (v !== VERSION && !warnedVersion) {
          warnedVersion = true;
          console.warn("Rivet DevTools: the panel speaks protocol v" + String(v) + ", this page agent v" + VERSION + ". Rebuild it: node libs/devtools/build.ts");
        }
        connect(from);
        if (from === popped) overlay.detach();
        recording(from === popped || overlay.opened);
      }
      if (link !== from) continue;
      void dispatch(
        handlers,
        message,
        (t, d, r) => {
          from.post([envelope(t, d, r)]);
          if (t === "hello") send("snapshot", { tree: model.tree(), hmr, errors });
        },
        agentError,
      );
    }
  }

  window.addEventListener(
    "keydown",
    (event) => {
      if (!(event.altKey && event.shiftKey && event.code === "KeyR")) return;
      event.preventDefault();
      if (overlay.opened) overlay.close();
      else overlay.open();
    },
    true,
  );
  window.addEventListener("pagehide", () => broadcast?.postMessage({ gone: true }));
  if (reopen === "dock") {
    const reopenDock = () => overlay.open();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reopenDock, { once: true });
    else reopenDock();
  }
  return hook;
}

start();
