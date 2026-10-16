// Rivet-authored showcase (own content: a fictional shop, invented products, prices and reviews).
// Product photos: AI-generated sample images (examples/_assets/README.md).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Picture } from "@rivetjs/runtime/image";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { Description } from "@rivetjs/ui/description";
import { Drawer } from "@rivetjs/ui/drawer";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Morph } from "@rivetjs/ui/morph";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
import { Rating } from "@rivetjs/ui/rating";
import { Segment } from "@rivetjs/ui/segment";
import { Separator } from "@rivetjs/ui/separator";
import { TextField } from "@rivetjs/ui/textfield";
import { ChevronLeft, CircleCheck, Footprints, Plus, RotateCcw, ShieldCheck, ShoppingBag, Trash, Truck, Zap } from "lucide";

import runnerImage from "../assets/shop-runner.jpg?image";
import toteImage from "../assets/shop-tote.jpg?image";
import shirtImage from "../assets/shop-shirt.jpg?image";
import mugImage from "../assets/shop-mug.jpg?image";
import beanieImage from "../assets/shop-beanie.jpg?image";
import lampImage from "../assets/shop-lamp.jpg?image";

export const head = { title: "Showcase: Storefront" };

// #region demo
const PRODUCTS = [
  { id: "meadow-runner", name: "Meadow knit runner", category: "shoes", price: 128, rating: 4.7, reviews: 212, image: runnerImage, badge: "New" },
  { id: "harbor-tote", name: "Harbor canvas tote", category: "carry", price: 42, rating: 4.5, reviews: 96, image: toteImage, badge: "" },
  { id: "linen-shirt", name: "Tidewater linen shirt", category: "apparel", price: 68, rating: 4.4, reviews: 141, image: shirtImage, badge: "" },
  { id: "kiln-mug", name: "Kiln stoneware mug", category: "home", price: 24, rating: 4.8, reviews: 330, image: mugImage, badge: "Bestseller" },
  { id: "ridge-beanie", name: "Ridge rib beanie", category: "apparel", price: 32, rating: 4.6, reviews: 88, image: beanieImage, badge: "" },
  { id: "halo-lamp", name: "Halo desk lamp", category: "home", price: 89, rating: 4.3, reviews: 57, image: lampImage, badge: "Limited" },
];

// One module-level formatter: `toLocaleString(locale)` builds a new Intl.NumberFormat on every call.
const amount = new Intl.NumberFormat("en-US");
const money = (n: number) => `$${amount.format(n)}`;

export function Storefront() {
  const category = signal<string | null>("all");
  const sort = signal("featured");
  const bag = signal([{ id: "linen-shirt", qty: 1 }]);
  // One drawer, two steps: switching steps swaps the panel's content, never the overlay (no exit + enter, no backdrop flicker).
  const drawerOpen = signal(false);
  const step = signal<"cart" | "checkout">("cart");
  // Direction of the last in-drawer step change ("" when the drawer opened at a step: the panel's own slide is enough).
  const stepMotion = signal<"" | "forward" | "back">("");
  const bagOpen = signal(false);
  const placed = signal(false);
  const delivery = signal<string | null>("standard");

  const productOf = (id: string) => PRODUCTS.find((p) => p.id === id)!;
  const visible = () => {
    const c = category();
    const list = PRODUCTS.filter((p) => c === "all" || p.category === c);
    const s = sort();
    if (s === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (s === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    if (s === "rating") return [...list].sort((a, b) => b.rating - a.rating);
    return list;
  };
  const count = () => bag().reduce((n, line) => n + line.qty, 0);
  const subtotal = () => bag().reduce((n, line) => n + line.qty * productOf(line.id).price, 0);
  const shipping = () => (subtotal() >= 100 || subtotal() === 0 ? 0 : 8) + (delivery() === "express" ? 12 : 0);
  const add = (id: string) =>
    bag.update((lines) => (lines.some((l) => l.id === id) ? lines.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l)) : [...lines, { id, qty: 1 }]));
  const setQty = (id: string, qty: number) =>
    bag.update((lines) => (qty <= 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, qty } : l))));
  const openAt = (at: "cart" | "checkout") => {
    bagOpen.set(false);
    if (at === "checkout") placed.set(false);
    step.set(at);
    stepMotion.set("");
    drawerOpen.set(true);
  };
  const goTo = (at: "cart" | "checkout", focusId: string) => {
    if (at === "checkout") placed.set(false);
    stepMotion.set(at === "checkout" ? "forward" : "back");
    step.set(at);
    // The pressed button left with the old step: keep focus inside the dialog.
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  return (
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-4 pb-28 sm:px-6">
      <header class="flex items-center gap-3">
        <div class="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-[#01EEF9] via-[#0360FA] to-[#5B00F8] text-white">
          <Icon icon={Footprints} size={18} />
        </div>
        <div class="me-auto">
          <p class="text-base leading-tight font-semibold">Fieldnote Supply</p>
          <p class="text-xs text-muted">Everyday goods, made to last</p>
        </div>
        <Button id="cart-open" variant="secondary" size="sm" onPress={() => openAt("cart")}>
          <Icon icon={ShoppingBag} size={16} />
          Cart
          <span class="rounded-full bg-accent px-1.5 text-xs text-accent-foreground tabular-nums">{count()}</span>
        </Button>
      </header>

      <section class="flex flex-col gap-1 rounded-3xl bg-linear-to-br from-[#01EEF9]/15 via-[#0360FA]/10 to-[#B815F9]/15 p-5 sm:p-8">
        <p class="text-xs font-medium tracking-wide text-muted uppercase">Autumn edit</p>
        <h1 class="text-2xl font-semibold text-balance sm:text-3xl">Layers for the walk to work</h1>
        <p class="max-w-md text-sm text-muted">Knit runners, linen and wool, and a mug for when you get there. Free shipping over $100.</p>
      </section>

      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="max-w-full overflow-x-auto">
          <Segment aria-label="Category" selectedKey={category} size="sm">
            <Segment.Item id="all">All</Segment.Item>
            <Segment.Item id="apparel">Apparel</Segment.Item>
            <Segment.Item id="shoes">Shoes</Segment.Item>
            <Segment.Item id="carry">Carry</Segment.Item>
            <Segment.Item id="home">Home</Segment.Item>
          </Segment>
        </div>
        <NativeSelect value={sort} class="w-44">
          <Label class="sr-only">Sort by</Label>
          <NativeSelect.Trigger>
            <NativeSelect.Option value="featured">Featured</NativeSelect.Option>
            <NativeSelect.Option value="price-asc">Price: low to high</NativeSelect.Option>
            <NativeSelect.Option value="price-desc">Price: high to low</NativeSelect.Option>
            <NativeSelect.Option value="rating">Top rated</NativeSelect.Option>
          </NativeSelect.Trigger>
        </NativeSelect>
      </div>

      <ul id="products" class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-4">
        <For each={visible()} by={(p) => p.id}>
          {(p) => (
            <li data-product={p().id}>
              <Card class="h-full gap-3 p-2.5 sm:p-3">
                <div class="relative aspect-square overflow-hidden rounded-2xl bg-surface-secondary">
                  <Picture image={p().image} alt={p().name} sizes="(min-width: 640px) 18rem, 45vw" class="size-full object-cover" />
                  {p().badge ? (
                    <Chip size="sm" class="absolute start-2 top-2">
                      {p().badge}
                    </Chip>
                  ) : null}
                </div>
                <div class="flex flex-1 flex-col gap-1 px-1">
                  <p class="text-sm leading-snug font-medium">{p().name}</p>
                  <div class="flex items-center gap-1.5 text-xs text-muted">
                    <Rating value={p().rating} isReadOnly size="sm" />
                    <span>{p().reviews}</span>
                  </div>
                  <div class="mt-auto flex items-center justify-between pt-1">
                    <span class="font-semibold tabular-nums">{money(p().price)}</span>
                    <Button data-add size="sm" variant="tertiary" isIconOnly aria-label={`Add ${p().name} to bag`} onPress={() => add(p().id)}>
                      <Icon icon={Plus} size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          )}
        </For>
      </ul>

      <ul class="m-0 grid list-none gap-3 p-0 text-sm sm:grid-cols-3">
        {[
          { icon: Truck, title: "Free shipping", text: "On orders over $100" },
          { icon: RotateCcw, title: "30-day returns", text: "Unworn, in the box" },
          { icon: ShieldCheck, title: "Two-year warranty", text: "Repairs before replacements" },
        ].map((perk) => (
          <li class="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Icon icon={perk.icon} size={18} class="text-accent" />
            <div>
              <p class="font-medium">{perk.title}</p>
              <p class="text-xs text-muted">{perk.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* The bag pill: morphs into the order summary, which leads to checkout. */}
      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div class="pointer-events-auto">
          <Morph id="bag" isOpen={bagOpen}>
            <Morph.CollapsedContent>
              <Icon icon={ShoppingBag} size={16} />
              <span id="bag-count" class="text-sm font-medium tabular-nums">
                {count() === 1 ? "1 item" : `${count()} items`}
              </span>
              <span class="text-sm opacity-70 tabular-nums">{money(subtotal())}</span>
              <Morph.Trigger id="bag-view">View</Morph.Trigger>
            </Morph.CollapsedContent>
            <Morph.ExpandedContent aria-label="Order summary" class="w-[min(20rem,calc(100vw-2rem))]">
              <h2 class="text-base font-semibold">Order summary</h2>
              {count() === 0 ? (
                <p class="text-sm text-muted">Your bag is empty.</p>
              ) : (
                <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                  <For each={bag()} by={(line) => line.id}>
                    {(line) => (
                      <li class="flex justify-between gap-3">
                        <span class="text-muted">
                          {line().qty} × {productOf(line().id).name}
                        </span>
                        <span class="tabular-nums">{money(line().qty * productOf(line().id).price)}</span>
                      </li>
                    )}
                  </For>
                </ul>
              )}
              <Separator />
              <div class="flex justify-between text-sm">
                <span class="text-muted">Shipping</span>
                <span class="tabular-nums">{shipping() === 0 ? "Free" : money(shipping())}</span>
              </div>
              <div class="flex justify-between font-semibold">
                <span>Total</span>
                <span id="bag-total" class="tabular-nums">
                  {money(subtotal() + shipping())}
                </span>
              </div>
              <div class="flex gap-2">
                <Morph.Close variant="tertiary" size="sm" class="flex-1">
                  Keep shopping
                </Morph.Close>
                <Button id="bag-checkout" size="sm" class="flex-1" isDisabled={count() === 0} onPress={() => openAt("checkout")}>
                  Check out
                </Button>
              </div>
            </Morph.ExpandedContent>
          </Morph>
        </div>
      </div>

      <Drawer.Content isOpen={drawerOpen} placement="right">
        <Drawer.Header class="min-h-8 flex-row items-center gap-1 pe-10">
          {step() === "checkout" ? (
            <Button
              id="checkout-back"
              size="sm"
              variant="tertiary"
              isIconOnly
              aria-label="Back to cart"
              class="-ms-2"
              onPress={() => goTo("cart", "cart-checkout")}
            >
              <Icon icon={ChevronLeft} size={18} />
            </Button>
          ) : null}
          <Drawer.Heading>{step() === "cart" ? "Your cart" : "Checkout"}</Drawer.Heading>
        </Drawer.Header>
        {/* overflow-x-hidden: the incoming step slides in from the side without a horizontal scrollbar. */}
        <Drawer.Body class="overflow-x-hidden">
          {step() === "cart" ? (
            <div class="storefront-step" data-motion={stepMotion()}>
              {count() === 0 ? (
                <p class="text-sm text-muted">Nothing here yet. Add something you like.</p>
              ) : (
                <ul id="cart-lines" class="m-0 flex list-none flex-col gap-3 p-0">
                  <For each={bag()} by={(line) => line.id}>
                    {(line) => (
                      <li class="flex items-center gap-3" data-line={line().id}>
                        <Picture image={productOf(line().id).image} alt="" sizes="3.5rem" class="size-14 shrink-0 rounded-xl object-cover" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium">{productOf(line().id).name}</p>
                          <p class="text-xs text-muted tabular-nums">{money(productOf(line().id).price)}</p>
                        </div>
                        {/* Controlled by the bag: each step reports back (`setQty`) and the stepper shows the line's quantity. */}
                        <NumberStepper
                          aria-label={`Quantity of ${productOf(line().id).name}`}
                          value={line().qty}
                          minValue={1}
                          maxValue={10}
                          size="sm"
                          onChange={(qty: number) => setQty(line().id, qty)}
                        >
                          <NumberStepper.Group>
                            <NumberStepper.DecrementButton />
                            <NumberStepper.Value />
                            <NumberStepper.IncrementButton />
                          </NumberStepper.Group>
                        </NumberStepper>
                        <Button
                          data-remove
                          size="sm"
                          variant="tertiary"
                          isIconOnly
                          aria-label={`Remove ${productOf(line().id).name}`}
                          onPress={() => setQty(line().id, 0)}
                        >
                          <Icon icon={Trash} size={14} />
                        </Button>
                      </li>
                    )}
                  </For>
                </ul>
              )}
            </div>
          ) : (
            <div class="storefront-step" data-motion={stepMotion()}>
              {placed() ? (
                <div id="order-placed" class="flex flex-col items-center gap-3 py-10 text-center">
                  <Icon icon={CircleCheck} size={40} class="text-success" />
                  <p class="text-lg font-semibold">Order FN-20431 is on its way</p>
                  <p class="text-sm text-muted">A receipt went to your inbox. Most orders ship within one business day.</p>
                </div>
              ) : (
                <Form
                  id="checkout-form"
                  class="flex flex-col gap-4"
                  onSubmit={(event: SubmitEvent) => {
                    event.preventDefault();
                    bag.set([]);
                    placed.set(true);
                  }}
                >
                  <TextField isRequired name="email" type="email" fullWidth>
                    <Label>Email</Label>
                    <Input id="checkout-email" placeholder="you@example.com" variant="secondary" />
                    <FieldError />
                  </TextField>
                  <TextField isRequired name="name" fullWidth>
                    <Label>Full name</Label>
                    <Input id="checkout-name" variant="secondary" />
                    <FieldError />
                  </TextField>
                  <TextField isRequired name="address" fullWidth>
                    <Label>Street address</Label>
                    <Input id="checkout-address" variant="secondary" />
                    <FieldError />
                  </TextField>
                  <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)] gap-3">
                    <TextField isRequired name="city" fullWidth>
                      <Label>City</Label>
                      <Input id="checkout-city" variant="secondary" />
                      <FieldError />
                    </TextField>
                    <TextField isRequired fullWidth name="postcode" validate={(value: string) => (/^[0-9A-Za-z -]{3,10}$/.test(value) ? null : "Check it")}>
                      <Label>Postcode</Label>
                      <Input id="checkout-postcode" variant="secondary" />
                      <FieldError />
                    </TextField>
                  </div>
                  <RadioButtonGroup class="flex-col" value={delivery} name="delivery">
                    <Label>Delivery</Label>
                    <RadioButtonGroup.Item value="standard">
                      <RadioButtonGroup.Indicator />
                      <RadioButtonGroup.ItemIcon>
                        <Icon icon={Truck} />
                      </RadioButtonGroup.ItemIcon>
                      <RadioButtonGroup.ItemContent>
                        <Label>Standard</Label>
                        <Description>3 to 5 business days</Description>
                      </RadioButtonGroup.ItemContent>
                      <span class="ms-auto text-sm font-semibold tabular-nums">{subtotal() >= 100 ? "Free" : "$8"}</span>
                    </RadioButtonGroup.Item>
                    <RadioButtonGroup.Item value="express">
                      <RadioButtonGroup.Indicator />
                      <RadioButtonGroup.ItemIcon>
                        <Icon icon={Zap} />
                      </RadioButtonGroup.ItemIcon>
                      <RadioButtonGroup.ItemContent>
                        <Label>Express</Label>
                        <Description>Next business day</Description>
                      </RadioButtonGroup.ItemContent>
                      <span class="ms-auto text-sm font-semibold tabular-nums">+$12</span>
                    </RadioButtonGroup.Item>
                  </RadioButtonGroup>
                  <div class="flex flex-col gap-1 rounded-2xl bg-surface-secondary p-3 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted">Items</span>
                      <span class="tabular-nums">{money(subtotal())}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Shipping</span>
                      <span class="tabular-nums">{shipping() === 0 ? "Free" : money(shipping())}</span>
                    </div>
                    <div class="flex justify-between font-semibold">
                      <span>Total</span>
                      <span class="tabular-nums">{money(subtotal() + shipping())}</span>
                    </div>
                  </div>
                </Form>
              )}
            </div>
          )}
        </Drawer.Body>
        {step() === "cart" ? (
          <Drawer.Footer class="storefront-step flex-col items-stretch gap-3" data-motion={stepMotion()}>
            <div class="flex justify-between font-semibold">
              <span>Subtotal</span>
              <span class="tabular-nums">{money(subtotal())}</span>
            </div>
            <Button id="cart-checkout" fullWidth isDisabled={count() === 0} onPress={() => goTo("checkout", "checkout-back")}>
              Check out
            </Button>
          </Drawer.Footer>
        ) : placed() ? null : (
          <Drawer.Footer class="storefront-step" data-motion={stepMotion()}>
            {/* Outside the scrolling body: the button stays put while field errors come and go. */}
            <Button id="place-order" type="submit" form="checkout-form" fullWidth>
              Pay {money(subtotal() + shipping())}
            </Button>
          </Drawer.Footer>
        )}
      </Drawer.Content>
    </div>
  );
}
// #endregion

export default function Demo() {
  return <Storefront />;
}
