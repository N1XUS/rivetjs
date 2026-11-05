# Rivet app: instructions for AI assistants

This app uses **Rivet**, a compiled, resumable JSX framework. It looks like React / Solid but is neither: React habits are compile errors or silent bugs. Read the first section before you edit anything.

## 0. Start here

1. **Look APIs up, never guess.** Do not read `node_modules` sources to learn an API. From the app directory (offline, all three docs sites bundled):

   ```sh
   npx -y @rivetjs/mcp component Drawer        # import path, parts, props, example source (ui / cdk / kit)
   npx -y @rivetjs/mcp search form in drawer   # ranked doc ids
   npx -y @rivetjs/mcp doc ui:/components/drawer/
   npx -y @rivetjs/mcp check src/routes/index.tsx   # RV diagnostics + the fix for each
   npx -y @rivetjs/mcp explain RV2001
   ```

   Same tools as the Rivet MCP server (`search_docs`, `get_doc`, `get_component`, `list_components`, `check_code`, `explain_diagnostic`) when it is configured (section 10). Online: `https://rivetjs.severyn.pro/llms.txt` (framework), `https://ui.rivetjs.severyn.pro/llms.txt` (`@rivetjs/ui`), `https://cdk.rivetjs.severyn.pro/llms.txt` (headless `@rivetjs/cdk`); every page also has a `.md` form (`https://ui.rivetjs.severyn.pro/components/drawer.md`).

2. **Use the project skills** for their tasks (`.claude/skills/`, `.agents/skills/`): `rivet-add-route`, `rivet-add-ui-page`, `rivet-form-in-drawer`, `rivet-port-react-component`, `rivet-fix-resumability-error`, `rivet-ui-design`.
3. **In an app with `@rivetjs/ui` (the `ui` starter), build UI from its components**: `Button`, `TextField` + `Input`, `Select`, `Modal` / `AlertDialog` / `Drawer`, `Table`, `Card`, `Switch`, `Tabs` … (section 8). Never hand-roll a dialog (`role="dialog"`, `<dialog>`), a select or a switch from raw HTML there.
4. **Icons: lucide via `<Icon icon={Trash2} />` from `@rivetjs/kit/icon`.** Never hand-write `<svg>` / `<path d=…>`, never use Unicode glyphs (✓ × → ★ …) as icons.
5. **Done = `npm run check` exits 0 and `npm run build` passes.** Run `npm run check` after every change and fix every `RVnnnn` and TS error (`npx -y @rivetjs/mcp explain RVnnnn` gives the fix).

### React → Rivet

| React habit                                     | Rivet                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `const [n, setN] = useState(0)`                 | `const n = signal(0)`; `n()`, `n.set(1)`, `n.update((v) => v + 1)`   |
| `useMemo(() => a * 2, [a])`                     | `computed(() => a() * 2)`, no dependency list                        |
| `useEffect(() => …, [x])`                       | `clientEffect(() => …)` (`@rivetjs/runtime/dom`), no dependency list |
| `useRef`                                        | `ref<HTMLInputElement>()` (`@rivetjs/runtime/dom`)                   |
| `useContext` / `<Ctx.Provider>`                 | `useContext(Ctx)` / `<Provider token={Ctx} value={…}>`               |
| `items.map((i) => <li key={i.id}>…)` (changing) | `<For each={items} by={(i) => i.id}>{(item) => …item().name…}</For>` |
| `function C({ value })` (destructured props)    | `function C(props: { value: number })`, read `props.value` (live)    |
| `<input value={v} onChange={…}>`                | `<input model:value={v} />` or `onInput` (`onChange` fires on blur)  |
| `className`, `style="…"`, `onclick`             | `class`, `style={{ … }}`, `onClick` (PascalCase events)              |
| UI library `<Button onClick>`                   | `@rivetjs/ui` `<Button onPress={…}>` (React Aria events)             |
| `<Dialog open={o} onOpenChange={setO}>`         | `<Modal.Content isOpen={open}>`: the **signal itself** (two-way)     |
| `disabled` on a ui component                    | `isDisabled` (also `isInvalid`, `isRequired`, `isSelected`)          |
| `typeof window` branches in render              | same markup on both sides; browser work in handlers / `clientEffect` |
| `dangerouslySetInnerHTML`                       | not supported (RV1101)                                               |

## 1. What Rivet is

A compiler turns `.tsx` into streamed server HTML and DOM templates. Components render **on the server**; the browser **resumes** an interactive component by running its compiled DOM function over the existing HTML on its first event, with the recorded signal values. Packages: signals `@rivetjs/reactivity`, file routes `@rivetjs/router`, i18n `@rivetjs/i18n`, forms `@rivetjs/forms`, styled UI `@rivetjs/ui` on headless `@rivetjs/cdk`.

## 2. Components, JSX, signals

### Mental model

- No virtual DOM, no re-renders: a signal change updates only what reads it. A component body runs once per side (server render, browser resume): browser globals (`window`, `document`, `localStorage`) there are errors (RV2001); use a handler, `clientEffect`, `clientEvent` or `clientOnly`.
- In resumable components create per-item state in a child component, not `signal()` / `createStore()` in a loop (RV2104).

### JSX

- `class` (`className` also works; never both). `for` (`htmlFor` also works). Typed camelCase attrs: `autoComplete`, `autoFocus`, `tabIndex`.
- Class object / array: `class={{ active: on() }}`, `class={["a", on() && "b"]}`; one toggle: `class:active={on()}`.
- `style` is an object or `style:prop={…}`; style strings are errors (RV5003).
- Events: `on` + PascalCase (`onClick`, `onInput`, `onKeyDown`, `onFocusOut`); lowercase `onclick` = RV1012. `window:onResize={fn}`, `document:onKeyDown={fn}`, `on:my-event={fn}`, `onClickCapture`.
- Not supported: `dangerouslySetInnerHTML`, `innerHTML`, `srcdoc` (RV1101), `<script>` / `<style>` in JSX (RV1007), children spread `{...items}` (RV1002), `javascript:` / `data:` URLs, `key`.
- A handler must be a function that does not read state when it binds (RV1016): `onClick={(e) => (mode() === "a" ? onA(e) : onB(e))}`, not `onClick={mode() === "a" ? onA : onB}`.
- Two-way binding: `<input model:value={name} />`, `<input type="checkbox" model:checked={agree} />`, `<select model:value={choice}>` (a signal name / property).

### Signals (`@rivetjs/reactivity`)

```tsx
import { signal, computed, effect, batch, untrack, onCleanup } from "@rivetjs/reactivity";

const count = signal(0); // read: count()
count.set(5);
count.update((n) => n + 1);
const double = computed(() => count() * 2); // read: double()
untrack(count); // read without subscribing (no .peek())
```

- Not `count(5)` (not a setter), not `count.value`.
- In an `effect` / `computed` / `clientEffect` write from the current value with `update`; `count.set(count() + 1)` there re-runs itself until the cutoff (RV1017). In handlers `set(count() + 1)` is fine.
- `computed` / `effect` are synchronous.
- Stores: `createStore`, `read`, `write` from `@rivetjs/reactivity/store` (`write(state, "done", (d) => !d)`); do not mutate a value returned by `read`.

### Effects, lifecycle

- `clientEffect(fn, { when?: "idle" | "load" | "visible" | "interaction" | "media:(…)" })` from `@rivetjs/runtime/dom`: recorded on the server, runs only in the browser, re-runs when its signals change; return a cleanup function. Async: only signals read before the first `await` track.
- `effect` (reactivity) runs where called, also during SSR. `onCleanup(fn)` registers cleanup for the current effect / root.
- Browser listeners: `clientEvent(window, "resize", () => width.set(innerWidth))`. Timers: `clientEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); })`.
- Browser-only libraries: `const MapView = clientOnly(() => import("../components/Map.tsx"), undefined, { fallback: () => <p>Loading…</p> });` (inline importer).

```tsx
// Avoid (runs on the server: document is undefined → RV2001)
document.title = `${unread()} unread`;
// Prefer
clientEffect(() => {
  document.title = `${unread()} unread`;
});
```

### Props are live (Solid-style)

- `<Badge count={count()} />` passes a getter: the child sees updates when it reads `props.count` where it is shown. Destructuring reads once (a destructuring child never updates). Object spread `{ ...props }` reads every getter once; JSX spread `<button {...props} />` stays live.
- `count={count}` passes the signal itself (the child calls `props.count()` / writes it): two-way props.
- `mergeProps`, `splitProps` from `@rivetjs/runtime/props`. Type JSX props as `Content` (`import type { Content } from "@rivetjs/runtime/jsx-runtime"`).
- A prop holding JSX (`icon={<Star />}`) creates new nodes on every read: read once or pass a render function.

### Control flow, lists (`@rivetjs/runtime/dom`, named imports only)

```tsx
import { For, Show, Switch, Match } from "@rivetjs/runtime/dom";

<For each={todos} by={(t) => t.id}>{(todo, index) => <li>{index() + 1}. {todo().text}</li>}</For>
<Show when={open()} fallback={<p>Closed</p>}>…</Show>
<Switch fallback={<p>None</p>}><Match when={a()}>A</Match><Match when={b()}>B</Match></Switch>
```

- `For`: `by` is required; `item` / `index` are **accessors**: `todo().text`. `todo.name` / `todo.length` compile (functions have them) but are wrong. `.map()` is fine for fixed data (loader data, constants).
- Conditionals: `cond() && <p />`, ternary or `Show`; always call the signal (`cond()`).
- Also: `Async`, `resource` (async data as a signal; read inside `Suspense`), `Suspense`, `ErrorBoundary`, `Dynamic`, `Portal`, `Provider`, `lazyComponent`, `clientOnly`. A function child `{() => …}` re-runs when what it reads changes.

### Refs and context

```tsx
import { ref, Provider } from "@rivetjs/runtime/dom";
import { createContext, useContext, signal, type Signal } from "@rivetjs/reactivity";
const input = ref<HTMLInputElement>(); // <input ref={input} />; input() → element | undefined
export const ThemeContext = createContext<Signal<"light" | "dark">>(signal("light"));
// <Provider token={ThemeContext} value={theme}>…</Provider>; reader: const theme = useContext(ThemeContext) at the top of a component
```

The provided value is read once: provide a signal for changing values.

## 3. Resumability rules

The server writes the HTML plus a record per interactive component (it has a handler, reads a signal in its markup, or uses an effect): where it is and its signal values. Handlers, functions, services and JSX props need not serialize: the browser rebuilds them when the component runs.

- Render the same thing on both sides: no `Date.now()` / `Math.random()` / `new Date()` / `crypto.randomUUID()` in a render (RV2103): keep it in a signal (`signal(Date.now())` ships the server value) or compute it in a handler / `clientEffect`. A component whose markup differs in the browser renders there instead (dev warning).
- Signal / store values: plain JSON data. Route loader / action data must be resume-format encodable (RV2107 runtime warning): also `Date`, `Map`, `Set`, `URL`, `bigint`, typed arrays; classes via `registerClass(Cls, { id, serialize, revive })` from `@rivetjs/runtime/resume-format`.
- `.ts` files are not server-rewritten: import `@rivetjs/runtime/dom` only from `.tsx` files.
- Project `.tsx` files imported by routes resume without registration (`resume.appModules`, default).

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

- `_`-prefixed files / folders (except `_layout`, `_404`, `_error`), `.`, `*.test.*`, `*.spec.*`, `*.d.ts` are ignored. `*.server.ts` = server-only module (RV3008 from browser code; RV3011 from a component / layout: pass data as props from the page's `load(…)`).
- `.rivet/` is generated (`rivet sync`): never edit.

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

- Server exports: `load(…)`, `actions(…)`, `guard(…)` (throw / return `redirect()`, `deny()`, `notFound()`, `error()`), `headers(…)`, `entries(…)` (prerender params), `prerender`, `onRequest(…)` / `onGet(…)` / `onPost(…)`. `load(fn, { defer: true })` streams: `data` is a `Deferred`, render it only via `<Async load={() => data}>` or `resource(() => data)`. The compiler strips server exports from the browser build.
- `event`: `request`, `url`, `params`, `locals`, `cookies`, `setHeader`.
- Page props `{ data, params, url }` are plain values. Layout props (`LayoutProps<typeof loader>`): `data()`, `params()`, `url()` are **accessors**, plus `children`.

### Live pages

- `export const live = true` + `LivePageProps<typeof loader>`: `data` is an accessor (`data().customers`); same-URL revalidation (a `@rivetjs/forms` submit, `invalidate()`, a search-param change) updates it in place and signals survive (open drawer, typed input). Use it for forms in drawers / dialogs.
- Never copy `data()` into a signal (it never updates). Render lists with `<For each={data().items} by={…}>`.
- `export const fill = true` (page or layout): the page root takes the layout's whole content area.

### Links and navigation

- Plain `<a href="/about">` works; typed `Link` from `@rivetjs/router/link`. `navigate`, `invalidate`, `useSearchParams`, `setSearchParams`, `actionResult` from `@rivetjs/router/client`; never `history.pushState`.

### Modes (`vite.config.ts`)

- `rivetRouter()` = `mode: "server"` (`npm start` serves `dist/server`). `mode: "static"` prerenders HTML files (`load(…)` runs at build time). `mode: "csr"` = SPA. A page with nothing to resume ships zero JS.

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
import { FieldError } from "@rivetjs/forms/components";
import { actions } from "@rivetjs/router";

export const forms = actions({
  contact: action(contactForm, async (value) => {
    /* typed, valid; reject with: return invalid({ email: "Taken" }) */
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

- Works without JS (plain post, 400 re-render with messages). Error element id = `<field id>-error`.
- A successful submit re-renders a normal page (signals reset); keep client state with `export const live = true`. In an overlay: live page + `onSubmit={async (e) => (await onSubmit(def, form, e)) && open.set(false)}` (skill `rivet-form-in-drawer`).
- Keeping native `required`? Add `onInvalidCapture={(e) => onInvalid(def, form, e)}`.

## 5. i18n (`@rivetjs/i18n`)

- Compile-time: `t("key")` is replaced per built locale. `i18n.config.ts` (`locales`, `defaultLocale`, `catalogs`); Vite `plugins: [i18n(config), rivetRouter()]` (`@rivetjs/i18n/vite`). Catalogs: JSON, ICU.
- `t("cart.greeting", { name: props.name })`, rich text `t("terms", { link: (c) => <a href="/terms">{c}</a> })`. Literal keys (a fixed-prefix template key works for plain text). Errors RV4001–RV4004. Server code outside rendering: `t.in("de", "key")`. Current language: `locale()`.
- Declare the served languages for component strings: `rivetRouter({ locales: ["en-US", "de-DE"] })`. Generated `src/rivet-i18n.d.ts`: do not edit.

## 6. Styles

- Starters use Tailwind v4: `src/styles.css` (`@import "tailwindcss"; @source "./**/*.{ts,tsx}";`, then `@import "@rivetjs/ui/styles";` in the ui starter), listed in `rivetRouter({ styles: ["src/styles.css"] })`. Write utilities in `class`. UI theme tokens: `bg-surface`, `text-muted`, `text-accent`, `text-danger` … (skill `rivet-ui-design`).
- Scoped CSS (experimental): ``const styles = css`.card { … }` `` (`css`, `cx` from `@rivetjs/runtime/css`). Dynamic values: `style={{ "--x": n() }}`, `style:color={c()}`, `data-*` for state.

## 7. Icons (mandatory)

```tsx
import { Icon } from "@rivetjs/kit/icon";
import { Check, Trash2 } from "lucide";
<Icon icon={Check} size={16} class="text-success" />   // decorative (aria-hidden)
<Icon icon={Check} title="Done" />                      // accessible name
<Button isIconOnly aria-label="Delete notes.txt" onPress={remove}><Icon icon={Trash2} /></Button>
```

Props: `icon` (lucide data), `size` (24), `color`, `strokeWidth`, `absoluteStrokeWidth`, `title`, any `<svg>` attribute. Needs `lucide` + `@rivetjs/kit` (the ui starter has both).

## 8. UI components (`@rivetjs/ui`)

- One subpath per component: `import { Select } from "@rivetjs/ui/select"`. Styles: `@import "@rivetjs/ui/styles";` after Tailwind; each component brings its own CSS. Before using one, run `npx -y @rivetjs/mcp component <Name>` (or `get_component`): its docs examples are the shape to copy.
- Subpaths: {{ui-components}}.
- Names that differ from other libraries: dialog = `modal` / `alert-dialog`, side panel = `drawer` / `sheet`, text input = `textfield` + `input` (also `textarea`, `search-field`, `number-field`), dropdown menu = `dropdown` / `menu`, toggle = `switch`, notifications = `toast`, data table = `table` (`data-grid` for editing).
- Compound parts: `Card.Header`, `Select.Trigger`, `Modal.Content` …; wrapper parts fold (`Modal.Content` = backdrop + container + dialog + close button; `<Table aria-label="…">` wraps `Table.Header` / `Table.Body` in its scroll container and content).
- Events follow React Aria: `onPress` (not `onClick`), `onSelectionChange`, `onOpenChange`, `onChange(value)` (a value, not an event). Boolean state: `isDisabled`, `isInvalid`, `isRequired`, `isSelected`.
- **Two-way props take the signal itself**: `isOpen={open}`, `value={selected}`, `selectedKeys={keys}`, `isSelected={on}`. Live state props: `isDisabled={busy()}`. Read once: handlers, `id`, `name`, `default*`, `selectionMode` (re-create with `<Show keyed>` to change them).

```tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";
import { TextField } from "@rivetjs/ui/textfield";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Select } from "@rivetjs/ui/select";
import { ListBox } from "@rivetjs/ui/list-box";
import { Table } from "@rivetjs/ui/table";

const open = signal(false);
const name = signal("");
const plan = signal<string | number | null>(null);
const rows = signal([{ id: 1, name: "Ada" }]);

<Button onPress={() => open.set(true)}>Open</Button>
<Modal.Content isOpen={open}>
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>
    <TextField value={name}>
      <Label>Name</Label>
      <Input id="name" />
    </TextField>
  </Modal.Body>
  <Modal.Footer><Button slot="close">Close</Button></Modal.Footer>
</Modal.Content>

<Select placeholder="Choose a plan" value={plan}>
  <Label>Plan</Label>
  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
  <Select.Popover>
    <ListBox>
      <ListBox.Item id="pro" textValue="Pro">Pro<ListBox.ItemIndicator /></ListBox.Item>
    </ListBox>
  </Select.Popover>
</Select>

<Table aria-label="People">
  <Table.Header><Table.Column isRowHeader>Name</Table.Column></Table.Header>
  <Table.Body items={rows}>
    {(row: { id: number; name: string }) => <Table.Row id={row.id}><Table.Cell>{row.name}</Table.Cell></Table.Row>}
  </Table.Body>
</Table>
```

- `Drawer.Content isOpen={open} placement="right"` (parts `Drawer.Header` / `Heading` / `Body` / `Footer`); `AlertDialog.Backdrop isOpen={open}` > `AlertDialog.Container` > `AlertDialog.Dialog`. `Button slot="close"` closes its overlay.
- `@rivetjs/cdk/<module>`: headless 1:1 ports of React Aria / React Stately / RAC / Angular CDK (`rv-*` classes + `data-*` state, div overlay layer, no native `<dialog>` / `popover`). Use it for custom-styled widgets.
- Animation: `@rivetjs/motion` (`<Motion.div initial animate exit>`, `whilePress`, `Presence`; not framer-motion). Look it up first.

## 9. Commands

| Script            | Templates  | Does                                                                               |
| ----------------- | ---------- | ---------------------------------------------------------------------------------- |
| `npm run dev`     | all        | Vite dev server (DevTools panel Alt+Shift+R)                                       |
| `npm run build`   | all        | `vite build && vite build --ssr` (+ `node prerender.js` for static / ui / minimal) |
| `npm start`       | server     | `node serve.js` (`PORT`, `HOST`)                                                   |
| `npm run preview` | static, ui | serve `dist/client`                                                                |
| `npm run check`   | all        | `rivet sync && rivet-check && tsgo`                                                |

- `rivet sync` (`@rivetjs/router`) regenerates `.rivet/` (route types, editor manifest). `rivet-check` (`@rivetjs/language-core`): compiler + type-aware diagnostics of every `.tsx` (`--json`, `--quiet`, `--verbose`); exit 0 clean (warnings ok), 1 errors, 2 bad arguments.
- Tests (optional): `rivetTest()` from `@rivetjs/testing/vite`; `render`, `fire`, `flush` from `@rivetjs/runtime/testing`.

## 10. RV diagnostics, MCP, docs

- `RVnnnn`: 1xxx JSX / attributes, 2xxx resume, 3xxx imports / route modules, 4xxx i18n, 5xxx styles, 6xxx slots, 7xxx config, 9xxx internal. Compiler errors fail the build; warnings (RV2104, RV3101) do not. Vite prints `[RV1016] src/x.tsx:12:8: …`, `rivet-check` `file:line:col - error RV1016: …`. Every code: `npx -y @rivetjs/mcp explain RVnnnn` (meaning, fix, Avoid / Prefer) and `https://rivetjs.severyn.pro/errors/RVnnnn/`.
- Common: RV1012 lowercase event · RV1016 handler reads state when bound (wrap in an arrow) · RV1101 unsafe attribute · RV2001 browser global in render · RV2103 `Date.now()` / `Math.random()` in render · RV2104 signal in a loop · RV2107 route data not encodable · RV3003 / RV3004 `For` namespace import / alias · RV3008 / RV3011 server-only code reached from browser code · RV5003 style string · RV7102 stale `.rivet/` (`rivet sync`).
- MCP server (stdio, offline): `claude mcp add rivet -- npx -y @rivetjs/mcp`; Cursor / VS Code: `{ "mcpServers": { "rivet": { "command": "npx", "args": ["-y", "@rivetjs/mcp"] } } }` in `.cursor/mcp.json` (guide `docs:/guides/tooling/ai/`). Loop: look up → write → `check_code` → fix → `npm run check`.
- Editor: `@rivetjs/typescript-plugin` in `tsconfig.json` shows the same diagnostics + quick fixes. Portable skill bundles: the Rivet repository's `skills/` directory.

## Checklist before reporting done

- `npm run check` exits 0; `npm run build` passes.
- No React imports or hooks; `class`, `onClick` / `onInput`, ui `onPress`; two-way ui props get the signal (`isOpen={open}`).
- Changing lists use `For` with `by` and call the item accessor (`item().x`); no destructured props that change.
- No browser globals outside handlers / `clientEffect` / `clientEvent` / `clientOnly`.
- Icons only via `<Icon icon={…} />` + lucide; in a ui app, components from `@rivetjs/ui`.
- Never edit `.rivet/`, `src/rivet-i18n.d.ts` or other `Generated … Do not edit` files.
