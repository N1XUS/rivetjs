# Rivet implementation and documentation lookup

## Use the installed version as the authority

Read project `AGENTS.md`/`CLAUDE.md`, dependencies, JSX/compiler configuration and styling setup. Rivet resembles React JSX but uses fine-grained signals and compiled/resumable output. Do not install React UI libraries or assume React examples run unchanged. Do not upgrade dependencies or replace a working app setup just to apply this skill.

When Rivet MCP is connected, use `get_component(name, package)` with an explicit `ui` or `cdk` package to retrieve imports, signatures, compound parts and examples. `search_docs(query, site)` and `get_doc(path)` provide guides. Useful doc ids include:

- `ui:/start/design-principles/`, `ui:/start/theming/`, `ui:/start/styling/`, `ui:/start/composition/`.
- `ui:/components/app-layout/`, `ui:/components/typography/`, and the chosen component's page.
- `docs:/learn/resuming/` for SSR/resume constraints.

Without MCP, inspect the installed package's `package.json` exports and corresponding `.d.ts`/source files in `node_modules/@rivetjs/{ui,cdk}`. Those determine available names, props, parts and event types. If an export points into `dist` or a conditional types entry, follow that target. Use the project's docs links or a supplied docs origin: `/llms.txt` indexes Markdown pages, and `<page>.md` provides a page. A `ui:/…` id is an MCP identifier, not a browser URL; do not invent a production host or fetch localhost unless a docs server is actually running.

In a Rivet source checkout, sources are `libs/ui/src/components/<name>/index.ts`, `libs/ui/package.json`, `libs/cdk/package.json`; guides are `apps/ui-docs/content/start/*.md`, component pages are `apps/ui-docs/content/components/<name>.md` and `apps/cdk-docs/content/components/<name>.md`. Examples live under the corresponding app's `examples/`. These paths are a checkout fallback, not dependencies of this installed skill. If the API remains unavailable, request the relevant docs or state the limitation; do not fabricate exports or behavior.

## Styles and tokens

For an app already using Tailwind v4, keep this import order in its global CSS:

```css
@import "tailwindcss";
@import "@rivetjs/ui/styles";
```

The `ui` starter provides the build setup. The UI style import uses the Rivet theme; other looks (the Classic theme included) are `@rivetjs/ui/theme` presets whose variables follow the import. Keep existing custom theme overrides. Tailwind must scan application source containing the classes; if a class is missing, check source detection and CSS import/build configuration. Raw `--surface` is a CSS token; `bg-surface` is a Tailwind utility generated from the kit's theme mapping. With plain CSS use `var(--surface)`.

Themes respond to `.light`/`.dark` or `[data-theme="light" | "dark"]`. UI components can render in portals: scope theme changes to a root that includes their portal output, or use the documented overlay/theme scoping mechanism. Test a menu/dialog as well as the page when changing a scoped theme. A themed inner wrapper alone may leave its overlay with different tokens.

Use `@rivetjs/ui/theme` for framework-free theme derivation. Verify these exports on the installed version. This example generates a candidate restrained teal theme and checks both modes:

```ts
import { auditContrast, themeCss, type ThemeParams } from "@rivetjs/ui/theme";

const theme: ThemeParams = {
  lightness: 0.5,
  chroma: 0.1,
  hue: 185,
  base: 0.004,
  radius: "medium",
  formRadius: "large",
};
const css = themeCss(theme);
const failures = ["light", "dark"].flatMap((mode) =>
  auditContrast(theme, mode as "light" | "dark").filter((pair) => !pair.pass),
);
// Review failures, adjust paired tokens/overrides, and re-audit before applying css.
```

`themeVariables(theme, mode)` returns CSS variables for a style object. `RIVET_PRESET`, `CLASSIC_PRESET` and `THEME_PRESETS` (also the look presets `BRUTALIST_PRESET`, `GLASS_PRESET`, `MAUVE_PRESET`, which change radii, border widths, shadows and card backdrop too) are available starting points. To switch a subtree's whole look by one attribute, import `@rivetjs/ui/styles/themes/presets.css` and set `data-ui-preset="<id>"`. `auditContrast` evaluates the kit's listed pairs including hover/soft variants; custom text, controls, transparency and scoped themes still require checks on the actual screen.

## Rivet conventions that affect composition

- Prefer subpaths: `import { Button } from "@rivetjs/ui/button"`, `import { AppLayout } from "@rivetjs/ui/app-layout"`. CDK names can differ from UI names (`@rivetjs/cdk/combobox`, `@rivetjs/cdk/listbox`); verify exports.
- Prefer `class` and `for`. Component events follow their typed APIs, commonly `onPress`, `onSelectionChange`, `onOpenChange`; native text input uses `onInput` or `model:value`.
- Create `const open = signal(false)` from `@rivetjs/reactivity`; read `open()`, write `open.set(true)`. Supported two-way props take the signal itself (`isOpen={open}`, `value={value}`, `selectedKeys={keys}`). Reading it passes a one-way value; check which props support two-way state.
- Preserve live props: read `props.name`, and use `splitProps`/`mergeProps` from `@rivetjs/runtime/props` for forwarding. Destructuring live props can read them once.
- Dynamic collections use `For` from `@rivetjs/runtime/dom` with a stable `by` key; its item and index arguments are accessors. Component render-prop state values can also be accessors; inspect the example/type before reading them.
- For renderable props use `Content` from `@rivetjs/runtime/jsx-runtime`. For deferred closed overlays/providers on resumable pages use render-function children `{() => …}` instead of already-created JSX. `AppLayout` named slots also take render functions, not JSX values.
- Handlers are plain functions; keep render output the same on server and browser (no `Date.now()` / random values in render). Browser reads (`window`, `document`, storage) belong in handlers or `clientEffect`, not server render. Import browser runtime helpers from `.tsx` modules for resume rewriting.
- Icons: `import { Icon } from "@rivetjs/kit/icon"` and icon data from `lucide`, then `<Icon icon={Search} />`. Keep decorative icons hidden and icon-only controls named. Do not invent SVG paths or use text glyphs as icons.
- CDK is headless: documented `rv-*` classes and `data-*` state support custom CSS, while behavior-critical styles remain inline. Use its overlay primitives, not a hand-built/native-dialog replacement with a different focus/dismissal model.

## Validation

Run `check_code` on changed files when MCP is available. Run the consumer project's existing check/typecheck and build commands (starters use `npm run check` and `npm run build`). A compiler check does not prove visual quality or keyboard behavior; inspect the screen and key sequences in a browser. Use targeted interaction tests when behavior is added or changed. Report checks separately from assumptions, especially when API lookup, browser access or SSR verification is unavailable.
