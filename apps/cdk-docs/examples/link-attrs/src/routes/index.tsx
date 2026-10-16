import { Link } from "@rivetjs/cdk/link";
import { House } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Link attributes" };

// #region demo
export default function Attributes() {
  return (
    <ul class="m-4 grid gap-2 text-sm">
      <li>
        <Link id="la-ext" href="https://example.com" target="_blank" rel="noopener noreferrer">
          Opens in a new tab
        </Link>
      </li>
      <li>
        <Link id="la-file" href="/report.csv" download="report.csv">
          Download as report.csv
        </Link>
      </li>
      <li>
        <Link id="la-any" href="/data.json" download>
          Download with the server's name
        </Link>
      </li>
      <li>
        <Link id="la-de" href="/de/" hrefLang="de" referrerPolicy="no-referrer">
          Deutsch
        </Link>
      </li>
      <li>
        <Link id="la-icon" href="https://github.com" aria-label="GitHub">
          <Icon icon={House} />
        </Link>
      </li>
    </ul>
  );
}
// #endregion
