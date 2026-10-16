import type { LayoutProps } from "@rivetjs/router";

export default function Home(props: LayoutProps) {
  return <main class="home">{props.children}</main>;
}
