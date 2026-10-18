# dev.to post: "I wrote a JS framework to beat ASP.NET. The first question was whether it runs React."

- Draft: `react-inside-rivet.md` (dev.to front matter: `published: false`, tags `javascript, react, webdev, performance`, no `series`, `cover_image:` empty). Replaces the unpublished 3-part series (`part-1.md`–`part-3.md`, deleted 2026-10-13).
- Story: 2024 Razor loss recap → "can I keep my React?" → bridges → bridges demo (Next 16 vs `@rivetjs/bridge-react`) with the full LOSE column → Lighthouse paint-gate detour → route chunks vs component chunks → cold press → resume fuzz → first release + 10 real users ask.
- Gists: `gists/*` are the snippet sources; `gists/urls.txt` maps each file to its gist. The post embeds them with `{% gist <url> %}`. To change a snippet: edit the file, then `gh gist edit <url> <file>`.
- Images: `images/prompts.md` + `images/generate.sh` (`codex exec`, headless, `sips`) made the old series' PNGs. The new post uses none of them. Slots are `<!-- image: … -->` comments; dev.to needs the image uploaded, then the URL in `cover_image:` / `![alt](url)` at the slot.

## Snippets in the post (all copied from the repo, imports = public package names)

| file | source | placeholder |
| --- | --- | --- |
| `22-react-island.tsx` | `apps/bridge-demo/rivet/src/routes/index.tsx` (trimmed: recent-orders table + `BD_ALL_LOAD` switch dropped, relative paths shortened) | `GIST_URL_22` |
| `23-RevenueChart.react.tsx` | `apps/bridge-demo/components/RevenueChart.react.tsx` (verbatim) | `GIST_URL_23` |
| `24-vite.config.ts` | `apps/bridge-demo/rivet/vite.config.ts` minus the bench env switches; `rivet({ bridges })` per `libs/compiler/CLAUDE.md` / `apps/docs/content/reference/config.md` | `GIST_URL_24` |
| `25-paint-gate.ts` | `libs/bridge/boot.ts` lines 21, 31–40, 56–58, 77–83 (the `.then` body elided with a comment) | `GIST_URL_25` |
| `26-cold-press-undo-walk.ts` | `libs/runtime/dom-resume.ts` lines 1042–1065 (`cold()` replay body) | `GIST_URL_26` |

Re-copy 25 / 26 from the source files before publishing if `boot.ts` / `dom-resume.ts` changed.

## Publishing checklist

1. Cover: none yet (`cover_image:` empty, slot comment under the front matter). Suggestion: a real screenshot of the bridges demo `/orders` page next to the two Lighthouse reports (Rivet 100 vs Next 84), not a generated image. If a generated one is wanted anyway, one-line prompt: "an old, well-used machine bolted onto a newer frame with a row of visible rivets, plain daylight, flat editorial illustration, no text, no logos".
2. Create gists 22–26 (`gh gist create gists/22-react-island.tsx` …, same account as the old ones: N1XUS, secret), write each URL into `gists/urls.txt` in place of `GIST_URL_NN`.
3. Replace each `{% gist GIST_URL_NN %}` in `react-inside-rivet.md` with `{% gist <url> %}`.
4. Re-check every number against the newest report (provenance below); re-run `git rev-list --count HEAD` and `git log --format=%b | grep -c Co-Authored-By` for the commit counts (1,547 / 1,486 on 2026-10-13).
5. Closing paragraph says the public npm publish and the repo are "coming soon". Update if the first release / a public remote exists by publish day (`git remote -v`: none on 2026-10-13).
6. Gists are secret (unlisted). Make public via the web UI if the post should be discoverable from GitHub.

## Numbers provenance

- `docs/benchmarks/2026-10-12-bridges-demo.md` (+ identical notes in `2026-10-12-bridges-demo.notes.md`): tallies, JS executed before input, framework JS 0.7 vs ≈ 65 KB, script CPU, server CPU / TTFB, Lighthouse scores + simulated LCP, the Lighthouse options table, paint-gate bytes, every LOSE.
- `docs/benchmarks/2026-10-12-islands.md`: Rivet + React vs Astro + React / Next / Rivet native, Preact pair tallies.
- `docs/benchmarks/2026-10-12-route-chunks.md`: timed cold click component vs route chunks, merge budget, decision.
- Also: `docs/design/specs/2026-10-09-function-bridge-design.md` §8.5 (fuzz: 179 routes = 60 + 119, 4,313 steps = 1,623 + 2,690, first run; 0 resume errors; pin counts), `docs/guides/resumability.md` "Fuzz" + "Cold press", `libs/bridge/CLAUDE.md` (boot 790 B br, policies), commit `b66acfe0` (undo walk cycle), commits `5a5ff514` / `c7add2ea` (paint-gate fallbacks).

## Unused gists

None of the old series' gists is embedded in the new post. Kept (files + gists) for history; delete only on purpose:

- `01-legacy-rivet-counter.ts`, `02-minimal-counter.tsx`, `03-todo-input.tsx`, `04-todo-server-compiled.js`, `05-todo-dom-v2-compiled.js`, `06-todo-resume-compiled.js`, `07-todo-resume-html.html`, `08-put-int32.ts`, `09-slab-writer.ts`, `10-raw-row.ts`, `11-list-tape.ts`, `12-compose-gc.yaml`, `13-rfn.ts`, `14-plan-preload-quadratic.ts`, `15-loader-intent.ts`, `16-loader-cold-replay.ts`, `17-dispatch-first-click.ts`, `18-dom-v2-delegation.ts`, `19-shape-pins.ts`, `20-reconcile-fast-path.ts`, `21-bench-row.jsx`.
- Images `images/p1-*.png`, `p2-*.png`, `p3-*.png` are unused too.

## Gotchas

- `codex exec` inside a shell `while read` loop eats the loop's stdin: `generate.sh` redirects `</dev/null` per call.
- The image model silently substituted a stock "hiker with dog" scene for the first octopus prompt (twice); rewording away from "tax collector" fixed it. Always eyeball every PNG.
- dev.to renders `{% gist %}` with every file of the gist: one file per gist.
- The bridges demo report is generated (`apps/bridge-demo/report.ts`); its headline tally moved between drafts (71 / 29 / 22 in an earlier brief, 73 / 26 / 23 in the 2026-10-13 report). Quote the file, not memory.
