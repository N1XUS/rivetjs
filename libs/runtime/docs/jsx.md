# @rivetjs/runtime — JSX area

> **Keep this file current:** ALWAYS update this file in the same change whenever `jsx-runtime.ts` / `jsx-events.ts` or their generator change.

Files: `jsx-runtime.ts` (types + throwing `jsx`/`jsxs`/`jsxDEV`/`Fragment`), generated `jsx-events.ts` (`EventMap`).

- `tsconfig.base.json`: `"jsxImportSource": "@rivetjs/runtime"`, `jsx: preserve` → the compiler erases JSX; the runtime functions exist only to throw `Rivet JSX must pass through @rivetjs/compiler`.
- `JSX.Element = CompiledElement` (opaque brand accepted by `DOMValue` and `ServerValue`); `IntrinsicElements = HTMLTags & SVGTags & MathTags & CustomTags`; `IntrinsicAttributes` adds `r:slot`.
- Global props: `on<Name>` / `on<Name>Capture` typed from `EventMap` with `currentTarget: E`; `window:on*` / `document:on*`; `on:name` (custom events, no capture); `prop:name`; `class:name`; `style:prop`; `class` / `className` (`ClassValue`), `style` (`StyleObject`, strings are compile errors); `ref` (`RefProp<E>`: `ref()` object or callback); `preload` resume directive (not on `<audio>`/`<video>`).
- Custom elements: any attribute except names starting with `on` (every `on…` is an event to the compiler); `innerHTML` / `srcdoc` / `dangerouslySetInnerHTML` never.
- Slots: `Slot<A>` (lazy function content), `Content`, `Slots<N, A>` for `<slot r:name>` names — see `../../../docs/guides/slots.md`.
- `jsx-events.ts` and the compiler's `events_data.rs` come from one generator: `node scripts/gen-events.mjs` (`--check` in CI); rerun after a TypeScript upgrade. Never edit either by hand; an event the compiler accepts but the type lacks (or vice versa) means the generator was skipped.
- Adding a global attribute: `jsx-runtime.ts` only (types); the compiler validates attributes separately (`html.rs`: unknown `on…` events and unsafe attributes are compile errors regardless of the type).
