import type { LayoutProps } from "@rivetjs/router";

export default function Site(props: LayoutProps) {
  return <main class="site">{props.children}</main>;
}
