// Props suite driver shared by every lane bundle. window.propsBench.run(check) → ms per phase:
// mount (1000 rows × 6 components), relabel (every row's label: 2 bindings + a split/merged/spread prop per row),
// select (SELECTS single selections: every row's `selected` getter re-runs, 2 rows change), bump (every
// STRIDE-th count through spread → mergeProps → splitProps), dispose. hold()/release() for the heap pass.
import { ROWS, SELECTS, STRIDE, rowData } from "./shape.js";

export function propsBench(app, mount) {
  let held = null,
    revision = 0;
  return {
    run(check) {
      const host = document.querySelector("#host"),
        data = rowData(ROWS, ++revision);
      let t0 = performance.now();
      app.load(data);
      const dispose = mount(app.table, host);
      const mounted = performance.now() - t0;
      if (check) {
        const tr = host.querySelectorAll("tbody > tr");
        if (tr.length !== ROWS) throw new Error(`mount: ${tr.length} rows`);
        const b = tr[5].querySelector("b");
        if (b.className !== "sm neutral" || b.getAttribute("data-kind") !== "b" || b.title !== data[5].label || b.textContent !== "5")
          throw new Error(`mount: badge ${b.outerHTML}`);
        if (tr[5].children[1].firstChild.className !== "cold") throw new Error("mount: tone");
      }
      t0 = performance.now();
      app.relabel("!");
      const relabel = performance.now() - t0;
      if (
        check &&
        (host.querySelector("tbody > tr:nth-child(3) td:nth-child(2) span").textContent !== data[2].label + "!" ||
          host.querySelectorAll("b")[2].title !== data[2].label + "!")
      )
        throw new Error("relabel did not propagate");
      t0 = performance.now();
      for (let s = 1; s <= SELECTS; s++) app.select((s * 97) % ROWS);
      const select = performance.now() - t0;
      if (check) {
        const danger = host.querySelectorAll("tr.danger");
        if (danger.length !== 1 || danger[0].children[1].firstChild.className !== "hot") throw new Error("select did not propagate");
      }
      t0 = performance.now();
      app.bump(STRIDE);
      const bump = performance.now() - t0;
      if (check && (host.querySelectorAll("b")[STRIDE].textContent !== String(STRIDE + 1) || host.querySelectorAll("b")[1].textContent !== "1"))
        throw new Error("bump did not propagate");
      const elements = host.getElementsByTagName("*").length;
      t0 = performance.now();
      dispose();
      app.clear();
      const disposed = performance.now() - t0;
      if (host.firstChild) host.textContent = "";
      return { mount: mounted, relabel, select, bump, dispose: disposed, elements };
    },
    hold() {
      app.load(rowData(ROWS, ++revision));
      held = mount(app.table, document.querySelector("#host"));
    },
    release() {
      held?.();
      held = null;
      app.clear();
      document.querySelector("#host").textContent = "";
    },
  };
}
