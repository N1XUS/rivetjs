import type { LayoutProps } from "@rivetjs/router";
import { PageViews } from "../components/PageViews.tsx";

/** The root layout stays on the page during client navigation, so PageViews sees every URL. */
export default function Layout({ url, children }: LayoutProps) {
  return (
    <div class="p-6">
      <main>{children}</main>
      <PageViews url={url} />
    </div>
  );
}
