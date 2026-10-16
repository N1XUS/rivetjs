# Shared example media (apps/cdk-docs)

Files shared by cdk-docs examples (docs-kit "Shared example assets": an example importing `../assets/<file>` it does not have gets `examples/_assets/<file>`). cdk-docs has no `?image` pipeline: examples import them with Vite's `?url` (`import clip from "../assets/lightbox-clip.mp4?url"`, typed by `libs/docs-kit/virtual.d.ts`).

| File                                                                               | Size                                        | Source                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `avocado.jpg`, `cactus.jpg`, `cherries.jpg`, `robot-face.jpg`, `robot-profile.jpg` | 640x480, 400x440, 640x800, 880x495, 880x495 | copies of `apps/ui-docs/examples/_assets/` (Rivet-generated stand-ins; prompts in that README)                     |
| `lightbox-clip.mp4`                                                                | 384x216, 4 s, 51 KB                         | `ffmpeg -f lavfi -i testsrc2=size=384x216:rate=24 -f lavfi -i sine=frequency=440 -t 4` (H.264 + AAC, `+faststart`) |
| `lightbox-clip-poster.jpg`                                                         | 384x216                                     | first frame of `lightbox-clip.mp4`                                                                                 |
| `lightbox-sample.pdf`                                                              | A5, 824 B                                   | hand-written one-page PDF (one Helvetica text line)                                                                |

Used by the `lightbox-*` examples. New file: add it here.
