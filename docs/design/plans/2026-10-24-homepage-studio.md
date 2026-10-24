# Runtime Studio Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship selected homepage direction3 with the requested canvas, rolling counter and animated architecture walkthrough.
**Architecture:** Existing docs SiteFrame surrounds page-local components and CSS. A plain-DOM aurora engine owns canvas lifecycle; a Rivet workbench owns accessible tabs/counter, Motion handles digit changes; architecture state drives row and diagram transitions. Benchmarks stay sourced from committed report data.
**Tech Stack:** Rivet TSX/signals/clientEffect, @rivetjs/motion, lucide, docs-kit, existing canvas APIs.
**Spec:** ../specs/2026-10-24-homepage-studio-design.md

## Global Constraints

- Main checkout; explicit-path staging; no user WIP, worktrees, new dependencies or runtime/library changes.
- Use the actual logo, Manrope/Fira Code and Rivet palette; existing docs frame remains functional.
- No invented benchmark values; old0startup-JS claim must be removed wherever it describes the refreshed home.
- Reduced motion, no-JS readable content, pause/offscreen/background lifecycle, keyboard and mobile overflow are part of completion.
- Serial heavy/browser commands, maxWorkers1, ≤3GiB tree; nearest CLAUDE/docs generated normally.

## Review Focus

- Rapid increment/decrement across9/10 and0/99 settles and announces the correct value; test workbench.
- Canvas pauses offscreen, background, user pause and reduced-motion changes; test production lifecycle.
- Keyboard tabs/architecture and focus survive changing state; test actual keyboard path.
- No-JS/reduced-motion/print show usable content without a hidden entrance state; test production modes.
- Mobile390/375 and1440 desktop retain navigation and controls without horizontal overflow; screenshot and browser test.

### Task1: Implement the selected homepage and motion

**Files:** apps/docs/src/routes/index.tsx, src/home-studio.css, src/components/home/{HomeCanvas.tsx,home-aurora.ts,HomeHeadline.tsx,HomeWorkbench.tsx,HomeArchitecture.tsx,home-schema.css}, tests/{home,site}.test.ts, site.config.ts, content/_home-perf.json, apps/docs/CLAUDE.md and relevant design index.
**Interfaces:** HomeCanvas renders decorative canvas/pause; HomeWorkbench renders code tabs and counter; HomeArchitecture renders three interactive explanatory states. All have no required props. Existing SiteFrame remains.

- [x] Migrate obsolete home-specific assertions individually with production tests for hero/CTA/copy, workbench tabs+keyboard+counter rapid directions, canvas lifecycle, architecture, no-JS/reduced-motion/mobile. Keep unrelated site tests. Run focused new hero/workbench RED against prior build.
- [x] Build the page/components/CSS faithful to selected visual plus requested motion; preserve sourced proof and actual docs links.
- [x] Build production docs --no-checks, run new home tests and full docs suite serially; inspect failures, fix causes. Run docs types and content/snippets/llms/MCP/AI.
- [x] Generate home-perf metadata, rebuild and check. Compare source/production screenshots at normalized desktop and375px; exercise interactions in in-app browser. Write design-qa.md, fix actionable visual gaps, recapture.
- [x] Run format/diff checks; update nearest CLAUDE and index. Commit explicit task files.
- [ ] One fresh whole-change reviewer; fix actionable findings with relevant RED/GREEN. Preserve validation evidence and report limitations honestly.
