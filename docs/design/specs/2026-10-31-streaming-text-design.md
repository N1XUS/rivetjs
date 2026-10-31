# Streaming text

Reusable StreamingText, shared pacing in Markdown, and a reasoning demo that reveals letters rather than whole labels.

Incoming chunks must reveal continuously at grapheme boundaries, with subtle opacity on new letters. Existing text and Markdown formatting stay in place; the existing height follower handles layout growth. Initial server text is complete and causes no idle boot. Reduced motion and speed=0 display immediately. End of input drains the pending reveal; replacement/reset discards the previous queue; disposal cancels animation frames.

Approaches: merely splitting demo chunks would not smooth real network bursts; CSS-only word fades retain the reported problem. Chosen approach: a shared headless frame queue, consumed by both a plain text component and the Markdown renderer before parsing. Keep the existing streaming transport helpers.

Implementation choices: 80 graphemes/second by default; cap catch-up delay at 240ms for large bursts; inline letter opacity only; no per-letter movement. Markdown exposes streamingSpeed (0 disables pacing). StreamingText exposes content, isStreaming and speed. Initial content is rendered as supplied; subsequent appends are paced while streaming, including draining the final append.
