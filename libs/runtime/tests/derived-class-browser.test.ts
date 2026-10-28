import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

const source = await readFile(new URL("./derived/classes.tsx", import.meta.url), "utf8");
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/classes.tsx", boundaries: ["Classes"], independent: ["Classes"] };

for (const engine of ["chromium", "webkit"] as const) {
  for (const initial of ["slide base", "\tslide\nbase\f\r", "foo\u00a0bar", "", undefined, 7]) {
    const run = engine === "webkit" && !hasWebkit() ? test.skip : compiled;
    run(`adopted classes keep foreign tokens until the binding changes (${engine}, ${JSON.stringify(initial)})`, async () => {
      const server = compile(source, { target: "server", filename: "classes.tsx", resume } as never);
      const dom = compile(source, { target: "dom", filename: "classes.tsx", resume } as never);
      assert.deepEqual(server.diagnostics, []);
      assert.deepEqual(dom.diagnostics, []);
      const { Classes } = await importServer<{ Classes: (props: { initial?: string | number }) => ServerValue }>(server.code);
      const html = (await derivedToString(() => Classes(initial === undefined ? {} : { initial }), {
        manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/classes.tsx#Classes": "/classes.js" } },
        preload: { lean: true },
      })) as string;
      await withPage(
        {
          ...DERIVED_BUILD,
          "/": '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + "</body></html>",
          "/rt.js": 'export { default } from "/dom-derived.ts";',
          "/classes.js": rewrite(dom.code),
        },
        async (page, requests) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto("http://rivet.test/");
          assert.ok(!requests.includes("/rt.js"));
          // The connected parent ref initializes the plugin before these class effects attach.
          await page.evaluate(() => {
            for (const id of ["bound", "spread", "svg"]) {
              const el = document.getElementById(id)!;
              (el as Element & { original?: Element }).original = el;
            }
          });
          // Focus wakes adoption without changing the bound signal.
          await page.focus("#wake");
          await page.waitForFunction(() => !!(document.getElementById("wake") as unknown as { $$click?: unknown }).$$click);
          for (const id of ["bound", "spread", "svg"]) {
            assert.equal(
              await page.getAttribute("#" + id, "class"),
              [
                ...(initial === undefined
                  ? []
                  : String(initial)
                      .split(/[\t\n\f\r ]+/)
                      .filter(Boolean)),
                "is-snapped",
              ].join(" "),
              id,
            );
            assert.equal(await page.$eval("#" + id, (el) => (el as Element & { original?: Element }).original === el), true);
          }
          await page.click("#wake");
          await page.waitForFunction(() => document.getElementById("count")!.textContent === "1");
          for (const id of ["bound", "spread", "svg"]) assert.equal(await page.getAttribute("#" + id, "class"), "slide", id);
          await page.click("#wake");
          await page.waitForFunction(() => document.getElementById("count")!.textContent === "2");
          assert.equal(await page.getAttribute("#bound", "class"), null);
          assert.equal(await page.getAttribute("#spread", "class"), null);
          assert.equal(await page.getAttribute("#svg", "class"), "");
          assert.deepEqual(errors, []);
        },
        { engine },
      );
    });
  }
}

for (const early of [false, true])
  for (const foreign of [false, true]) {
    compiled(`adoption removes a server placement token while keeping only foreign additions (foreign=${foreign}, early=${early})`, async () => {
      const server = compile(source, { target: "server", filename: "classes.tsx", resume } as never);
      const dom = compile(source, { target: "dom", filename: "classes.tsx", resume } as never);
      const { Classes } = await importServer<{ Classes: (props: { initial: string; placement: boolean; early: boolean; foreign: boolean }) => ServerValue }>(
        server.code,
      );
      const html = await derivedToString(() => Classes({ initial: "slide placement-top", placement: true, early, foreign }), {
        manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/classes.tsx#Classes": "/classes.js" } },
        preload: { lean: true },
      });
      await withPage(
        {
          ...DERIVED_BUILD,
          "/": '<!doctype html><meta charset="utf-8">' + html,
          "/rt.js": 'export { default } from "/dom-derived.ts";',
          "/classes.js": rewrite(dom.code),
        },
        async (page) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto("http://rivet.test/");
          await page.evaluate(() => {
            for (const id of ["bound", "spread", "svg"]) {
              const el = document.getElementById(id)!;
              (el as Element & { original?: Element }).original = el;
            }
          });
          await page.focus("#wake");
          await page.waitForFunction(() => document.getElementById("count")!.textContent === "1");
          for (const id of ["bound", "spread", "svg"]) {
            assert.equal(await page.getAttribute("#" + id, "class"), foreign ? "slide is-snapped" : "slide", id);
            assert.equal(await page.$eval("#" + id, (el) => (el as Element & { original?: Element }).original === el), true);
          }
          await page.click("#wake");
          await page.waitForFunction(() => document.getElementById("count")!.textContent === "2");
          assert.equal(await page.getAttribute("#bound", "class"), null);
          assert.deepEqual(errors, []);
        },
      );
    });
  }

for (const firstBinds of [true, false])
  test(`a lazy-row plan cannot borrow class ownership (firstBinds=${firstBinds})`, async () => {
    await withPage(
      {
        ...DERIVED_BUILD,
        "/": '<!doctype html><main><!--a--><div class="slide row-a is-snapped"></div><!--b--><div class="slide row-b is-snapped"></div><!--c--></main>',
        "/rows.js": `
        import { _adoptRow } from "/dom-adopt-run.ts";
        import { _tpl, _cls } from "/dom-v2.ts";
        const template = _tpl("<div></div>");
        const cache = {};
        const nodes = [...document.querySelector("main").childNodes];
        for (let i = 0; i < 2; i++) {
          _adoptRow(null, fn => fn(), () => {
            const el = template();
            // Like a placement ref: only the connected server node takes the new state.
            if (i || ${firstBinds}) _cls(el, el.isConnected ? "slide" : "slide row-" + (i ? "b" : "a"));
            return el;
          }, nodes[i * 2], nodes[i * 2 + 2], null, cache);
        }
      `,
      },
      async (page) => {
        await page.goto("http://rivet.test/");
        const result = await page.evaluate(async () => {
          const before = [...document.querySelectorAll("main > div")];
          const path = "/rows.js";
          await import(/* @vite-ignore */ path);
          return before.map((el, i) => ({ className: el.className, same: el === document.querySelectorAll("main > div")[i] }));
        });
        assert.deepEqual(result, [
          { className: firstBinds ? "slide is-snapped" : "slide row-a is-snapped", same: true },
          { className: "slide is-snapped", same: true },
        ]);
      },
    );
  });

for (const planned of [false, true])
  for (const next of ["", "next"]) {
    test(`adoption leaves unrelated live class bindings in control (planned=${planned}, next=${JSON.stringify(next)})`, async () => {
      await withPage(
        {
          ...DERIVED_BUILD,
          "/": '<!doctype html><aside class="active"></aside><main><!--a--><div></div><!--b--><div></div><!--c--></main>',
          "/outside.js": `
            import { _adoptRow } from "/dom-adopt-run.ts";
            import { _tpl, _cls, _fx } from "/dom-v2.ts";
            import { signal, _rootIn } from "/reactivity.mjs";
            const name = signal("active"), outside = document.querySelector("aside");
            _rootIn(null, () => _fx(() => _cls(outside, name())), {owner:null});
            const template = _tpl("<div></div>"), cache = {};
            const nodes = [...document.querySelector("main").childNodes];
            const count = ${planned ? 2 : 1};
            for (let i = 0; i < count; i++) {
              _adoptRow(null, fn => fn(), () => {
                const el = template();
                if (el.isConnected && i === count - 1) name.set(${JSON.stringify(next)});
                return el;
              }, nodes[i * 2], nodes[i * 2 + 2], null, cache);
            }
          `,
        },
        async (page) => {
          await page.goto("http://rivet.test/");
          const actual = await page.evaluate(async () => {
            const path = "/outside.js";
            await import(/* @vite-ignore */ path);
            return document.querySelector("aside")!.getAttribute("class");
          });
          assert.equal(actual, next || null);
        },
      );
    });
  }

test("an omitted spread class uses the template baseline even if a ref decorates the probe", async () => {
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": '<!doctype html><main><!--a--><div class="is-snapped"></div><!--b--></main>',
      "/probe-class.js": `
        import { _adoptRow } from "/dom-adopt-run.ts";
        import { _tpl, _spread } from "/dom-v2.ts";
        const template = _tpl("<div></div>");
        const nodes = [...document.querySelector("main").childNodes];
        _adoptRow(null, fn => fn(), () => {
          const el = template();
          _spread(el, {class: undefined});
          // A detached ref/directive can decorate the probe after the absent spread skipped its write.
          if (!el.isConnected) el.classList.add("is-snapped");
          return el;
        }, nodes[0], nodes[2]);
      `,
    },
    async (page) => {
      await page.goto("http://rivet.test/");
      const value = await page.evaluate(async () => {
        const path = "/probe-class.js";
        await import(/* @vite-ignore */ path);
        return document.querySelector("main > div")!.className;
      });
      assert.equal(value, "is-snapped");
    },
  );
});

for (const engine of ["chromium", "webkit"] as const)
  for (const next of ["client-new", "", undefined])
    for (const foreign of [false, true]) {
      const run = engine === "webkit" && !hasWebkit() ? test.skip : compiled;
      run(`value changed before adopt drops the old server token (${engine}, ${JSON.stringify(next)}, foreign=${foreign})`, async () => {
        const resume = { module: "src/classes.tsx", boundaries: ["ChangedParent", "ChangedChild"], independent: ["ChangedParent"] };
        const server = compile(source, { target: "server", filename: "classes.tsx", resume } as never);
        const dom = compile(source, { target: "dom", filename: "classes.tsx", resume } as never);
        assert.deepEqual(server.diagnostics, []);
        assert.deepEqual(dom.diagnostics, []);
        const { ChangedParent } = await importServer<{ ChangedParent: (props: { next: string | null; foreign: boolean }) => ServerValue }>(server.code);
        const html = await derivedToString(() => ChangedParent({ next: next ?? null, foreign }), {
          manifest: {
            hash: "t",
            runtime: "/rt.js",
            symbols: { "src/classes.tsx#ChangedParent": "/classes.js", "src/classes.tsx#ChangedChild": "/classes.js" },
          },
          preload: { lean: true },
        });
        await withPage(
          {
            ...DERIVED_BUILD,
            "/": '<!doctype html><meta charset="utf-8">' + html,
            "/rt.js": 'export { default } from "/dom-derived.ts";',
            "/classes.js": rewrite(dom.code),
          },
          async (page) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto("http://rivet.test/");
            await page.evaluate(() => {
              for (const id of ["changed-bound", "changed-spread", "changed-svg"]) {
                const el = document.getElementById(id)!;
                (el as Element & { original?: Element }).original = el;
              }
            });
            await page.focus("#changed-wake");
            await page.waitForFunction(() => document.getElementById("changed-wake")!.hasAttribute("data-ready"));
            await page.click("#changed-bound");
            await page.waitForFunction(() => document.getElementById("changed-bound")!.hasAttribute("data-clicked"));
            for (const id of ["changed-bound", "changed-spread", "changed-svg"]) {
              assert.equal((await page.getAttribute("#" + id, "class")) || "", [next, foreign ? "is-snapped" : ""].filter(Boolean).join(" "), id);
              assert.equal(await page.$eval("#" + id, (el) => (el as Element & { original?: Element }).original === el), true);
            }
            assert.deepEqual(errors, []);
          },
          { engine },
        );
      });
    }

test("later streamed snapshots capture new elements without claiming earlier plugin additions", async () => {
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": "<!doctype html><main><!--a--><div></div><!--b--></main>",
      "/stream-classes.js": `
    import { captureClasses, _adoptRow } from "/dom-adopt-run.ts";
    import { _tpl, _cls } from "/dom-v2.ts";
    captureClasses(document);
    document.querySelector("main > div").classList.add("is-snapped");
    const later = document.createElement("aside");
    later.innerHTML = '<!--a--><div class="server-old"></div><!--b-->';
    document.body.append(later);
    captureClasses(document);
    later.querySelector("div").classList.add("is-snapped");
    const template = _tpl("<div></div>");
    for (const parent of [document.querySelector("main"), later]) {
      const nodes = [...parent.childNodes];
      _adoptRow(null, fn => fn(), () => {
        const el = template();
        _cls(el, "client-new");
        return el;
      }, nodes[0], nodes[2]);
    }
  `,
    },
    async (page) => {
      await page.goto("http://rivet.test/");
      const values = await page.evaluate(async () => {
        const path = "/stream-classes.js";
        await import(/* @vite-ignore */ path);
        return [...document.querySelectorAll("main > div, aside > div")].map((el) => el.className);
      });
      assert.deepEqual(values, ["client-new is-snapped", "client-new is-snapped"]);
    },
  );
});
