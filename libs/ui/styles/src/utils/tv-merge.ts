// `@rivetjs/ui/tv-merge` (ZERO UI-JS2): registers tailwind-merge for `tv.ts`'s class overrides in a production browser bundle.
// Imported by every module that can hand a variant resolver an override tailwind-merge would change (the compiler adds the
// import, `@rivetjs/compiler` `class-merge.ts`; ui components with a utility core import it themselves). Side effects only.
import { cn } from "tailwind-variants";
import { provideMerge } from "./tv.ts";

provideMerge(cn as (joined: string) => string | undefined);
