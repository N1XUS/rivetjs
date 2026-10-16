import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Disabled Breadcrumbs" };

// #region demo
export default function Disabled() {
  return (
    <Breadcrumbs id="off-trail" aria-label="Wizard steps" isDisabled>
      <Breadcrumb>
        <Link href="#account">Account</Link>
      </Breadcrumb>
      <Breadcrumb>
        <Link href="#billing">Billing</Link>
      </Breadcrumb>
      <Breadcrumb>
        <Link>Confirm</Link>
      </Breadcrumb>
    </Breadcrumbs>
  );
}
// #endregion
