// `form/behaviour.ts` onFormReset (RA useFormReset): a field that left its form is no longer reset by it, and its
// closure is dropped (was kept for the form's lifetime: dynamic field arrays / conditional fields).
import { installDom } from "./install-dom.ts";
installDom();
import { describe, expect, it } from "vitest";
import { onFormReset } from "../form/behaviour.ts";

describe("onFormReset", () => {
  it("drops fields removed from the form; a re-inserted field attaches again", () => {
    const form = document.createElement("form");
    const a = document.createElement("input");
    const b = document.createElement("input");
    form.append(a, b);
    document.body.append(form);
    const calls: string[] = [];
    const ownerA = {},
      ownerB = {};
    onFormReset(ownerA, a, () => calls.push("a"));
    onFormReset(ownerB, b, () => calls.push("b"));
    b.remove();
    form.reset();
    expect(calls).toEqual(["a"]);
    form.append(b);
    onFormReset(ownerB, b, () => calls.push("b2"));
    form.reset();
    expect(calls).toEqual(["a", "a", "b2"]);
    form.remove();
  });
});
