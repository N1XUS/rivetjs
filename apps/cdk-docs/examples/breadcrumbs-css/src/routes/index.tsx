import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Breadcrumbs with plain CSS" };

// #region demo
export default function CssTrail() {
  return (
    <Breadcrumbs>
      <Breadcrumb>
        <Link href="#blog">Blog</Link>
      </Breadcrumb>
      <Breadcrumb>
        <Link href="#2026">2026</Link>
      </Breadcrumb>
      <Breadcrumb>
        <Link>Resumability in practice</Link>
      </Breadcrumb>
    </Breadcrumbs>
  );
}
// #endregion
