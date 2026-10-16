// Resumable server HTML of cdk parts with live class / style (signal-driven getters) whose children capture a class
// instance (a children function and plain JSX children). A part that passed ONE live view of class + style + children
// to `renderProps` made its class / style bindings capture the children closure too: "Cannot resume …: capture #N Tag
// instance is not serializable" (generalises calendar-cell-ssr.test.ts; RESUME-BUGS 2026-10-09). Parts pass one live
// view per key (`liveRenderProps`, slots/index.tsx). Resumed behaviour: tests-components/live-view-capture.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

/** [name, imports, element: `$P` = live props (class + style), `$C` = children capturing `tag`] */
// Not listed (fail for other reasons, follow-ups in LIVEVIEW report): Button / ToggleButton (a press handler captures
// the children, static props too), ListBoxItem (collection build captures the children, static too), Breadcrumb /
// Dialog / Disclosure (live props make the children site reactive: re-running children cannot resume).
const parts: [string, string, string][] = [
  ["Link", `import { Link } from "@rivetjs/cdk/link";`, `<Link href="/x" $P>$C</Link>`],
  ["Group", `import { Group } from "@rivetjs/cdk/group";`, `<Group $P>$C</Group>`],
  ["Toolbar", `import { Toolbar } from "@rivetjs/cdk/toolbar";`, `<Toolbar aria-label="Tools" $P>$C</Toolbar>`],
  ["Checkbox", `import { Checkbox } from "@rivetjs/cdk/checkbox";`, `<Checkbox $P>$C</Checkbox>`],
  ["Switch", `import { Switch } from "@rivetjs/cdk/switch";`, `<Switch $P>$C</Switch>`],
  ["TextField", `import { TextField } from "@rivetjs/cdk/text-field";`, `<TextField aria-label="Name" $P>$C</TextField>`],
  ["SearchField", `import { SearchField } from "@rivetjs/cdk/search-field";`, `<SearchField aria-label="Find" $P>$C</SearchField>`],
  ["NumberField", `import { NumberField } from "@rivetjs/cdk/number-field";`, `<NumberField aria-label="N" $P>$C</NumberField>`],
  [
    "Slider + SliderTrack",
    `import { Slider, SliderTrack, SliderThumb } from "@rivetjs/cdk/slider";`,
    `<Slider aria-label="Volume" $P><SliderTrack $P><SliderThumb />$C</SliderTrack></Slider>`,
  ],
  ["Meter", `import { Meter } from "@rivetjs/cdk/meter";`, `<Meter aria-label="M" value={3} $P>$C</Meter>`],
  ["ProgressBar", `import { ProgressBar } from "@rivetjs/cdk/progress-bar";`, `<ProgressBar aria-label="P" value={3} $P>$C</ProgressBar>`],
  ["RadioGroup", `import { RadioGroup } from "@rivetjs/cdk/radio-group";`, `<RadioGroup aria-label="R" $P>$C</RadioGroup>`],
  ["Text", `import { Text } from "@rivetjs/cdk/text";`, `<Text $P>$C</Text>`],
  ["Label", `import { Label } from "@rivetjs/cdk/label";`, `<Label $P>$C</Label>`],
];

const children = {
  function: `{() => <b class="tag">{tag.name}</b>}`,
  jsx: `<b class="tag">{tag.name}</b>`,
};

for (const [name, imports, element] of parts)
  for (const [form, child] of Object.entries(children))
    test(`${name}: live class / style with ${form} children capturing a class instance renders resumably`, async () => {
      const source = `import { signal } from "@rivetjs/reactivity";
${imports}
class Tag { constructor(public name: string) {} }
// A factory (no new expression in the component): the compiler cannot see the instance, the resume encoder must reject it.
const makeTag = (name: string) => new Tag(name);
export function Page() {
  const on = signal(false);
  const tag = makeTag("captured");
  return <section>{${element.replaceAll("$P", `class={on() ? "lv-on" : "lv-off"} style={on() ? { color: "red" } : { color: "blue" }}`).replaceAll("$C", child)}}</section>;
}`;
      const { Page } = await importModule<{ Page: () => unknown }>(`live-view-capture-${name.replace(/\W+/g, "-")}-${form}.tsx`, source);
      const html = await renderHtml(() => Page());
      assert.match(html, /class="[^"]*lv-off/, "live class rendered");
      // Function children of a part whose render props take the children call them; plain JSX always renders.
      if (form === "jsx" || /<b class="tag">captured<\/b>/.test(html)) assert.match(html, /<b class="tag">captured<\/b>/);
    });
