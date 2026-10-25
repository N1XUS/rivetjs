import { Page, type Item } from "./page.js";
import { createBenchRouter } from "./router.browser.ts";

export interface RootProps {
  items: Item[];
  initialUrl: string;
}

/** Data-only resumable root; the router belongs to this boundary's reactive owner. */
export default function Root(props: RootProps) {
  const router = createBenchRouter(props.initialUrl);
  return <Page items={props.items} router={router} />;
}
