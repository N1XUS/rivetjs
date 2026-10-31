# CDK chat/text-reveal

Isolated character pacing entry: `followText`, `textGraphemes` and `TextRevealOptions`. The parent `chat` barrel preserves its existing exports; UI streaming consumers import this subpath directly to keep pacing out of composer/attachment chunks.

Keep this module independent of `chat/index.tsx`. `.tsx` supports resumable browser closures; module load starts no timers and constructs no segmenter. `followText` runs from a clientEffect and returns cleanup. Preserve final queue draining, Unicode graphemes, resets, speed=0 and reduced-motion handling.

Behavior: `libs/cdk/tests/chat-text-reveal.test.ts`. Production payload isolation: `libs/ui/tests/chat-payload.test.ts` plus unchanged strict frame ceilings.
