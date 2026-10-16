# @rivetjs/cdk/file-trigger
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `FileTrigger`: any pressable child (Button, Link, `<Pressable>`) opens a hidden `<input type="file">`.

## Entry points
- `@rivetjs/cdk/file-trigger` -> `index.tsx`: `FileTrigger`, `FileTriggerProps`

## Layout
- `index.tsx` - `PressResponder` (`../interactions/pressable.tsx`) around the children + `Input` part (`../input`) with `type="file"`, `display:none`, `class=""`
- tests: `../tests/file-trigger.browser.test.tsx` (port of RAC FileTrigger.test.js + additions), story `/progress` (resumed press → filechooser → onSelect)
- docs: `apps/cdk-docs/content/components/file-trigger.md`, examples `apps/cdk-docs/examples/file-trigger-*`

## Upstream
- RAC `FileTrigger.tsx` (Apache-2.0); no react-aria hook

## Rules / invariants
- Props: `acceptedFileTypes` (→ `accept`, comma-joined), `allowsMultiple` (→ `multiple`), `defaultCamera` (→ `capture`), `acceptDirectory` (→ `webkitdirectory=""`), `onSelect(FileList | null)` (input `change`), `ref` → the input
- Press: clears `input.value` then `input.click()`; input `onClick` stops propagation
- Global DOM props (`data-*`, events) go to the INPUT (upstream `filterDOMProps(rest, { global: true })`), `onClick` / `style` owned
- Ref: a user `ref()` is used directly (readable by the press handler on a resumed page); other ref shapes are merged with an own `ref()` via `mergeRefValues` (copied from a client effect)

## Gotchas
- `capture` / `webkitdirectory` are not in the runtime's JSX input typings: passed through an untyped spread

## See also
- [../CLAUDE.md](../CLAUDE.md), [../interactions/CLAUDE.md](../interactions/CLAUDE.md), [../button/CLAUDE.md](../button/CLAUDE.md)
