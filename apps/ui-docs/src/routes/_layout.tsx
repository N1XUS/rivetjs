import type { LayoutProps } from "@rivetjs/router";
import { site } from "virtual:docs/site";
import { SiteFrame, type FooterColumn } from "@rivetjs/docs-kit/components/SiteFrame.tsx";

const LINKS: FooterColumn[] = [
  {
    title: "Rivet",
    links: [
      { title: "Rivet docs", href: (site.sites?.docs ?? "") + "/" },
      { title: "cdk docs", href: (site.sites?.cdk ?? "") + "/" },
      { title: "Licenses", href: "/start/licenses/" },
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
