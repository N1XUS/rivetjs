// Lazy entry of `live-announcer.ts` for `import()` call sites (button pending state). A dynamic entry of its own keeps
// real export names, so the bundler needs no namespace object (`__exportAll`, one extra request per page) for the
// statically shared `live-announcer.ts` chunk.
import { announce } from "./live-announcer.ts";

export const announceAssertive = (message: Parameters<typeof announce>[0]): void => announce(message, "assertive");
