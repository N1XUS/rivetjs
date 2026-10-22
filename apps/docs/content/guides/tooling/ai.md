---
title: AI assistants
description: Give Codex, Claude Code, Cursor and other assistants Rivet design skills, docs, component references and compiler checks.
template: guide
status: experimental
related: [guides/tooling/language-service, start/coming-from-other-frameworks, learn/resuming]
---

AI assistants have seen a lot of React and Solid code and very little Rivet. Without help they write `useState`, destructure props, pass functions from the module scope as overlay content, or draw icons with hand-written SVG paths. Rivet gives them three things to work from:

- **llms.txt**: every docs site publishes its pages as Markdown for language models.
- **The Rivet MCP server** (`@rivetjs/mcp`): docs search, component reference, and the Rivet compiler's checks, as tools the assistant calls.
- **Project instructions and skills**: every starter ships an `AGENTS.md` and a `CLAUDE.md` with the rules that differ from React and Solid, plus Copilot and Cursor rules and portable skills for Codex, Claude Code and Cursor.

## llms.txt

Each docs site serves files in the [llms.txt](https://llmstxt.org) format, generated from the same sources as its pages on every build:

| File | What it holds |
| --- | --- |
| `/llms.txt` | Index: every page with a one-line description, grouped like the side navigation, plus the API reference and the examples |
| `/llms-full.txt` | Every page in one file, examples included as source code |
| `/<page>.md` | One page as Markdown: the page URL with `.md` instead of the trailing slash (`/guides/components/events.md`) |
| `/api/<entry>.md` | One API entry point with every export's signature, parameters and members |
| `/examples/<id>.md` | One example's source files |

The framework docs, the [cdk docs](site:cdk/) and the [ui docs](site:ui/) each have their own set. Give an assistant `llms.txt` when it can fetch pages itself, or paste `llms-full.txt` into a chat that cannot.

## The MCP server

`@rivetjs/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that runs on your machine over stdio. It needs no network and no account: the docs of all three sites are bundled in the package.

| Tool | What it does |
| --- | --- |
| `search_docs(query, site?)` | Searches the guides, API entries and examples. `site` is `docs`, `cdk` or `ui`. |
| `get_doc(path)` | Returns one page as Markdown, by id (`ui:/components/select/`), path or URL. |
| `list_components(package?)` | Lists the components of `@rivetjs/ui`, `@rivetjs/cdk` and `@rivetjs/kit`. |
| `get_component(name)` | Returns the import path, props and parts, docs page and example source of a component. |
| `check_code(code, filename?)` | Compiles a file with the Rivet compiler and the language service. Returns each `RV` diagnostic with its line, the fix, and the fixed source when a quick fix applies. |
| `explain_diagnostic(code)` | Explains an `RV` code: what it means, how to fix it, and a before / after pair. |

Start it from your app's folder, so that `check_code` uses your app's compiler and types:

```sh
npx -y @rivetjs/mcp
```

In a Rivet app, `npx rivet mcp` starts the copy installed in the project.

### Claude Code

```sh
claude mcp add rivet -- npx -y @rivetjs/mcp
```

To share it with your team, put it in `.mcp.json` at the project root instead:

```json title=".mcp.json"
{
  "mcpServers": {
    "rivet": { "command": "npx", "args": ["-y", "@rivetjs/mcp"] }
  }
}
```

### Cursor

```json title=".cursor/mcp.json"
{
  "mcpServers": {
    "rivet": { "command": "npx", "args": ["-y", "@rivetjs/mcp"] }
  }
}
```

### VS Code

```json title=".vscode/mcp.json"
{
  "servers": {
    "rivet": { "type": "stdio", "command": "npx", "args": ["-y", "@rivetjs/mcp"] }
  }
}
```

:::note
`@rivetjs/mcp` is available on npm as `0.1.0-alpha.1`. The `npx` commands above use its bundled docs data. For development inside a clone of the Rivet repository, `node libs/mcp/cli.ts` reads the current docs sources.
:::

## Project instructions

Every starter, and every app that `npm create rivet` makes, has an `AGENTS.md` (read by Codex, Cursor, Copilot and others) and a `CLAUDE.md` (read by Claude Code) with the same content. It covers how Rivet differs from React and Solid, the resumability rules, routes, forms, i18n, styles, icons, the project's commands, and how to read `RV` diagnostics. Keep it in your app and add your own project rules below it.

The starters also ship rules for other editors and task skills:

| File | Read by |
| --- | --- |
| `.github/copilot-instructions.md` | GitHub Copilot: the short version of the rules, pointing to `AGENTS.md` |
| `.cursor/rules/rivet.mdc` | Cursor: the same short rules, always applied |
| `.cursor/rules/rivet-*.mdc` | Cursor: one rule per task below, applied when the task comes up |
| `.agents/skills/rivet-*/SKILL.md` | Codex and Cursor: one portable skill per task, with its supporting references |
| `.claude/skills/rivet-*/SKILL.md` | Claude Code: one skill per task below |

| Skill | What it walks through |
| --- | --- |
| `rivet-add-route` | A new page: the route file, its loader or actions, links to it, and the checks |
| `rivet-form-in-drawer` | A form inside a drawer or modal that saves through a route action and updates the page |
| `rivet-port-react-component` | Turning a React component into Rivet: state, effects, props, events, children |
| `rivet-add-ui-page` | A page built from `@rivetjs/ui` components, with icons from `@rivetjs/kit/icon` |
| `rivet-ui-design` | Design decisions for UI/CDK: colors, spacing, typography, page structure, app layouts, component composition, responsive behavior and interactions |
| `rivet-fix-resumability-error` | Reading an `RV` error or a "not serializable" error and applying the fix |

### Install the design skill in an existing project

`rivet-ui-design` is a standard Agent Skills bundle with a short `SKILL.md`, five focused design/implementation references and an MIT license. It works without MCP: assistants can use installed package exports/types, project docs and the supplied references. It preserves your application's brand and conventions rather than imposing Rivet's default theme.

From a clone of the Rivet repository, use the [skills CLI](https://github.com/vercel-labs/skills) from the project that should receive the skill:

```sh
npx skills add /path/to/rivet/skills --skill rivet-ui-design --agent codex claude-code cursor
```

Once these bundles are available on the repository's public branch, the equivalent remote command is:

```sh
npx skills add N1XUS/rivetjs --skill rivet-ui-design --agent codex claude-code cursor
```

Installation is project-scoped by default. Add `--global` for a personal installation available across projects. To install without the CLI, copy the **whole** `skills/rivet-ui-design` directory into `.agents/skills/` for Codex/Cursor or `.claude/skills/` for Claude Code. Cursor also supports `.cursor/skills/`; choose one skill location per tool rather than installing multiple copies. Preserve the references and license when copying or redistributing it.

Invoke `$rivet-ui-design` in Codex or `/rivet-ui-design` in Claude Code/Cursor, or ask for Rivet UI/CDK design so the tool can select the skill. For example: "Use rivet-ui-design to build a support workspace with a ticket queue, conversation and customer details. Preserve our teal brand and define its mobile layout and error states."

The skill guides the model from the user task to page structure, visual roles, component choices and interaction states. It covers semantic color pairs and theme audits, spacing rhythm and density, heading/body/label hierarchy, app shell and scroll decisions, composition of forms/collections/overlays, keyboard/focus behavior and feedback. It then calls for checks on the actual implementation and appearance. The source is maintained in `libs/mcp/ai/skills/design-ui.md` and its companion resource directory; generated bundles ship in starters, the public `skills/` directory and the Claude plugin.

### Claude Code plugin

The skills and the MCP server also come as a Claude Code plugin, for projects that did not start from a starter. In a clone of the Rivet repository:

```sh
claude plugin marketplace add ./libs/mcp
claude plugin install rivet@rivet
```

## A good loop for an assistant

1. Look up what you are about to use: `search_docs`, then `get_doc` or `get_component`.
2. Write the file.
3. Run `check_code` on it and fix every `RV` error. `explain_diagnostic` explains the ones you do not know.
4. Run the project's checks: `npm run check` and the tests.

Codes and their fixes are listed in [Language service](/guides/tooling/language-service/), and `rivet-check` reports the same diagnostics in CI.
