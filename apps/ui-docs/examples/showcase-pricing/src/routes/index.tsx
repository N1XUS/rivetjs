// Rivet-authored showcase (own content: an invented shop builder's plans; nothing is sent anywhere).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Accordion } from "@rivetjs/ui/accordion";
import { Alert } from "@rivetjs/ui/alert";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { FeatureList } from "@rivetjs/ui/feature-list";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { NumberValue } from "@rivetjs/ui/number-value";
import { Segment } from "@rivetjs/ui/segment";
import { Table } from "@rivetjs/ui/table";
import { Check, ChevronDown, Minus, Sparkles, Store } from "lucide";

export const head = { title: "Showcase: Pricing" };

// #region demo
type Plan = { id: string; name: string; blurb: string; monthly: number; perSeat: boolean; cta: string; features: string[] };

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For a first shop and a handful of orders a week.",
    monthly: 0,
    perSeat: false,
    cta: "Start for free",
    features: ["Up to 50 products", "Card and wallet payments", "Order emails", "Community forum"],
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "For a small team selling every day.",
    monthly: 24,
    perSeat: true,
    cta: "Try Growth for 14 days",
    features: [
      "Unlimited products",
      "Stock across two locations",
      "Discount codes and gift cards",
      "Newsletter with 5,000 contacts",
      "Email support within a day",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    blurb: "For brands with wholesale and several shops.",
    monthly: 59,
    perSeat: true,
    cta: "Talk to us",
    features: ["Everything in Growth", "Wholesale price lists", "Up to 10 locations", "Custom domains per shop", "Named account manager"],
  },
];

type Row = { label: string; values: (string | boolean)[] };
const COMPARE: Row[] = [
  { label: "Products", values: ["50", "Unlimited", "Unlimited"] },
  { label: "Stock locations", values: ["1", "2", "10"] },
  { label: "Transaction fee", values: ["2%", "0.5%", "None"] },
  { label: "Discount codes", values: [false, true, true] },
  { label: "Wholesale price lists", values: [false, false, true] },
  { label: "Newsletter contacts", values: ["500", "5,000", "50,000"] },
  { label: "Support", values: ["Forum", "Email", "Account manager"] },
];

const FAQ = [
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrades apply at once and we charge the difference for the rest of the period. Downgrades take effect at the next renewal.",
  },
  { q: "What counts as a seat?", a: "Everyone who can sign in to the shop admin. Customers, newsletter readers and wholesale buyers are free." },
  { q: "Is there a contract?", a: "No. Monthly plans can be cancelled any time; yearly plans are paid up front and refunded pro rata in the first 30 days." },
  { q: "Do you take a cut of my sales?", a: "Only the transaction fee in the table above, on top of the card processor's own fee. Studio has none." },
];

// One module-level formatter: `toLocaleString(locale)` builds a new Intl.NumberFormat on every call.
const amount = new Intl.NumberFormat("en-IE");
const money = (n: number) => (n === 0 ? "€0" : `€${amount.format(n)}`);

export default function PricingShowcase() {
  const billing = signal<string | null>("monthly");
  const seats = signal<number | null>(3);
  const chosen = signal("");

  const yearly = () => billing() === "yearly";
  /** Yearly = 20% off, shown per month. */
  const price = (plan: Plan) => (yearly() ? Math.round(plan.monthly * 0.8) : plan.monthly);
  const total = (plan: Plan) => price(plan) * (plan.perSeat ? (seats() ?? 1) : 1) * (yearly() ? 12 : 1);

  return (
    <div class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-12 px-4 py-10 sm:px-8">
      <header class="flex flex-col items-center gap-4 text-center">
        <div class="flex items-center gap-2 text-sm font-semibold">
          <Icon icon={Store} size={18} />
          Fieldnote
        </div>
        <h1 class="max-w-2xl text-3xl font-semibold text-balance sm:text-4xl">One price per seat. Every plan includes checkout, stock and email.</h1>
        <p class="max-w-xl text-muted">Start free, add people when the shop grows. No setup fee and no contract.</p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <Segment id="billing" aria-label="Billing period" selectedKey={billing}>
            <Segment.Item id="monthly">Monthly</Segment.Item>
            <Segment.Item id="yearly">Yearly</Segment.Item>
          </Segment>
          <Chip size="sm" variant="soft" color="success">
            <Chip.Label>Yearly saves 20%</Chip.Label>
          </Chip>
        </div>
        <NumberStepper id="seats" aria-label="Team seats" value={seats} minValue={1} maxValue={50} size="sm">
          <div class="flex items-center gap-3 text-sm">
            <span class="text-muted">Team seats</span>
            <NumberStepper.Group>
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper.Group>
          </div>
        </NumberStepper>
      </header>

      <section aria-label="Plans" class="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card id={`plan-${plan.id}`} class={plan.id === "growth" ? "relative gap-5 p-6 ring-2 ring-accent md:-my-3 md:py-9" : "gap-5 p-6"}>
            <Card.Header class="gap-2">
              <div class="flex items-center justify-between gap-2">
                <Card.Title class="text-lg">{plan.name}</Card.Title>
                {plan.id === "growth" ? (
                  <Chip size="sm" color="accent" variant="primary">
                    <Icon icon={Sparkles} size={12} />
                    <Chip.Label>Most popular</Chip.Label>
                  </Chip>
                ) : null}
              </div>
              <Card.Description>{plan.blurb}</Card.Description>
            </Card.Header>
            <Card.Content class="gap-5">
              <div class="flex flex-col gap-1">
                <p class="flex items-baseline gap-1">
                  <NumberValue
                    id={`price-${plan.id}`}
                    value={() => price(plan)}
                    style="currency"
                    currency="EUR"
                    maximumFractionDigits={0}
                    locale="en-IE"
                    isTabular
                    class="text-4xl font-semibold"
                  />
                  <span class="text-sm text-muted">{plan.perSeat ? "per seat / month" : "forever"}</span>
                </p>
                <p id={`total-${plan.id}`} class="text-xs text-muted tabular-nums">
                  {plan.monthly === 0
                    ? "1 seat, upgrade any time"
                    : `${money(total(plan))} ${yearly() ? "billed yearly" : "billed monthly"} for ${seats() ?? 1} ${seats() === 1 ? "seat" : "seats"}`}
                </p>
              </div>
              <FeatureList aria-label={`${plan.name} features`}>
                {plan.features.map((feature) => (
                  <FeatureList.Item>{feature}</FeatureList.Item>
                ))}
              </FeatureList>
            </Card.Content>
            <Card.Footer class="mt-auto">
              <Button
                id={`choose-${plan.id}`}
                fullWidth
                variant={plan.id === "growth" ? "primary" : "secondary"}
                onPress={() =>
                  chosen.set(`${plan.name}, ${yearly() ? "yearly" : "monthly"}, ${plan.perSeat ? (seats() ?? 1) : 1} seat(s): ${money(total(plan))}`)
                }
              >
                {plan.cta}
              </Button>
            </Card.Footer>
          </Card>
        ))}
      </section>

      {/* A live region from the start (announced when the alert appears); hidden while empty. */}
      <div id="pricing-status" role="status" class="mx-auto w-full max-w-xl empty:hidden">
        {chosen() ? (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Selected {chosen()}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
      </div>

      <section aria-labelledby="compare-title" class="flex flex-col gap-4">
        <h2 id="compare-title" class="text-xl font-semibold">
          Compare plans
        </h2>
        {/* The table scrolls inside its card on narrow screens; the page itself never scrolls sideways. */}
        <Table id="compare">
          <Table.ScrollContainer>
            <Table.Content aria-labelledby="compare-title" class="min-w-[34rem]">
              <Table.Header>
                <Table.Column isRowHeader>Feature</Table.Column>
                {PLANS.map((plan) => (
                  <Table.Column>{plan.name}</Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {COMPARE.map((row) => (
                  <Table.Row id={row.label}>
                    <Table.Cell class="text-muted">{row.label}</Table.Cell>
                    {row.values.map((value) => (
                      <Table.Cell>
                        {typeof value === "string" ? (
                          value
                        ) : (
                          <Icon
                            icon={value ? Check : Minus}
                            size={16}
                            class={value ? "text-success" : "text-muted"}
                            aria-label={value ? "Included" : "Not included"}
                          />
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <section aria-labelledby="faq-title" class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h2 id="faq-title" class="text-xl font-semibold">
          Questions
        </h2>
        <Accordion id="faq" class="w-full">
          {FAQ.map((item) => (
            <Accordion.Item>
              <Accordion.Heading>
                <Accordion.Trigger>
                  {item.q}
                  <Accordion.Indicator>
                    <Icon icon={ChevronDown} />
                  </Accordion.Indicator>
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>{item.a}</Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
// #endregion
