# libs/mcp/ai — AI instruction files (one source)

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Single source of the instructions Rivet apps ship for AI assistants. `sync.ts` generates every copy; never edit the outputs.

## Sources

- `agents.md`: full app-author instructions (what Rivet is, React / Solid differences, resumability, routes / loaders / actions, forms in overlays, i18n, styles, icons via `@rivetjs/kit/icon`, commands, RV codes, llms.txt + MCP). Claims verified against code 2026-10-08; update with any API / behaviour change ("docs follow code").
- `digest.md`: short rules (Copilot instructions, Cursor always-on rule) + pointer to `AGENTS.md`.
- `skills/<id>.md`: task skills, frontmatter `name` (`rivet-*`, `[a-z0-9-]`, ≤ 64) + `description` (one line, ≤ 1024): `add-route`, `form-in-drawer`, `port-react-component`, `add-ui-page`, `design-ui` (`rivet-ui-design`), `fix-resumability-error`. Optional `skills/<id>/` contains UTF-8 resources copied recursively into every installed bundle; `SKILL.md` and `LICENSE.txt` are reserved generated filenames.
- `skills/design-ui/references/`: visual foundations (real semantic color tokens, spacing/type recommendations, contrast), structure/app layouts, component composition, interactions, and Rivet implementation (installed-version authority, MCP and offline lookup, theme APIs, resume rules). The entrypoint routes references progressively; it works without MCP or a source checkout.
- `evals/ui-design.md`: reproducible consumer scenarios and baseline/forward-test observations; evaluation material is not shipped in skill bundles.

## Outputs (`node libs/mcp/ai/sync.ts [--check]`)

- Per `templates/starter-*`: `AGENTS.md` + `CLAUDE.md` (identical: generated-note comment + `agents.md`), `.github/copilot-instructions.md`, `.cursor/rules/rivet.mdc` (`alwaysApply: true`, digest), `.cursor/rules/<name>.mdc` (agent-requested skills), `.agents/skills/<name>/` (Codex/Cursor) + `.claude/skills/<name>/` (Claude Code), each with `SKILL.md`, resources and the root MIT `LICENSE.txt`. Legacy Cursor-rule reference links point to the corresponding `.agents` bundle.
- Public `skills/<name>/`: identical portable bundles, discoverable by `npx skills add <repo-or-local-path> --skill rivet-ui-design --agent codex claude-code cursor`. `skills/README.md` is the maintained installation guide. No MCP installation is needed for the standalone design skill.
- Claude Code plugin `libs/mcp/plugin/` (`.claude-plugin/plugin.json`, `.mcp.json` = `npx -y @rivetjs/mcp`, `skills/<name>/SKILL.md`) + marketplace `libs/mcp/.claude-plugin/marketplace.json` (`/plugin marketplace add <repo>/libs/mcp`; never published by us).
- `.md` / `.json` outputs formatted with the repo Prettier config (so `format:check` passes); `--check` reports `missing` / `differs` / `stale` (removed skill/resource leftovers; write mode deletes them). Public and starter `rivet-*` skill namespaces are generated-owned; unrelated skill namespaces are preserved. CI `gates` runs `--check`.
- Tests: `libs/mcp/tests/ai.test.ts` (in sync, starters complete, plugin, only real MCP tool names; public/plugin/starter bundle equality + every local reference resolves + license + nested resources + stale cleanup), `libs/create-rivet/tests/ai-files.test.ts` (created apps carry complete design bundles). docs-kit StackBlitz payloads skip them; nx `application` copies them (snapshot `libs/nx/tests/__snapshots__/generators.test.ts.snap`).

## CLI output (CLI-UX)

CLI-UX: agents.md records rivet sync and rivet-check JSON/quiet/verbose flags, warning grouping, and exit status contracts. Regenerate starter AGENTS.md/CLAUDE.md with sync.ts after changing those commands.
