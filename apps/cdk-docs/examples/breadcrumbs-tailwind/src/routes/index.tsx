import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Breadcrumbs with Tailwind" };

const crumb =
  "flex items-center gap-2 text-slate-500 [&_a]:text-teal-700 [&_a]:hover:underline " +
  "after:text-slate-300 after:content-['/'] data-[current]:font-medium data-[current]:text-slate-900 data-[current]:after:content-none";

// #region demo
export default function TailwindTrail() {
  return (
    <Breadcrumbs id="tw-trail" class="m-4 flex list-none flex-wrap items-center gap-2 p-0 text-sm">
      <Breadcrumb class={crumb}>
        <Link href="#home">Home</Link>
      </Breadcrumb>
      <Breadcrumb class={crumb}>
        <Link href="#team">Team</Link>
      </Breadcrumb>
      <Breadcrumb class={crumb}>
        <Link>Profile</Link>
      </Breadcrumb>
    </Breadcrumbs>
  );
}
// #endregion
