import type { PageProps, RequestEvent } from "@rivetjs/router";
import { ResumeDemo } from "../resume-demo.js";
import { createServerServices } from "../services/server.js";

export const head = { title: "Resumed page · Rivet playground" };
export const serverLoad = ({ signal }: RequestEvent) => createServerServices().list(signal);
export default function Resume({ data }: PageProps<typeof serverLoad>) {
  return <ResumeDemo items={data} />;
}
