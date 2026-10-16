import type { LayoutProps } from "@rivetjs/router";
import { Announcer } from "@rivetjs/cdk/announcer";

// Stories are reached by URL (one route file per cdk module); no shared nav, so modules add routes
// without touching this file.
export default function Layout({ children }: LayoutProps) {
  return (
    <main>
      {children}
      <Announcer />
    </main>
  );
}
