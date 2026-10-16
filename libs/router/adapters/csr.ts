// CSR adapter: a single-page shell that mounts the app in the browser. No server, so route
// modules have no `.server.ts` (codegen rejects them) and pages render without loader data.
import { escapeAttribute } from "@rivetjs/runtime/escape";
import type { DocumentShell } from "../server/render.ts";

/** Options of the CSR `index.html` shell. */
export interface ShellOptions {
  /** Module script URL of the client entry. */
  script: string;
  /** Stylesheet URLs. */
  styles?: readonly string[];
  /** URL the shell is built for (the document sees it; default `http://localhost/`). */
  url?: URL;
}

/** `index.html` for a CSR app from its document shell: the app mounts into the shell's container. */
export function shellHTML(document: DocumentShell, { script, styles = [], url = new URL("http://localhost/") }: ShellOptions): string {
  const { start, end } = document({ head: undefined, nonce: undefined, url, status: 200, styles });
  const tag = `<script type="module" src="${escapeAttribute(script)}"></script>`;
  if (!start.includes("</head>")) throw new Error("CSR shell: the document start has no </head>");
  return start.replace("</head>", tag + "</head>") + end;
}
