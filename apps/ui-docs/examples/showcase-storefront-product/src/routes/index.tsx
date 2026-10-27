// Rivet-authored showcase (own content: a fictional shop, invented product, reviews and reviewers).
// Product photos: AI-generated sample images (examples/_assets/README.md).
import { parseColor } from "@rivetjs/cdk/color";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Picture } from "@rivetjs/runtime/image";
import { Accordion } from "@rivetjs/ui/accordion";
import { Avatar } from "@rivetjs/ui/avatar";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";
import { Chip } from "@rivetjs/ui/chip";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { FeatureList } from "@rivetjs/ui/feature-list";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Label } from "@rivetjs/ui/label";
import { Morph } from "@rivetjs/ui/morph";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { Rating } from "@rivetjs/ui/rating";
import { Segment } from "@rivetjs/ui/segment";
import { Separator } from "@rivetjs/ui/separator";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ChevronDown, Heart, Leaf, Ruler, ShoppingBag, Sparkles, Truck } from "lucide";
import runnerImage from "../assets/shop-runner.jpg?image";
import runnerTopImage from "../assets/shop-runner-top.jpg?image";
import runnerSoleImage from "../assets/shop-runner-sole.jpg?image";

export const head = { title: "Showcase: Product page" };

// #region demo
const GALLERY = [
  { image: runnerImage, alt: "Meadow knit runner in sage, side view" },
  { image: runnerTopImage, alt: "Meadow knit runner from above, laces and knit upper" },
  { image: runnerSoleImage, alt: "Heel and foam sole of the Meadow knit runner" },
];
// Product colours (data, not theme colours): the swatch picker takes them as colour values.
const COLOURS = [
  { color: "#9cae96", name: "Sage", inStock: true },
  { color: "#ddd3c2", name: "Oat", inStock: true },
  { color: "#3b3d42", name: "Charcoal", inStock: false },
];
const SIZES = ["7", "8", "9", "10", "11", "12"];
const SOLD_OUT = ["12"];
const BREAKDOWN = [
  { stars: 5, share: 74 },
  { stars: 4, share: 18 },
  { stars: 3, share: 5 },
  { stars: 2, share: 2 },
  { stars: 1, share: 1 },
];
const REVIEWS = [
  {
    name: "Imogen Hart",
    initials: "IH",
    rating: 5,
    date: "Sep 28",
    title: "Light enough to forget",
    text: "I walk 40 minutes to the studio and back. These feel like slippers with a real sole, and the knit dries fast after rain.",
  },
  {
    name: "Tomas Reyes",
    initials: "TR",
    rating: 4,
    date: "Sep 12",
    title: "Runs a touch narrow",
    text: "Lovely colour and very comfortable on day one. I have wide feet, so I went half a size up and that fixed it.",
  },
  {
    name: "Priya Natarajan",
    initials: "PN",
    rating: 5,
    date: "Aug 30",
    title: "Third pair",
    text: "The foam still bounces after a year of daily wear. The oat colour hides dust better than I expected.",
  },
];

export function ProductPage() {
  // Two-way colour string (ColorSwatchPicker value): a Color instance is not resumable data.
  const colour = signal("#9cae96");
  const size = signal<string | null>("9");
  const saved = signal(false);
  const bag = signal(0);
  const myRating = signal(0);
  const colourName = () => {
    const hex = parseColor(colour()).toString("hex").toLowerCase();
    return COLOURS.find((c) => c.color === hex)?.name ?? "";
  };

  return (
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pt-4 pb-28 sm:px-6">
      <Breadcrumbs id="breadcrumbs" aria-label="Breadcrumb">
        <Breadcrumbs.Item href="#">Fieldnote Supply</Breadcrumbs.Item>
        <Breadcrumbs.Item href="#">Shoes</Breadcrumbs.Item>
        <Breadcrumbs.Item>Meadow knit runner</Breadcrumbs.Item>
      </Breadcrumbs>

      <div class="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10">
        {/* Gallery: @rivetjs/ui Carousel (swipe / drag, arrows, arrow keys on the thumbnail tabs, counter; motion off under
            prefers-reduced-motion). Lightbox hook: when @rivetjs/ui/lightbox lands, wrap each slide's Picture in a button whose
            onClick opens the lightbox at that slide's index (`i`). */}
        <section aria-label="Photos" class="relative min-w-0">
          <Carousel id="gallery" aria-label="Photos of the Meadow knit runner" tabs loop slideCount={GALLERY.length} class="w-full">
            <Carousel.Content>
              {GALLERY.map((g, i) => (
                <Carousel.Item>
                  <div class="aspect-square overflow-hidden rounded-3xl bg-surface-secondary">
                    <Picture image={g.image} alt={g.alt} sizes="(min-width: 768px) 32rem, 100vw" class="size-full object-cover" priority={i === 0} />
                  </div>
                </Carousel.Item>
              ))}
            </Carousel.Content>
            <Carousel.Previous />
            <Carousel.Next />
            <Carousel.Counter id="gallery-counter" />
            <Carousel.Thumbnails>{(index) => <Picture image={GALLERY[index].image} alt="" sizes="6rem" class="size-full object-cover" />}</Carousel.Thumbnails>
          </Carousel>
          <Chip size="sm" class="pointer-events-none absolute start-3 top-3">
            New
          </Chip>
        </section>

        <section aria-labelledby="product-title" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h1 id="product-title" class="text-2xl font-semibold sm:text-3xl">
              Meadow knit runner
            </h1>
            <div class="flex items-center gap-2 text-sm text-muted">
              <Rating value={4.7} isReadOnly size="sm" />
              <span>4.7 · 212 reviews</span>
            </div>
            <p class="text-xl font-semibold tabular-nums">$128</p>
            <p class="text-sm text-muted">A breathable recycled-yarn upper on a soft foam sole that keeps its bounce. Built for long walks, not marathons.</p>
          </div>

          <div class="flex flex-col gap-2">
            <p id="colour-label" class="text-sm">
              Colour: <span class="font-medium">{colourName()}</span>
            </p>
            {/* Arrow keys move between the in-stock colours; the sold-out one is disabled. */}
            <ColorSwatchPicker id="colour" aria-labelledby="colour-label" value={colour} size="lg">
              {COLOURS.map((c) => (
                <ColorSwatchPicker.Item color={c.color} isDisabled={!c.inStock}>
                  <ColorSwatchPicker.Swatch colorName={c.inStock ? c.name : `${c.name}, sold out`} />
                  <ColorSwatchPicker.Indicator />
                </ColorSwatchPicker.Item>
              ))}
            </ColorSwatchPicker>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-sm">
              <span>Size (US)</span>
              <span class="inline-flex items-center gap-1 text-muted">
                <Icon icon={Ruler} size={14} />
                True to size
              </span>
            </div>
            <div class="max-w-full overflow-x-auto">
              <Segment aria-label="Size" selectedKey={size}>
                {SIZES.map((s) => (
                  <Segment.Item id={s} isDisabled={SOLD_OUT.includes(s)}>
                    {s}
                  </Segment.Item>
                ))}
              </Segment>
            </div>
            <p class="text-xs text-muted">Size 12 is back in November.</p>
          </div>

          <div class="flex gap-2">
            <Button id="add-to-bag" class="flex-1" onPress={() => bag.set(bag() + 1)}>
              <Icon icon={ShoppingBag} size={16} />
              Add to bag
            </Button>
            <ToggleButton id="save" isIconOnly aria-label="Save for later" isSelected={saved} class="product-save">
              <Icon icon={Heart} size={16} />
            </ToggleButton>
          </div>

          <FeatureList color="accent" aria-label="Delivery and materials" class="text-muted">
            <FeatureList.Item icon={Truck}>Free delivery by Thursday</FeatureList.Item>
            <FeatureList.Item icon={Leaf}>Upper knit from 12 recycled bottles</FeatureList.Item>
          </FeatureList>

          <Accordion class="w-full">
            {[
              { title: "Materials", body: "Recycled polyester knit upper, sugarcane-based EVA foam sole, organic cotton laces." },
              { title: "Fit", body: "Regular fit with a roomy toe box. Between sizes or wide feet: go half a size up." },
              { title: "Care", body: "Remove the insoles and laces, wash cold on a gentle cycle, air dry away from heat." },
            ].map((item) => (
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
                  <Accordion.Body>{item.body}</Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </section>
      </div>

      <Separator />

      <section aria-labelledby="reviews-title" class="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div class="flex flex-col gap-4">
          <h2 id="reviews-title" class="text-lg font-semibold">
            Reviews
          </h2>
          <div class="flex items-end gap-3">
            <span class="text-4xl font-semibold tabular-nums">4.7</span>
            <div class="flex flex-col gap-1 pb-1 text-xs text-muted">
              <Rating value={4.7} isReadOnly size="sm" />
              212 reviews
            </div>
          </div>
          <div class="flex flex-col gap-2">
            {BREAKDOWN.map((row) => (
              <ProgressBar
                aria-label={`${row.stars} ${row.stars === 1 ? "star" : "stars"}`}
                value={row.share}
                size="sm"
                class="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-center gap-2"
              >
                <Label class="text-xs text-muted">
                  {row.stars} {row.stars === 1 ? "star" : "stars"}
                </Label>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
                <span class="text-end text-xs text-muted tabular-nums">{row.share}%</span>
              </ProgressBar>
            ))}
          </div>
          <Card class="gap-2 p-4">
            <Card.Header>
              <Card.Title class="flex items-center gap-1.5 text-sm font-medium">
                <Icon icon={Sparkles} size={14} class="text-accent" />
                Own a pair? Rate them
              </Card.Title>
            </Card.Header>
            <Card.Content class="gap-2">
              <Rating id="my-rating" value={myRating} aria-label="Your rating" />
              <Card.Description id="my-rating-text" class="text-xs">
                {myRating() === 0 ? "Tap a star" : `${myRating()} ${myRating() === 1 ? "star" : "stars"}, thanks`}
              </Card.Description>
            </Card.Content>
          </Card>
        </div>
        <div id="reviews" class="flex flex-col gap-6">
          {REVIEWS.map((r) => (
            <Card variant="transparent" class="gap-2 p-0" aria-label={`Review by ${r.name}`} role="article">
              <ItemCard variant="transparent" class="p-0">
                <ItemCard.Icon class="bg-transparent">
                  <Avatar size="sm">
                    <Avatar.Fallback>{r.initials}</Avatar.Fallback>
                  </Avatar>
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title>{r.name}</ItemCard.Title>
                  <ItemCard.Description>Verified buyer · {r.date}</ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                  <Rating value={r.rating} isReadOnly size="sm" aria-label={`${r.rating} of 5 stars`} />
                </ItemCard.Action>
              </ItemCard>
              <Card.Content class="gap-1">
                <Card.Title class="text-sm font-medium">{r.title}</Card.Title>
                <Card.Description class="text-sm">{r.text}</Card.Description>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div class="pointer-events-auto">
          <Morph id="bag">
            <Morph.CollapsedContent>
              <Icon icon={ShoppingBag} size={16} />
              <span id="bag-count" class="text-sm font-medium tabular-nums">
                {bag() === 0 ? "Bag is empty" : `${bag()} × US ${size() ?? ""}`}
              </span>
              <Morph.Trigger id="bag-view">View</Morph.Trigger>
            </Morph.CollapsedContent>
            <Morph.ExpandedContent aria-label="Bag" class="w-[min(18rem,calc(100vw-2rem))]">
              <h2 class="text-base font-semibold">Bag</h2>
              {bag() === 0 ? (
                <EmptyState size="sm" class="px-0">
                  Pick a size and add the runner to your bag.
                </EmptyState>
              ) : (
                <ItemCard variant="transparent" class="p-0">
                  <ItemCard.Icon class="size-14 overflow-hidden">
                    <Picture image={runnerImage} alt="" sizes="3.5rem" class="size-full object-cover" />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>Meadow knit runner</ItemCard.Title>
                    <ItemCard.Description>
                      {colourName()} · US {size() ?? ""} · {bag()} ×
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action class="text-sm font-semibold tabular-nums">${bag() * 128}</ItemCard.Action>
                </ItemCard>
              )}
              <Morph.Close size="sm" variant="tertiary">
                Keep browsing
              </Morph.Close>
            </Morph.ExpandedContent>
          </Morph>
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return <ProductPage />;
}
