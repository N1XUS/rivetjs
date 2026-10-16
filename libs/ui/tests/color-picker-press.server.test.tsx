// Server-target regression: the ColorPicker root wraps its children (`ColorPicker.Trigger`) in `<div>{children}</div>` inside the cdk
// `DialogTrigger`; SSR in dev used to print "A PressResponder was rendered without a pressable child" for every picker (the trigger
// registers while the server serializes the div's slot hole). RA warns from a client effect only, so SSR stays silent.
import { afterEach, expect, test, vi } from "vitest";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ColorPicker } from "../src/components/color-picker/index.ts";
import { ColorSwatch } from "../src/components/color-swatch/index.ts";
import { Label } from "../src/components/label/index.ts";

const env = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = env;
  vi.restoreAllMocks();
});

test("color-picker SSR (dev): the trigger consumes the DialogTrigger press responder, no warning", async () => {
  process.env.NODE_ENV = "development";
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const html = await renderToString(() => (
    <ColorPicker defaultValue="#0485F7">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Pick a color</Label>
      </ColorPicker.Trigger>
    </ColorPicker>
  ));
  expect(html).toMatch(/data-slot="color-picker-trigger"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*data-slot="color-picker-trigger"/);
  expect(warn.mock.calls.filter((c) => String(c[0]).includes("PressResponder"))).toEqual([]);
});
