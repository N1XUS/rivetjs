import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";
installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Scheduler } = await import("../src/components/scheduler/index.ts");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("scheduler: live variant, density, all class hooks, lane override and toolbar keep the root", async () => {
  const density = signal<"compact" | "comfortable">("compact");
  const variant = signal<"default" | "secondary">("default");
  const caller = signal("first");
  const toolbar = signal(true);
  const lanes = signal<number | "auto">("auto");
  const r = render(() => (
    <Scheduler
      id="live-scheduler"
      defaultDate="2031-03-10"
      density={density()}
      variant={variant()}
      toolbar={toolbar()}
      visibleLanes={lanes}
      classNames={{ grid: caller(), cell: caller(), header: caller(), toolbar: caller(), title: caller() }}
    />
  ));
  const root = document.querySelector("#live-scheduler")!;
  assert.ok(root.classList.contains("scheduler--compact"));
  assert.equal(root.querySelector(".rv-SchedulerMonth")!.getAttribute("style")?.includes("--rv-scheduler-visible-lanes: 3"), true);
  density.set("comfortable");
  variant.set("secondary");
  caller.set("second");
  await flush();
  assert.equal(document.querySelector("#live-scheduler"), root);
  assert.ok(root.classList.contains("scheduler--comfortable"));
  assert.ok(root.classList.contains("scheduler--secondary"));
  assert.equal(root.getAttribute("data-density"), "comfortable");
  for (const part of ["grid", "cell", "header", "toolbar", "title"]) {
    const el = root.querySelector(`.scheduler__${part}`)!;
    assert.ok(el.classList.contains("second"), part);
    assert.ok(!el.classList.contains("first"), part);
  }
  assert.match(root.querySelector(".rv-SchedulerMonth")!.getAttribute("style")!, /--rv-scheduler-visible-lanes: 5/);
  lanes.set(2);
  toolbar.set(false);
  await flush();
  assert.match(root.querySelector(".rv-SchedulerMonth")!.getAttribute("style")!, /--rv-scheduler-visible-lanes: 2/);
  assert.equal(root.querySelector(".scheduler__toolbar"), null);
  toolbar.set(true);
  await flush();
  assert.ok(root.querySelector(".scheduler__toolbar"));
  r.unmount();
});
