import type { LayoutProps } from "@rivetjs/router";
import { SiteFrame, type FooterColumn } from "@rivetjs/docs-kit/components/SiteFrame.tsx";

const LINKS: FooterColumn[] = [
  {
    title: "More",
    links: [
      { title: "Glossary", href: "/reference/glossary/" },
      { title: "Roadmap", href: "/about/roadmap/" },
      { title: "Benchmarks", href: "/about/benchmarks/" },
    ],
  },
];

/** Site frame from docs-kit (top bar, side nav, mobile drawer, footer); pages render inside it. */
export default function Layout({ url, children }: LayoutProps) {
  return (
    <SiteFrame path={url().pathname} links={LINKS}>
      {children}
    </SiteFrame>
  );
}
