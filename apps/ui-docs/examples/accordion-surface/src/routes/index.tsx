// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Box, ChevronDown, CreditCard, Globe, Receipt, RotateCcw, ShoppingBag } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";

export const head = { title: "Accordion: Surface" };

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
  {
    content: "Shipping costs vary based on your location and the size of your order. We offer free shipping for orders over $50.",
    icon: Box,
    title: "How much does shipping cost?",
  },
  {
    content: "Yes, we ship to most countries. Please check our shipping rates and policies for more information.",
    icon: Globe,
    title: "Do you ship internationally?",
  },
  {
    content:
      "If you're not satisfied with your purchase, you can request a refund within 30 days of purchase. Please contact our customer support team for assistance.",
    icon: RotateCcw,
    title: "How do I request a refund?",
  },
];

export function Surface() {
  return (
    <Accordion class="w-full max-w-md" variant="surface">
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
      <Surface />
    </div>
  );
}
