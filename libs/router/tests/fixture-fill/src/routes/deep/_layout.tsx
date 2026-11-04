import type { LayoutProps } from "@rivetjs/router";

export const fill = true;

export default function Deep({ children }: LayoutProps) {
  return <div id="deep">{children}</div>;
}
