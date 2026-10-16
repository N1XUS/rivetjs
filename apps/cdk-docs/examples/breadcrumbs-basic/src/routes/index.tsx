import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Breadcrumbs" };

// #region demo
export default function Trail() {
  // Plain breadcrumbs ship no JavaScript: they are anchors.
  return (
    <nav class="m-4 text-sm">
      <Breadcrumbs id="trail">
        <Breadcrumb>
          <Link href="#home">Home</Link>
        </Breadcrumb>
        <Breadcrumb>
          <Link href="#docs">Docs</Link>
        </Breadcrumb>
        <Breadcrumb>
          <Link href="#breadcrumbs">Breadcrumbs</Link>
        </Breadcrumb>
      </Breadcrumbs>
    </nav>
  );
}
// #endregion
