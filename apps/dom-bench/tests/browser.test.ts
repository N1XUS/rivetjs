import { test } from "vitest";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "../server.ts";

test("production fixtures match HTML, independently update fields, handle clicks and dispose", async () => {
  const server = await startServer(),
    browser = await chromium.launch();
  try {
    let baseline: string | undefined;
    for (const framework of ["rivet", "react", "solid", "solid-stable"]) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${server.url}/${framework}`);
      await page.waitForFunction(() => window.bench);
      const result = await page.evaluate(() => {
        const host = document.querySelector("#host")!;
        window.bench.mount(10);
        const canonical = (node: Node): string =>
          node.nodeType === 8
            ? ""
            : node.nodeType === 3
              ? (node as Text).data
              : `<${(node as Element).localName}${[...(node as Element).attributes]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((a) => ` ${a.name}=${JSON.stringify(a.value)}`)
                  .join("")}>${[...node.childNodes].map(canonical).join("")}</${(node as Element).localName}>`;
        const html = canonical(host),
          elements = host.querySelectorAll("*").length;
        const before = [...host.querySelectorAll("[data-field]")].map((node) => [
          node,
          node.firstChild?.nodeType === 3 ? node.firstChild : [...node.childNodes].find((n) => n.nodeType === 3),
        ] as const);
        window.bench.update([0, 37, 99], 7);
        const values = [...host.querySelectorAll("[data-field]")].every(
          (node, index) => node.textContent === `value-${index}-${[0, 37, 99].includes(index) ? 7 : 0}`,
        );
        const stable = before.every(
          ([node, text], index) => node === host.querySelector(`[data-field="${index}"]`) && text?.parentNode === node,
        );
        host.querySelector<HTMLElement>('[data-action="0"]')!.click();
        const clicked = host.querySelector('[data-field="0"]')!.textContent === "value-0-8";
        window.bench.dispose();
        window.bench.dispose();
        const empty = host.childNodes.length === 0;
        window.bench.mount(1);
        const reset = host.querySelector('[data-field="0"]')!.textContent === "value-0-0";
        window.bench.dispose();
        return { html, elements, values, stable, clicked, empty, reset };
      });
      assert.equal(result.elements, 571, framework);
      for (const key of ["values", "stable", "clicked", "empty", "reset"])
        assert.equal(result[key as keyof typeof result], true, `${framework} ${key}`);
      if (baseline) assert.equal(result.html, baseline, `${framework} same native tree`);
      else baseline = result.html;
      assert.deepEqual(errors, [], framework);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
