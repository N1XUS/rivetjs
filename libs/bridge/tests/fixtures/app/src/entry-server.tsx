import { resumableToString } from "@rivetjs/runtime/server-resume";
import { Page } from "./page.tsx";

export const render = (manifest: never) => resumableToString(() => <Page />, { manifest });
