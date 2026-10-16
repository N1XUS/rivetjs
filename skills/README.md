# Rivet agent skills

Portable [Agent Skills](https://agentskills.io) for Codex, Claude Code and Cursor, licensed under MIT. Each `rivet-*` directory is a complete installation bundle. `rivet-ui-design` guides colors, spacing, typography, information architecture, app layouts, component composition, responsive behavior and interactions using `@rivetjs/ui` and `@rivetjs/cdk`.

## Install

From the consumer project, install from your local clone:

```sh
npx skills add /path/to/rivet/skills --skill rivet-ui-design --agent codex claude-code cursor
```

After the bundles have been pushed to the public repository:

```sh
npx skills add rivetjs/rivet --skill rivet-ui-design --agent codex claude-code cursor
```

The [skills CLI](https://github.com/vercel-labs/skills) supports `--global` for personal installation and `--list` for discovery. Other Rivet task skills in this directory can be selected with `--skill <name>`.

For manual installation, copy the whole bundle, including `references/` and `LICENSE.txt`:

| Tool        | Project location                                                       | Personal location                                                          |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Codex       | `.agents/skills/rivet-ui-design/`                                      | `~/.agents/skills/rivet-ui-design/`                                        |
| Claude Code | `.claude/skills/rivet-ui-design/`                                      | `~/.claude/skills/rivet-ui-design/`                                        |
| Cursor      | `.cursor/skills/rivet-ui-design/` or `.agents/skills/rivet-ui-design/` | `~/.cursor/skills/rivet-ui-design/` or `~/.agents/skills/rivet-ui-design/` |

Use one location per tool. The new Rivet starters already include skills for these tools.

## Use

Invoke `$rivet-ui-design` in Codex or `/rivet-ui-design` in Claude Code/Cursor. Tools can also select it automatically for a matching Rivet design task. Example:

> Use rivet-ui-design to polish our billing settings. Preserve our brand, simplify the card structure, establish spacing/type hierarchy, and design validation and save feedback for desktop and mobile.

The design skill requires neither MCP nor a source checkout. With MCP connected it can retrieve Rivet component docs and compiler checks; without it the bundled references describe how to inspect the installed package exports/types and project documentation. Framework APIs remain experimental: the installed version is authoritative.

## Maintain and ship

These bundles are generated. Edit `libs/mcp/ai/skills/<id>.md` and optional `libs/mcp/ai/skills/<id>/` resources, then run from the repository root:

```sh
node libs/mcp/ai/sync.ts
node libs/mcp/ai/sync.ts --check
```

The same generator produces the starter bundles and Claude plugin. CI checks synchronization. Ship a bundle as a directory or archive with all its files; do not hand-edit generated copies. See the [AI assistants guide](../apps/docs/content/guides/tooling/ai.md) for MCP setup and Claude plugin installation.
