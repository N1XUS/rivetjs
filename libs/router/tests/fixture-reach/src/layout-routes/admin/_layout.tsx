import type { LayoutProps } from "@rivetjs/router";
import { Card } from "../../components/Card.tsx";

// A layout reaching a server-only module: always RV3011 (layouts render in the browser on navigation).
export default function Admin({ children }: LayoutProps) {
  return (
    <section>
      <Card />
      {children}
    </section>
  );
}
