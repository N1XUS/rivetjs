// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/without-separator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, CreditCard, Receipt, ShoppingBag } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";

export const head = { title: "Accordion: Without Separator" };

// #region demo
const items = [
  {
    content:
      "Browse our products, add items to your cart, and proceed to checkout. You'll need to provide shipping and payment information to complete your purchase.",
    icon: ShoppingBag,
    title: "How do I place an order?",
  },
  {
    content: "Yes, you can modify or cancel your order before it's shipped. Once your order is processed, you can't make changes.",
    icon: Receipt,
    title: "Can I modify or cancel my order?",
  },
  {
    content: "We accept all major credit cards, including Visa, Mastercard, and American Express.",
    icon: CreditCard,
    title: "What payment methods do you accept?",
  },
];

export function WithoutSeparator() {
  return (
    <Accordion hideSeparator class="w-full max-w-md">
      {items.map((item, index) => (
        <Accordion.Item>
          <Accordion.Heading>
            <Accordion.Trigger>
              {item.icon ? (
                <span class="me-3 size-4 shrink-0 text-muted">
                  <Icon icon={item.icon} />
                </span>
              ) : null}
              {item.title}
              <Accordion.Indicator>
                <Icon icon={ChevronDown} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>{item.content}</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithoutSeparator />
    </div>
  );
}
