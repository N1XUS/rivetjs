import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";
import { ChevronRight, ShoppingBag } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Breadcrumbs custom content" };

const path = [
  { id: "shop", label: "Shop", href: "#shop" },
  { id: "shoes", label: "Shoes", href: "#shoes" },
  { id: "trail", label: "Trail runners", href: "#trail" },
];

// #region demo
export default function Shop() {
  return (
    <Breadcrumbs id="crumbs" class="m-4 flex list-none gap-1 p-0 text-sm" items={path}>
      {(item: (typeof path)[number]) => (
        <Breadcrumb>
          {({ isCurrent }) => (
            <>
              {/* The Breadcrumb's LinkContext gives this Link aria-current and isDisabled on the last item. */}
              <Link class="crumb" href={item.href}>
                {item.id === "shop" ? <Icon icon={ShoppingBag} size={14} /> : ""}
                {item.label}
              </Link>
              {isCurrent() ? null : (
                <span class="sep" aria-hidden="true">
                  <Icon icon={ChevronRight} size={14} />
                </span>
              )}
            </>
          )}
        </Breadcrumb>
      )}
    </Breadcrumbs>
  );
}
// #endregion
