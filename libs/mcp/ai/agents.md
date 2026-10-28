# Rivet app: instructions for AI assistants

Read this before editing this project. Rivet looks like React / Solid JSX but is neither: the habits below are compile errors or silent bugs. When unsure, look the API up (MCP server or `llms.txt`, section 11) instead of guessing, and run `npm run check` after every change.

## 1. What Rivet is

Rivet is a compiled, resumable JSX framework. A Rust compiler turns `.tsx` into server HTML (streamed) and DOM templates. A component function renders **on the server**. The browser **resumes** an interactive boundary by running its ordinary compiled DOM function over the existing HTML on its first event, signal wake or client trigger, using the recorded signal values. The loader can fetch code ahead of use; client effects can also start boundaries without a user event. State is fine-grained signals (`@rivetjs/reactivity`). Routing is file-based (`@rivetjs/router`), i18n is compile-time (`@rivetjs/i18n`), forms are progressive (`@rivetjs/forms`), UI is `@rivetjs/ui` (styled compound components) on headless `@rivetjs/cdk`.

## 2. Differences from React / Solid

### Mental model

- No virtual DOM, no re-renders. A signal change updates only the text / attribute / row that reads it. No `useMemo`, `useCallback`, dependency arrays, or React hooks ordering rules. In resumable components, create per-item state in a child component rather than calling `signal()` / `createStore()` in a loop (RV2104).
- Component bodies run during SSR and again when their boundary resumes. Browser-global reads (`window`, `document`, `localStorage`) during server rendering are errors (RV2001). Keep browser-only work in handlers or client helpers; a body log can run on both sides.
- Do not branch rendered markup on `typeof window`: the two sides must render the same structure. Use a handler, `clientEffect`, `clientEvent` or `clientOnly` for browser-only work.

### JSX

- `class` (`className` also works; never both on one element). `for` (`htmlFor` also works). Some attrs are camelCase in types: `autoComplete`, `autoFocus`, `tabIndex`.
- Class object / array: `class={{ active: on() }}`, `class={["a", on() && "b"]}`; toggle one: `class:active={on()}`.
- `style` must be an object or `style:prop`. Style strings are compile errors (RV5003).
- Events: `on` + PascalCase from lib.dom (`onClick`, `onInput`, `onKeyDown`, `onFocusOut`). Lowercase `onclick` = error (RV1012). Text inputs: `onInput` (or `model:value`), not React's `onChange`.
- `window:onResize={fn}` / `document:onKeyDown={fn}` listen globally; `on:my-event={fn}` for custom events; `onClickCapture` for capture phase.
- Not supported: `dangerouslySetInnerHTML`, `innerHTML`, `srcdoc` (RV1101), `<script>` / `<style>` in JSX (RV1007), children spread `{...items}` (RV1002), `javascript:` / `data:` URLs.
- Handler value must be a function that does not read state when bound (RV1016):

```tsx
// Avoid: evaluated once at render
<button onClick={mode() === "a" ? onA : onB}>Go</button>
// Prefer
<button onClick={(e) => (mode() === "a" ? onA(e) : onB(e))}>Go</button>
```

- Two-way form binding: `<input model:value={name} />`, `<input type="checkbox" model:checked={agree} />`, also `<select model:value={choice}>`. The value must be a signal name/property.

### Signals (`@rivetjs/reactivity`)

```tsx
import { signal, computed, effect, batch, untrack, onCleanup } from "@rivetjs/reactivity";

const count = signal(0); // read: count()
count.set(5); // write
count.update((n) => n + 1); // derive from current
const double = computed(() => count() * 2); // no dependency list; read: double()
untrack(count); // read without subscribing (there is no .peek())
```

- Avoid `count(5)` (not a setter) and `count.value`.
- In an `effect` / `computed` / `clientEffect`, write from the current value with `update`: `count.set(count() + 1)` there subscribes the effect to its own write and re-runs it until the 10000-run cutoff (RV1017). In event handlers `count.set(count() + 1)` is fine (nothing tracks there).
- `computed` / `effect` must be synchronous (an async fn is a type error).
- Stores: `createStore`, `read` and `write` from `@rivetjs/reactivity/store`: `const state = createStore({ done: false })`, `read(state, "done")`, `write(state, "done", (done) => !done)`. Writes copy data; do not mutate a value returned by `read`.

### Effects, lifecycle, cleanup

- In components use `clientEffect` from `@rivetjs/runtime/dom`: recorded on the server, runs only in the browser, re-runs when its signals change. Return a function for cleanup.
- `effect` from `@rivetjs/reactivity` runs immediately where called, including during SSR and when the component resumes. Use `clientEffect` for browser-only work.
- `onCleanup(fn)` (reactivity) registers cleanup for the current effect / root; throws outside one.
- Options: `clientEffect(fn, { when: "idle" | "load" | "visible" | "interaction" | "media:(…)" })`. On derived pages, the default and `load` schedule idle adoption; `visible` observes the boundary's first element intersecting the viewport. `interaction` / `media:` adopt on the first event in the boundary, not on a media-query change. Once the boundary runs, the effect starts in a microtask.
- Async `clientEffect`: only signals read before the first `await` are tracked; returned cleanup works only from non-async effects.

```tsx
// Avoid (server-only run, document undefined → RV2001)
document.title = `${unread()} unread`;
// Prefer
clientEffect(() => {
  document.title = `${unread()} unread`;
});
```

- Browser listeners: `clientEvent(window, "resize", () => width.set(innerWidth))`.
- Browser-only libraries (maps, charts): `const MapView = clientOnly(() => import("../components/Map.tsx"), undefined, { fallback: () => <p>Loading…</p> });` — importer and selector must be inline.

### Props are live (Solid-style)

- `<Badge count={count()} />` passes a getter; the child sees updates when it reads `props.count` where it is shown.
- Destructuring reads once: a destructuring child never sees later values. Read `props.x`.
- Object spread `{ ...props }` / `Object.assign` reads every getter once; JSX spreads `<button {...props} />` stay live.
- Defaults / forwarding: `mergeProps`, `splitProps` from `@rivetjs/runtime/props`.
- `count={count}` passes the signal itself (child calls `props.count()` / writes it). Use for two-way props.
- Type `children` (and other JSX-holding props) as `Content`: `import type { Content } from "@rivetjs/runtime/jsx-runtime"`; `props: { title: string; children?: Content }`.
- A prop holding JSX (`icon={<Star />}`) creates new nodes on every read: read once, or pass a render function.

```tsx
// Avoid
export function Badge({ count }: { count: number }) {
  return <b>{count}</b>;
}
// Prefer
export function Badge(props: { count: number }) {
  return <b>{props.count}</b>;
}
```

### Control flow, lists (all from `@rivetjs/runtime/dom`, named imports only — no `rt.For`)

```tsx
import { For, Show, Switch, Match } from "@rivetjs/runtime/dom";

<For each={todos} by={(t) => t.id}>{(todo, index) => <li>{index() + 1}. {todo().text}</li>}</For>
<Show when={open()} fallback={<p>Closed</p>}>…</Show>
<Switch fallback={<p>None</p>}><Match when={a()}>A</Match><Match when={b()}>B</Match></Switch>
```

- `For`: `by` key is required; `item` and `index` are **accessors** (`todo()`, `index()`). Use for lists that change. `.map()` is fine for fixed data (loader data, constants).
- Conditionals: `cond() && <p />`, ternary, or `Show`. Always read the signal (`cond()`, not `cond`).
- Other helpers: `Async`, `resource` (async data as a signal: `const user = resource(() => id(), (id, info) => load(id, info.signal))`; keep it in one `const` in the component, not destructured; fetchers may be passed by name; read inside `Suspense` so the server waits), `Suspense`, `ErrorBoundary`, `Dynamic`, `Portal`, `Provider`, `lazyComponent`, `clientOnly`.
- A function child `{() => …}` re-runs when the signals its body reads change.

### Refs

```tsx
import { ref } from "@rivetjs/runtime/dom";
const input = ref<HTMLInputElement>();
<input ref={input} />; // input() → element | undefined (signal-backed)
let el!: HTMLCanvasElement;
<canvas ref={(e) => (el = e)} />; // or a callback
```

### Context

```tsx
// theme.ts
import { createContext, signal, type Signal } from "@rivetjs/reactivity";
export const ThemeContext = createContext<Signal<"light" | "dark">>(signal("light"));
// provider
import { Provider } from "@rivetjs/runtime/dom";
<Provider token={ThemeContext} value={theme}>
  …
</Provider>;
// reader: at the top of the component, never in a handler or after await
const theme = useContext(ThemeContext); // import { useContext } from "@rivetjs/reactivity"
```

- The provided value is read once: provide a signal for changing values.

## 3. Resumability rules

The server writes the HTML plus a short record per interactive component (it has a handler, reads a signal in its markup, or uses an effect): where it is, its signal values, its props when they are plain data. The first event, signal wake or client trigger runs the boundary's compiled DOM function over the existing HTML. Handlers, functions, service objects and JSX props have no capture-serialization rules: the browser reconstructs them when the component runs.

- Render the same thing on both sides: no `Date.now()` / `Math.random()` / `new Date()` / `crypto.randomUUID()` in a render (RV2103) — keep it in a signal (`signal(Date.now())`, the server value ships) or compute it in a handler / `clientEffect`. One signal per creation site: no `signal()` inside a loop (RV2104 warning). Browser globals only in handlers / `clientEffect` / `clientEvent` / `clientOnly` (RV2001).
- Keep signal/store values as plain JSON data (null, booleans, finite numbers, strings, arrays and plain objects). In this derived implementation a recorded non-JSON signal value is omitted; adoption uses its browser initializer and a structural mismatch falls back to browser rendering. Do not rely on it retaining server state. The richer resume-format encoding below applies to route data.
- Plain-data props can let the build make a component independent. Functions, services and JSX props are allowed; a component given non-data props adopts with its parent. There is no handler-capture restriction.
- Route loader/action data must be encodable (RV2107 runtime warning; the page renders on the server but cannot resume): no functions, symbols, promises, unregistered class instances. Resume-format data also supports `Date`, `Map`, `Set`, `URL`, `bigint` and typed arrays. Classes: `registerClass(Cls, { id, serialize, revive })` from `@rivetjs/runtime/resume-format`, imported on server and browser.
- Render a function child as `{props.children}` directly. `For each={xs}` with `by` for lists that change.
- `.ts` files are not server-rewritten: import `@rivetjs/runtime/dom` (`For`, `Show`, `clientEffect`, …) only from `.tsx` files, else the DOM runtime is bundled into SSR.
- With the default `resume.appModules: true`, project `.tsx` / `.jsx` files imported by routes need no registration (outside `node_modules` and within the project root).
- A component whose markup differs in the browser renders there instead of reusing the server nodes (dev prints a warning naming it).
- Playwright tests: the first trusted mouse click per document flushes DOM updates one task later. After a page's first `page.click`, wait (`expect(...).toHaveText` retries / `waitForFunction`), don't read the DOM synchronously.

## 4. File routes

```
src/
  document.ts            HTML shell (DocumentShell, headTags)
  styles.css             listed in rivetRouter({ styles })
  routes/
    _layout.tsx          wraps its folder and below
    index.tsx            /
    about.tsx            /about
    blog/[slug].tsx      /blog/:slug        → params.slug
    docs/[[lang]]/x.tsx  optional param
    files/[...path].tsx  rest param
    (marketing)/p.tsx    /p (group: no segment, shares a layout)
    api/time.ts          endpoint (exports onGet(…)/onPost(…)…, returns Response)
    _404.tsx  _error.tsx
```

- Files/folders starting with `_` (except `_layout`, `_404`, `_error`), `.`, `*.test.*`, `*.spec.*`, `*.d.ts` are ignored. `*.server.ts` = server-only module: browser code cannot use it (RV3008 in a route module's browser part); a page that imports one itself becomes a document route (full page load), a component, layout or error page that reaches one fails the build (RV3011).
- `.rivet/` is generated (route types `routes.d.ts`, editor manifest): never edit; `rivet sync` regenerates it.

### Page module exports

```tsx
import { redirect, notFound, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";

export const loader = load(async ({ params }: RequestEvent<"blog/[slug]">) => {
  const post = await findPost(params.slug);
  if (!post) throw notFound();
  return { post };
});

export const forms = actions({
  // <form method="post" action="?/comment">
  comment: async ({ request }: RequestEvent<"blog/[slug]">) => {
    const text = String((await request.formData()).get("text") ?? "");
    await saveComment(text);
    return redirect("/blog", 303);
  },
});

export const head = { title: "Post" }; // or ({ data, params, url }) => Head

export default function Post({ data, params }: PageProps<"blog/[slug]">) {
  return <h1>{data.post.title}</h1>;
}
```

- Server exports: `load(…)`, `actions(…)`, `guard(…)` (throw/return `redirect()`, `deny()`, `notFound()`, `error()`), `headers(…)`, `entries(…)` (prerender params), `prerender`, `onRequest(…)` / `onGet(…)` / `onPost(…)` …. `load(fn, { defer: true })` = the page streams without waiting: `data` is a `Deferred` handle, render it only through `<Async load={() => data}>` (layouts: `data()`) or `resource(() => data)`, never `data.field`; it cannot set headers / cookies. The compiler strips them (and code only they use) from the browser build.
- `event`: `request`, `url`, `params`, `locals`, `signal`, `cookies`, `setHeader`, `appendHeader`.
- Page props: `{ data, params, url }` — plain values. Layout props (`LayoutProps`): `data()`, `params()`, `url()` are **accessors**, plus `children`.

```tsx
// Avoid in a layout
<header>{data.user}</header>;
// Prefer
export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <>
      <header>{data().user}</header>
      {children}
    </>
  );
}
```

### Live pages

- `export const live = true` + `LivePageProps<typeof loader>`: `data` becomes an accessor (`data().customers`). Same-URL revalidation (a `@rivetjs/forms` submit, `invalidate()`, search-param change) updates `data` in place: the page is not re-rendered, signals (an open drawer, typed input, focus) survive. Use it for forms in drawers / dialogs.
- Don't copy `data()` into a signal (it never updates). Render lists with `<For each={data().items} by={…}>`.

### Links and navigation

- Plain `<a href="/about">` works; it uses client navigation when the page has the client router and document navigation otherwise. Typed: `import { Link } from "@rivetjs/router/link"`; `<Link to="/items/42">`.
- `import { navigate, invalidate, useSearchParams, setSearchParams, beforeLeave, actionResult } from "@rivetjs/router/client"`.
- Under a base path, plain anchors need `withBase("/x")` from `@rivetjs/router`.
- Never call `history.pushState` yourself: the router does not see it.

### Modes (`vite.config.ts`)

- `rivetRouter()` = `mode: "server"` (render per request; `npm run build` → `dist/server`, `npm start`).
- `rivetRouter({ mode: "static" })` = prerender to HTML files (`prerender.js` / `prerenderBuild`). `load(…)` runs at build time. A page with nothing to resume (no handlers, signals in markup, client effects, forms) ships zero JS and its links load documents (any mode: the client router is opt-in); `clientRouter: true` keeps in-place navigation on every page.
- `mode: "csr"` = SPA, no server code.

### Forms (`@rivetjs/forms`)

```ts
// src/forms/contact.ts
import { defineForm } from "@rivetjs/forms";
import { z } from "zod"; // any Standard Schema library
export const contactForm = defineForm({ name: "contact", schema: z.object({ email: z.string().email() }), validateOn: "blur" });
```

```tsx
// src/routes/contact.tsx
import { action, invalid } from "@rivetjs/forms/server";
import { actionResult } from "@rivetjs/router/client";
import { createForm, fieldId, formId, onInput, onBlur, onSubmit, defaultValue, isInvalid, describedBy } from "@rivetjs/forms";
import { FieldError, ErrorSummary } from "@rivetjs/forms/components";
import { actions } from "@rivetjs/router";

export const forms = actions({
  contact: action(contactForm, async (value) => {
    /* typed, valid */
  }),
});

export default function Contact() {
  const form = createForm(contactForm, { result: actionResult() });
  return (
    <form
      id={formId(form)}
      method="post"
      action="?/contact"
      onInput={(e) => onInput(contactForm, form, e)}
      onFocusOut={(e) => onBlur(contactForm, form, e)}
      onSubmit={(e) => onSubmit(contactForm, form, e)}
    >
      <label for={fieldId(form, "email")}>Email</label>
      <input
        id={fieldId(form, "email")}
        name="email"
        value={defaultValue(form, "email")}
        aria-invalid={isInvalid(form, "email")}
        aria-describedby={describedBy(form, "email")}
      />
      <FieldError of={form} name="email" />
      <button>Send</button>
    </form>
  );
}
```

- Works without JS (plain post, 400 re-render with messages). Server-side rejection: `return invalid({ email: "Taken" })`.
- A successful submit re-renders a normal page (its signals reset: a "thanks" flag set after `await onSubmit(…)` is lost). Keep client state across a submit with `export const live = true`.
- In an overlay: live page + `onSubmit={async (e) => (await onSubmit(def, form, e)) && open.set(false)}`.
- Keeping native `required`? Add `onInvalidCapture={(e) => onInvalid(def, form, e)}`.

## 5. i18n (`@rivetjs/i18n`)

- Compile-time: `t("key")` is replaced by the string for the locale being built; no runtime catalog. One client build per locale.
- `i18n.config.ts` (`locales`, `defaultLocale`, `catalogs: "locales/{locale}.json"`, `routing`); Vite: `plugins: [i18n(config), rivetRouter()]` — `i18n()` from `@rivetjs/i18n/vite`, **before** the router.
- Catalogs: JSON, nested keys → dotted, values ICU MessageFormat (`"Hello, {name}!"`, plural / select).
- Component strings (`@rivetjs/cdk` / `@rivetjs/ui` labels, date / number formats) ship every locale unless the app declares the ones it serves: `rivetRouter({ locales: ["en-US", "de-DE"] })` (default: `i18n()` `locales`). Declared, other languages load their strings on first use and may show `en-US` text until then: list every language you serve.

```tsx
import { t } from "@rivetjs/i18n";
<h1>{t("cart.title")}</h1>
<p>{t("cart.greeting", { name: props.name })}</p>
<p>{t("terms", { link: (c) => <a href="/terms">{c}</a> })}</p>
```

- Use a literal key and inline object params. A fixed-prefix template key such as ``t(`nav.${id}`)`` is also supported for plain-text messages without params. Unknown key RV4001, missing / extra param RV4002, bad args RV4003, tags in attributes RV4004.
- Server code outside rendering (emails in actions): `t.in("de", "cart.title")`. Never `String(t(…))` on the server.
- Current language: `locale()` from `@rivetjs/i18n` (call during render; loaders / actions: `event.locals.locale`). `t()` values work in attributes (`Picture alt`), route `head` and kit `<Title>` / `<Meta>`.
- Generated types: `src/rivet-i18n.d.ts` (do not edit). Locale URLs: `[[lang]]` route folder.

## 6. Styles

- Static, server and UI starters use Tailwind v4 (minimal has no styling tools): `src/styles.css` (`@import "tailwindcss"; @source "./**/*.{ts,tsx}";`), listed in `rivetRouter({ styles: ["src/styles.css"] })`, plus `tailwindcss()` Vite plugin. Write utilities in `class`.
- Scoped CSS (experimental): ``const styles = css`.card { … }` `` at module top level, `import { css, cx } from "@rivetjs/runtime/css"`; use `class={styles.card}`, combine with `cx(styles.card, on() && styles.selected, props.class)`.
- Dynamic values: `style={{ "--x": n(), marginTop: "1px" }}` or `style:color={c()}`; `data-*` attributes for state styling.

## 7. Icons (mandatory rule)

- Never hand-write SVG paths. Never use Unicode glyphs (✓ × → ★ …) as icons.
- Use lucide through Rivet's `Icon`:

```tsx
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";
<Icon icon={Check} size={16} class="text-success" />           // decorative (aria-hidden)
<Icon icon={Check} title="Done" />                              // accessible name
```

- Props: `icon` (lucide data), `size` (default 24), `color`, `strokeWidth`, `absoluteStrokeWidth`, `title`, any `<svg>` attribute. Requires `lucide` + `@rivetjs/kit` dependencies (starter-ui has both).

## 8. UI components

- `@rivetjs/ui`: styled compound components. Import per component subpath (`@rivetjs/ui/button`, `@rivetjs/ui/select`, `@rivetjs/ui/modal`, `@rivetjs/ui/card`, …); the root barrel exists, prefer subpaths. Styles: `@import "@rivetjs/ui/styles";` after Tailwind (tokens, base, utilities; other looks = `@rivetjs/ui/theme` presets); each component module brings its own stylesheet, never import component CSS by hand.
- Compound parts: `Card.Header`, `Select.Trigger`, `Modal.Content` …; wrapper parts with no own choice fold (`Modal.Content` = Backdrop + Container + Dialog + close button; `<Table aria-label columns items />` = ScrollContainer + Content + header + rows; explicit parts stay for custom layouts). Event props follow React Aria: `onPress` (not `onClick`), `onSelectionChange`, `onOpenChange`.
- Two-way props take a signal: `isOpen={open}`, `value={selected}`, `selectedKeys={keys}`.
- State props are live: `isDisabled={busy()}`, `isInvalid={!ok()}`, `variant={v()}`, a plain `value={v()}` (controlled) update in place, focus stays; attributes too (TextField `type={shown() ? "text" : "password"}`, `placeholder`, NumberField `step`, Button `type`). Read once ("Read once at mount" in the API docs): handlers, `id`, `name`, element-picking props (`elementType`, `orientation` of Separator), `autoFocus`, state options (`default*`, `selectionMode`, a collection's `disabledKeys`), MenuTrigger / DialogTrigger `trigger`: re-create with `<Show keyed>` to change them. Slider `minValue` / `maxValue` / `step` / `orientation` and Tabs `orientation` are live.

```tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

const open = signal(false);
<Button onPress={() => open.set(true)}>Open</Button>
<Modal.Content isOpen={open}>
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>…</Modal.Body>
  <Modal.Footer><Button slot="close">Close</Button></Modal.Footer>
</Modal.Content>
```

```tsx
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
<Select placeholder="Select one" value={state}>
  <Label>State</Label>
  <Select.Trigger>
    <Select.Value />
    <Select.Indicator />
  </Select.Trigger>
  <Select.Popover>
    <ListBox>
      <ListBox.Item id="ca" textValue="California">
        California
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  </Select.Popover>
</Select>;
```

- `@rivetjs/cdk`: headless 1:1 ports of React Aria / React Stately / RAC / Angular CDK, one subpath per module (`@rivetjs/cdk/select`, `@rivetjs/cdk/dialog`, `@rivetjs/cdk/overlay`, …). Unstyled: default `rv-*` classes + `data-*` state attributes. Overlays use a div layer in a portal (no native `<dialog>` / `popover`). Use it for custom-styled widgets; prefer `@rivetjs/ui` when its look fits.
- Animations: `@rivetjs/motion` (Motion / motion.dev API, peer `motion` 14.x, no React): `<Motion.div initial={…} animate={…} exit={…} whileHover={…} whilePress={…}>` (`whilePress`, not `whileTap`), `Presence` / `PresenceFor` from `/presence` (not `AnimatePresence`; cdk / ui overlays and kit `Transition` already are presences), `layout` / `layoutId` + `animateLayout(scope, update)` from `/layout` (layout animates inside `animateLayout`, not on every render), `createScroll` from `/scroll`, `createInView` from `/in-view`, and `prefersReducedMotion` from `/reduced-motion` return accessors. Entrances render final styles + CSS on the server (no JS); values Motion's mini engine cannot animate (`rotateX`, `pathLength`, …) are a dev error: use `animate` from `@rivetjs/motion/animate` in a handler or `clientEffect`. Gestures with physics (drag, flick, carousel, sheet) stay cdk `motion` (`@rivetjs/cdk/motion`); there is no `drag` prop.

## 9. Commands

| Script            | Templates  | Does                                                                               |
| ----------------- | ---------- | ---------------------------------------------------------------------------------- |
| `npm run dev`     | all        | Vite dev server (pages resumed; DevTools panel Alt+Shift+R)                        |
| `npm run build`   | all        | `vite build && vite build --ssr` (+ `node prerender.js` for static / ui / minimal) |
| `npm start`       | server     | `node serve.js` (`PORT`, `HOST`)                                                   |
| `npm run preview` | static, ui | serve `dist/client`                                                                |
| `npm run check`   | all        | `rivet sync && rivet-check && tsc`                                                 |

- Create: `npm create rivet@latest my-app -- --template static|server|ui|minimal --yes`.
- `rivet sync` (bin of `@rivetjs/router`): regenerates `.rivet/` (route types + `.rivet/editor.json`). Run on a fresh clone before `tsc`. `--quiet` hides status output; `--json` returns one result; `--verbose` includes error stacks. Exit 0 success, 1 failure, 2 usage error.
- `rivet-check` (bin of `@rivetjs/language-core`): compiler diagnostics for both targets + type-aware checks for every `.tsx` / `.jsx` of `tsconfig.json`. Flags: `-p <tsconfig|dir>` (repeatable), `--no-types`, `--no-manifest`, `--format text|json` / `--json`, `--quiet` (errors only; JSON keeps totals), `--verbose` (stacks; also `DEBUG=rivet`). Repeated warnings share one code/file report with a count; JSON retains their locations. Exit 0 clean (warnings ok), 1 errors/setup failure, 2 invalid arguments. Run it after every change and before reporting done. RV3101 (a link matching no route) stands down when `to` is typed with the generated route union: `tsc` (part of `npm run check`) reports TS2820 then.
- Editor: `@rivetjs/typescript-plugin` in `tsconfig.json` shows the same diagnostics + quick fixes while typing.
- Measure in a build (`npm run build` + start/preview), not dev.
- Tests (optional setup): `rivetTest()` from `@rivetjs/testing/vite`; `render`, `fire`, `flush` from `@rivetjs/runtime/testing`; `renderToString` from `@rivetjs/runtime/testing/server`.

## 10. RV diagnostic codes

- Format `RVnnnn`. Compiler errors fail the build; compiler warnings (RV2104: keyed state created in a loop) print and the module still compiles; the language service adds route-link warnings (RV3101).
- Where: Vite (terminal + overlay) as `[RV1016] src/x.tsx:12:8: message`; `rivet-check` as `file:line:col - error RV1016: message`; editor via the TS plugin. The MCP tool `explain_diagnostic("RV1016")` gives the meaning, the mechanical fix and an Avoid / Prefer pair; `check_code` returns the fix and the fixed source for a whole file.
- Ranges: 1xxx JSX / attributes, 2xxx resume, 3xxx imports / helpers / route modules, 4xxx i18n, 5xxx styles, 6xxx slots, 7xxx config, 9xxx internal.

| Code            | Meaning                                                                                             | Fix                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| RV1000          | Parse error                                                                                         | fix syntax                                                                |
| RV1005          | HTML nesting the parser would repair (`<div>` in `<p>`)                                             | valid nesting                                                             |
| RV1012          | Unknown native event (`onclick`, `onTransitionend`)                                                 | `on` + PascalCase                                                         |
| RV1015          | Handler is a literal, not a function                                                                | pass a function                                                           |
| RV1016          | Handler expression reads state when it binds                                                        | wrap in an arrow                                                          |
| RV1101          | Unsafe / unsupported attribute or URL (`innerHTML`, `javascript:`)                                  | remove; build-time assets                                                 |
| RV1102          | Invalid `preload` value                                                                             | `eager` / `idle` / `visible` / `intent` / `interaction`                   |
| RV2001          | Browser global read during server rendering                                                         | handler / `clientEffect` / `clientEvent` / `clientOnly`                   |
| RV2103 / RV2104 | resume modules: `Date.now()` / `Math.random()` while rendering / (warning) signal created in a loop | keyed `signal(Date.now())` or `clientEffect`; one signal outside the loop |
| RV2107          | (runtime warning) Route data not encodable (function, symbol, promise, unregistered class)          | plain data; `registerClass`                                               |
| RV3003 / RV3004 | Structural helper namespace import / alias                                                          | `import { For } from "@rivetjs/runtime/dom"`                              |
| RV3006          | `clientOnly` erasure shape                                                                          | inline `() => import("…")`                                                |
| RV3007          | Route module server export shape (`export *` in a route)                                            | declare server exports directly                                           |
| RV3008          | Server-only code reached from browser code                                                          | keep in `load(…)` / `*.server.ts`                                         |
| RV3011          | Server-only module reached from a component, layout or error page (router build)                    | pass it as props from the page's `load(…)`                                |
| RV3101          | (warning) Link matches no route                                                                     | fix the path                                                              |
| RV4001–4004     | i18n key / param / argument / tag errors                                                            | see section 5                                                             |
| RV5001–5003     | ``css`…` `` syntax / usage; invalid or unsafe class / style (style string, two class attrs)         | style object, one `class`                                                 |
| RV6001–6004     | Slot errors (`<slot>`, `r:name`, `r:slot`)                                                          | see JSX reference, slots                                                  |
| RV7101 / RV7102 | `.rivet/editor.json` missing / stale                                                                | `rivet sync`                                                              |
| RV9000 / RV9001 | Unclassified / internal compiler error                                                              | report it                                                                 |

## 11. Links

- MCP server `@rivetjs/mcp` (stdio, offline; docs of all three sites bundled): `npx -y @rivetjs/mcp`, or `npx rivet mcp` when installed in the app. Tools: `search_docs(query, site?)`, `get_doc(path)`, `list_components(package?)`, `get_component(name)` (import path, props / parts, example source), `check_code(code, filename?)`, `explain_diagnostic(code)`. Loop: look up → write → `check_code` → fix every RV error → `npm run check`.

```json
{ "mcpServers": { "rivet": { "command": "npx", "args": ["-y", "@rivetjs/mcp"] } } }
```

- Claude Code: `claude mcp add rivet -- npx -y @rivetjs/mcp`. Cursor: the JSON above in `.cursor/mcp.json`. VS Code: `.vscode/mcp.json` with `{ "servers": { "rivet": { "type": "stdio", "command": "npx", "args": ["-y", "@rivetjs/mcp"] } } }`.
- Docs for models: every Rivet docs site (framework, cdk, ui) serves `/llms.txt` (index), `/llms-full.txt` (every page, examples as source) and `<page>.md` next to each HTML page. Guide: "AI assistants" (`docs:/guides/tooling/ai/` in the MCP server).
- Skills (`.agents/skills/` for Codex/Cursor, `.claude/skills/` for Claude Code) and editor rules (`.cursor/rules/`, `.github/copilot-instructions.md`) in this project cover common tasks: UI/CDK design, add a route, form in a drawer, port a React component, page with `@rivetjs/ui` components, fix a resumability error. `rivet-ui-design` covers color roles, spacing, typography, structure, app layouts, composition and interactions; its references work without MCP. Portable bundles are distributed from the Rivet repository's `skills/` directory.

## Checklist before reporting done

- `npm run check` exits 0; `npm run build` passes.
- No destructured props in components that receive changing values; lists that change use `For` with `by`.
- No browser globals outside handlers / `clientEffect` / `clientEvent` / `clientOnly`.
- Icons only via `<Icon icon={…} />` + lucide.
- Never edit `.rivet/`, `src/rivet-i18n.d.ts` or other `Generated … Do not edit` files.
