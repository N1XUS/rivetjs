import { report } from "../lib/report.server.ts";

// Renders server-only data: a document route (links load its document; no browser code for this page).
export default function Report() {
  return <h1>{report()}</h1>;
}
