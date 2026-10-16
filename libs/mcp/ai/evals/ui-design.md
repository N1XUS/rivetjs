# Rivet UI design skill evaluation

Use independent, read-only model sessions for these consumer tasks. Give the model only the installed skill bundle; allow its linked resources. Ask for concise concrete design recommendations, sources and next steps. API-specific code requires actual installed-package or MCP lookup; do not treat a bundle-only test as API/browser verification.

## Scenarios

1. Design a customer-support workspace using `@rivetjs/ui`: ticket list, conversation, customer detail, priority actions. It must work on mobile and use an existing restrained teal brand.
2. Polish a Rivet billing settings page with cards everywhere, inconsistent spacing, tiny muted labels and several primary buttons. Choose color roles, spacing and typography and explain which components should combine.
3. Design a custom-branded accessible command picker with `@rivetjs/cdk`, loading and no-results states, with no Rivet MCP connection.

## Observable success criteria

- Support: task-based queue/detail/context hierarchy, preserved brand, concrete desktop/mobile structure, reachable customer details, draft/selection continuity, deliberate primary action, complete failed-send/pending behavior, plausible component routing qualified by version lookup.
- Billing: related rows consolidated, semantic color roles preserving the brand, readable type hierarchy, consistent spacing with units, grouped form composition, explicit save behavior and appropriate action emphasis. New palette values remain candidates requiring token mapping and contrast verification.
- Command picker: command activation distinguished from value selection, supported primitives considered without invented exports, focus/keyboard/dismissal behavior, pending/no-match/error states, and a concrete installed-export/type documentation path without MCP.
- All: design recommendations distinguished from library defaults and verified results; references resolve from an isolated installed bundle; no assumed source checkout, production docs hostname or required MCP tool.

## Evaluation on 2026-10-11

Baseline: an independent model received only the existing `add-ui-page` skill. It proposed reasonable layouts but stated that its visual values were independent recommendations: "the skill does not specify design tokens." For the command picker it said to "obtain the relevant CDK documentation" without an installed-package retrieval procedure. The baseline showed useful general model ability but gaps in library-specific visual foundations and offline lookup; it did not show a failure of general design judgment.

Forward test: a fresh model received only `skills/rivet-ui-design/SKILL.md` and its references. It selected `AppLayout` with render-function slots and a mobile aside sheet for support, retained the teal brand and drafts, consolidated billing sections with spacing/type ranges and token mapping, and considered `Autocomplete` + `Menu` with explicit installed-version verification. It gave `node_modules/@rivetjs/cdk/package.json` export/type lookup for the no-MCP case and complete keyboard/focus/pending/no-match/error behavior. Each response stated that implementation/browser checks had not been performed.

Limits: three qualitative scenarios, not a statistical benchmark or a live test in Codex/Claude/Cursor. The model flagged that conversation primitives and exact command-picker wiring still require component lookup; the skill intentionally delegates those version-specific APIs to installed documentation. Deterministic tests separately verify every generated reference and license, nested resource copying, stale cleanup, starter copying and bundle equality.
