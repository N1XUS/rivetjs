import type { PageProps, RequestEvent } from "@rivetjs/router";
import { ResumeDemo } from "../resume-demo.js";
import { createServerServices } from "../services/server.js";
import { load } from "@rivetjs/router";

export const head = { title: "Resumed page · Rivet playground" };
export const loader = load(({ signal }: RequestEvent) => createServerServices().list(signal));
export default function Resume({ data }: PageProps<typeof loader>) {
  return <ResumeDemo items={data} />;
}
