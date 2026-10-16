import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Link href, current and disabled" };

// #region demo
export default function Links() {
  return (
    <nav class="m-4 flex gap-4 text-sm" aria-label="Sections">
      <Link id="l-home" href="#home" aria-current="page">
        Home
      </Link>
      <Link id="l-docs" href="#docs">
        Docs
      </Link>
      <Link id="l-old" href="#old" isDisabled>
        Archive
      </Link>
    </nav>
  );
}
// #endregion
