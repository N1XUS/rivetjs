# Rivet: rules for AI assistants

This project uses Rivet, a compiled, resumable JSX framework. It is NOT React and NOT Solid. Full instructions: `AGENTS.md` at the project root (read it before editing). Docs: the Rivet MCP server (`npx -y @rivetjs/mcp`: `search_docs`, `get_doc`, `get_component`, `check_code`, `explain_diagnostic`) or each docs site's `/llms.txt`.

- Components run on the server; the browser resumes the page and runs a component once, over the server HTML, when it is first used. No hooks, no re-renders, no dependency arrays.
- Component bodies render on the server and run again on resume: no `window` / `document` / `localStorage` there (RV2001). Browser code goes in handlers, `clientEffect` / `clientEvent` / `clientOnly` from `@rivetjs/runtime/dom`.
- Signals (`@rivetjs/reactivity`): `const n = signal(0)`; read `n()`; write `n.set(1)` / `n.update((v) => v + 1)`; `computed(() => n() * 2)`; `untrack(n)` (no `.peek`).
- JSX: `class` (not `className`), `for`, events `onClick` / `onInput` (PascalCase; not `onclick`, not React's `onChange` for text), `model:value={signal}` for two-way inputs, style objects (no style strings).
- Props are live: read `props.x` where it is shown; destructuring reads once. `mergeProps` / `splitProps` from `@rivetjs/runtime/props`.
- Lists: `<For each={items} by={(i) => i.id}>{(item, index) => … item() … index()}</For>`; `Show`, `Switch` / `Match`, `ref()` from `@rivetjs/runtime/dom` (named imports).
- Resume: render the same thing on both sides (no `Date.now()` / `Math.random()` in a render, RV2103: keep it in a signal); no `signal()` in a loop (RV2104); keep signal/store values as plain JSON data; route loader/action data must be resume-format encodable (RV2107 runtime warning; classes via `registerClass`). No capture rules: a component given functions / services / JSX props adopts with its parent.
- Render props and item renderers are functions (`{(item) => …}`, `({ close }) => …`).
- Import `@rivetjs/runtime/dom` only from `.tsx` files, never from `.ts`.
- Routes: `src/routes/**.tsx`; `_layout.tsx`, `[param]`, `_404.tsx`; page exports `load(…)`, `actions(…)`, `head`, `live`; page `data` is a value, layout `data()` / `params()` / `url()` are accessors; `export const live = true` makes page `data` an accessor updated in place (forms in drawers).
- Forms: `@rivetjs/forms` (`defineForm`, `createForm`, `onSubmit`); `FieldError` from `@rivetjs/forms/components`; server `action` / `invalid` from `@rivetjs/forms/server`.
- i18n: `t("key", { param })` from `@rivetjs/i18n`, compile-time; prefer literal keys (fixed-prefix template keys also support plain text without params).
- Icons: `<Icon icon={Check} />` from `@rivetjs/kit/icon` with lucide (`import { Check } from "lucide"`). Never inline SVG paths, never Unicode glyphs as icons.
- UI: `@rivetjs/ui/<component>` (styled compound parts `Select.Trigger`, `onPress`, two-way props take a signal); headless `@rivetjs/cdk/<module>`.
- After every change: `npm run check` (`rivet sync && rivet-check && tsgo`) and fix every `RVnnnn` diagnostic; never edit `.rivet/` or `Generated … Do not edit` files.
