<!-- lessons-format: 2 -->
# Lessons (rivet, local)

- Static example page (`ui-docs` `chat-conversation-basic`, 2026-10-22) booted the resume runtime + ~80 KB closure for one `onScroll` that only serves the optional `ScrollButton`. Checks before "done" on any ui / cdk / docs change: (1) `curl` the page: no `<script type="rivet/state">` when the page has no interaction; (2) for a resumable page, sum the STATIC IMPORT CLOSURE of every `data-preload` / `data-fo` entry (`$S/survey.mjs` pattern), not the chunk sizes; (3) a component's resume module must not import what only its optional parts need (handlers get their own module when their deps are a strict subset). Planner: `VISIBLE_MAX` must test closure bytes (spec `docs/design/specs/2026-10-22-chunk-merge-rule.md` §4.3).
