import { signal } from "@rivetjs/reactivity";
import { Link, RouterProvider, type PressEvent } from "@rivetjs/cdk/link";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Group } from "@rivetjs/cdk/group";
import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Links, breadcrumbs, groups, toolbars" };

const crumbs = [
  { id: "home", label: "Home", href: "#home" },
  { id: "docs", label: "Docs", href: "#docs" },
  { id: "page", label: "Breadcrumbs", href: "#page" },
];
type Crumb = (typeof crumbs)[number];

export default function LinksStory() {
  const log = signal<string[]>([]);
  const nav = signal("");
  const action = signal("");
  const add = (e: PressEvent) => log.update((l) => [...l, `${e.type}:${e.pointerType}`]);
  return (
    <section>
      <h2>Link</h2>
      <p>
        <Link id="plain" href="#plain-target">
          Plain link
        </Link>{" "}
        <Link id="pressable" onPress={(e) => add(e)} onPressStart={(e) => add(e)} onPressEnd={(e) => add(e)} onClick={() => log.update((l) => [...l, "click"])}>
          Span link
        </Link>{" "}
        <Link id="off" href="#off-target" isDisabled onPress={(e) => add(e)}>
          Disabled link
        </Link>{" "}
        <Link id="current" href="#current" aria-current="page">
          Current
        </Link>
      </p>
      <p id="link-log">{log().join(" ")}</p>
      <RouterProvider navigate={(href, options) => nav.set(href + " " + JSON.stringify(options ?? null))} useHref={(href) => "/base" + href}>
        {() => (
          <p>
            <Link id="routed" href="/foo" routerOptions={{ foo: "bar" }}>
              Routed
            </Link>{" "}
            <Link id="routed-off" href="/foo" isDisabled>
              Routed disabled
            </Link>{" "}
            <Link id="routed-blank" href="/foo" target="_blank">
              Routed new tab
            </Link>
          </p>
        )}
      </RouterProvider>
      <p id="nav-log">{nav()}</p>

      <h2>Breadcrumbs</h2>
      <Breadcrumbs id="crumbs">
        <Breadcrumb id="home">
          <Link href="#home">Home</Link>
        </Breadcrumb>
        <Breadcrumb id="docs">
          <Link href="#docs">Docs</Link>
        </Breadcrumb>
        <Breadcrumb id="page">
          <Link href="#page">Breadcrumbs</Link>
        </Breadcrumb>
      </Breadcrumbs>
      <Breadcrumbs id="crumbs-action" aria-label="Trail" items={crumbs} onAction={(key) => action.set(String(key))}>
        {(item: Crumb) => (
          <Breadcrumb>
            <Link href={item.href}>{item.label}</Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
      <Breadcrumbs id="crumbs-off" items={crumbs} isDisabled>
        {(item: Crumb) => (
          <Breadcrumb>
            <Link href={item.href}>{item.label}</Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
      <Breadcrumbs id="crumbs-slot" items={crumbs}>
        {(item: Crumb) => (
          <Breadcrumb>
            <Link href={item.href} class={({ isCurrent }) => (isCurrent() ? "crumb current" : "crumb")}>
              {item.label}
            </Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
      {/* Fixed height: an empty <p> collapses, so the first action text would move the Group under a resting pointer (fuzz COLD_HOVER false positive). */}
      <p id="crumb-action" style={{ minHeight: "1.5em" }}>
        {action()}
      </p>

      <h2>Group</h2>
      <Group id="group" aria-label="Search" onHoverChange={(h) => action.set("hover:" + h)}>
        <input id="group-input" aria-label="Query" />
        <button type="button" id="group-button">
          Go
        </button>
      </Group>
      <Group id="group-off" isDisabled isInvalid isReadOnly role="region" aria-label="Off">
        x
      </Group>

      <h2>Toolbar</h2>
      <button type="button" id="before">
        Before
      </button>
      <Toolbar id="tools" aria-label="Tools">
        <Toolbar aria-label="Align text">
          <button type="button" id="align-left">
            Align left
          </button>
          <button type="button" id="align-center">
            Align center
          </button>
          <button type="button" id="align-right">
            Align right
          </button>
        </Toolbar>
        <hr />
        <Group aria-label="Zoom">
          <button type="button" id="zoom-in">
            Zoom in
          </button>
          <button type="button" id="zoom-out">
            Zoom out
          </button>
        </Group>
      </Toolbar>
      <button type="button" id="after">
        After
      </button>
      <Toolbar id="vtools" aria-label="Vertical" orientation="vertical">
        <button type="button" id="v1">
          One
        </button>
        <button type="button" id="v2">
          Two
        </button>
      </Toolbar>
      <div dir="rtl">
        <Toolbar id="rtools" aria-label="RTL">
          <button type="button" id="r1">
            One
          </button>
          <button type="button" id="r2">
            Two
          </button>
        </Toolbar>
      </div>
    </section>
  );
}
