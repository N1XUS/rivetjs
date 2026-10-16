// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/faq.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";

export const head = { title: "Accordion: FAQ Layout" };

// #region demo
export function FAQ() {
  const categories = [
    {
      items: [
        {
          content:
            "Browse our products, add items to your cart, and proceed to checkout. You'll need to provide shipping and payment information to complete your purchase.",
          title: "How do I place an order?",
        },
        {
          content: "Yes, you can modify or cancel your order before it's shipped. Once your order is processed, you can't make changes.",
          title: "Can I modify or cancel my order?",
        },
      ],
      title: "General",
    },
    {
      items: [
        {
          content: "You can purchase a license directly from our website. Select the license type that fits your needs and proceed to checkout.",
          title: "How do I purchase a license?",
        },
        {
          content: "A standard license is for personal use or small projects, while a pro license includes commercial use rights and priority support.",
          title: "What is the difference between a standard and a pro license?",
        },
      ],
      title: "Licensing",
    },
    {
      items: [
        {
          content: "You can reach our support team through the contact form on our website, or email us directly at support@example.com.",
          title: "How do I get support?",
        },
      ],
      title: "Support",
    },
  ];

  return (
    <div class="flex w-full flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-bold">Frequently Asked Questions</h2>
        <p class="mb-4 text-lg font-medium text-muted">Everything you need to know about licensing and usage.</p>
      </div>
      {categories.map((category) => (
        <div>
          <p class="text-md mb-2 font-medium text-muted">{category.title}</p>
          <Accordion class="w-full" variant="surface">
            {category.items.map((item, index) => (
              <Accordion.Item>
                <Accordion.Heading>
                  <Accordion.Trigger>
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
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FAQ />
    </div>
  );
}
