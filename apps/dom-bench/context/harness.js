// Scenario driver shared by every lane bundle: `lane` supplies app (JSX factories), mount/unmount and toString.
// DOM: window.ctxBench.run(name) → { mount, update, dispose } ms. Server: globalThis.ctxBench.render(name) → html.
export function scenario(app, name) {
  const [kind, size] = name.split("-");
  if (kind === "deep") return () => app.deep(Number(size));
  if (kind === "error") return () => app.error(Number(size));
  if (kind === "themed") return () => app.themed(Number(size));
  return () => app[kind]();
}
export function domBench(app, mount) {
  let held = null;
  return {
    run(name, check) {
      const host = document.querySelector("#host");
      app.theme(0);
      app.fail(false);
      app.tick(0);
      const factory = scenario(app, name);
      let t0 = performance.now();
      const dispose = mount(factory, host);
      const mounted = performance.now() - t0;
      let updated = null;
      if (name.startsWith("update")) {
        t0 = performance.now();
        for (let i = 1; i <= 10; i++) app.theme(i);
        updated = performance.now() - t0;
        if (check && host.querySelector("u").textContent !== "10") throw new Error("update did not propagate");
      } else if (name.startsWith("themed")) {
        t0 = performance.now();
        for (let i = 1; i <= 10; i++) app.tick(i);
        updated = performance.now() - t0;
        if (check && host.querySelectorAll(".even").length !== Number(name.split("-")[1]) + 1) throw new Error("themed update did not propagate");
      } else if (name.startsWith("error")) {
        t0 = performance.now();
        app.fail(true);
        updated = performance.now() - t0;
        if (check && !host.querySelector("em")) throw new Error("error boundary fallback missing");
      }
      const size = host.getElementsByTagName("*").length,
        text = check ? host.textContent.length : 0;
      t0 = performance.now();
      dispose();
      const disposed = performance.now() - t0;
      if (host.firstChild) host.textContent = "";
      return { mount: mounted, update: updated, dispose: disposed, elements: size, text };
    },
    // Heap pass: mount and keep it until release() (the runner GCs and reads the heap in between).
    hold(name) {
      app.theme(0);
      app.tick(0);
      app.fail(false);
      held = mount(scenario(app, name), document.querySelector("#host"));
    },
    release() {
      held?.();
      held = null;
      document.querySelector("#host").textContent = "";
    },
  };
}
export function serverBench(app, toString) {
  return {
    render(name) {
      app.theme(0);
      app.tick(0);
      app.fail(name.startsWith("error"));
      return toString(scenario(app, name));
    },
  };
}
