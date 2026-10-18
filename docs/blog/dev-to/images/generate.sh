#!/bin/sh
# Generates every image in prompts.md via codex exec (headless). Skips files that already exist.
cd "$(dirname "$0")"
STYLE="Hyper-glossy generic AI-art stock illustration, over-saturated, dramatic volumetric lighting, lens flare, bokeh, slightly uncanny proportions, no text, no logos, no watermarks."
grep -E '^\| p[0-9]-' prompts.md | while IFS='|' read -r _ file prompt _; do
  file=$(echo "$file" | xargs); prompt=$(echo "$prompt" | xargs)
  [ -f "$file" ] && { echo "skip $file"; continue; }
  echo "=== $file"
  codex exec --skip-git-repo-check -C "$PWD" -s workspace-write \
    "Generate one image, landscape 1536x1024 (or the closest landscape size you support): $prompt. Style: $STYLE Save it as ./$file in the current directory (convert/resize with sips if needed) and print the absolute path. Do nothing else." </dev/null 2>&1 | tail -3
done
ls -la *.png 2>/dev/null
