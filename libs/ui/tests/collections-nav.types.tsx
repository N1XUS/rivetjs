// Type-level suite (`tsc -p libs/ui` only): `Breadcrumbs` / `Toolbar` props (cdk props + variants + `class`), compound statics.
import { Breadcrumbs } from "../src/components/breadcrumbs/index.ts";
import { Toolbar } from "../src/components/toolbar/index.ts";

export const crumbs = () => (
  <Breadcrumbs isDisabled={false} separator={<span>/</span>} onAction={(k) => void k}>
    <Breadcrumbs.Item href="#a" onPress={() => {}} class="x">
      A
    </Breadcrumbs.Item>
    <Breadcrumbs.Item>B</Breadcrumbs.Item>
  </Breadcrumbs>
);

export const tools = () => (
  <Toolbar aria-label="t" orientation="vertical" isAttached>
    x
  </Toolbar>
);

const p: Toolbar["Props"] = { "aria-label": "x" };
const b: Breadcrumbs["ItemProps"] = { href: "#" };
void p;
void b;

// @ts-expect-error bad orientation
export const badOrientation = () => <Toolbar orientation="diagonal">x</Toolbar>;
