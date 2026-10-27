---
title: Storefront
description: "A small shop: product grid with filters, a product page with gallery and reviews, cart drawer, a bag pill that morphs into the order summary, and checkout."
template: guide
status: experimental
related: [components/carousel, components/morph, components/drawer, components/number-stepper, components/rating, components/segment, components/navbar, components/badge, components/description-list]
---

A fictional shop, Fieldnote Supply, in three screens. Product photos are AI-generated sample images; prices, products, reviews and people are invented.

## Listing, bag and checkout

::example{id=showcase-storefront}

- The header is a [Navbar](/components/navbar/); the cart button wears a [Badge](/components/badge/) count on a `Badge.Anchor` (the count is `aria-hidden`, the button's `aria-label` says it). The hero is a [Surface](/components/surface/) with a gradient over the accent token, so it follows the theme.
- Category: [Segment](/components/segment/); sort: [NativeSelect](/components/native-select/). The grid is one `For` over a derived list of [Cards](/components/card/), so filtering only moves product cards. The perks are an [ItemCardGroup](/components/item-card-group/) grid.
- Cart lines are [ItemCards](/components/item-card/) with [NumberSteppers](/components/number-stepper/) (1–10; the changed digit rolls in, none under reduced motion) and a remove button; an empty bag is an [EmptyState](/components/empty-state/). Subtotal and totals are a [DescriptionList](/components/description-list/) (the total row emphasized).
- Cart and checkout share one [Drawer](/components/drawer/): Check out switches its content to the checkout step (heading, back button, a short slide of the body and footer; instant under reduced motion), so the overlay never closes and reopens between them.
- The bag pill at the bottom is a [Morph](/components/morph/): View morphs it into the order summary, Check out closes it and opens the drawer at the checkout step.
- Checkout is a [Form](/components/form/) with required fields and a postcode check; the Pay button sits in the drawer footer, so it stays put while field errors come and go. The placed order is an EmptyState in a polite status region.

## Product page

::example{id=showcase-storefront-product}

- [Breadcrumbs](/components/breadcrumbs/) above the gallery. Gallery: a [Carousel](/components/carousel/) with thumbnail tabs (APG tabbed carousel: arrow keys move between photos), previous / next buttons, a counter, swipe and drag, looping; slide motion turns off under reduced motion. Colour is a [ColorSwatchPicker](/components/color-swatch-picker/) (the sold-out colour is disabled; its name comes from the swatch); size is a [Segment](/components/segment/) with a disabled item. Save is a [ToggleButton](/components/toggle-button/) whose heart fills while pressed.
- Perks are a [FeatureList](/components/feature-list/) with lucide icons; the price box is a [Card](/components/card/).
- Reviews: each is a transparent [Card](/components/card/) (`role="article"`) with an [ItemCard](/components/item-card/) header and a read-only [Rating](/components/rating/); a [ProgressBar](/components/progress-bar/) per star, and an interactive Rating to rate the product.

## Checkout on the server

::example{id=showcase-storefront-checkout}

The same checkout as a live page (`export const live = true`): the drawer's form posts to a server action. The Check out link is a [Button](/components/button/) rendered as an `<a>` (`render`), the bag lines an ItemCardGroup with a DescriptionList total, the last order an [Alert](/components/alert/), and the fields [TextFields](/components/text-field/) with their own error lines. Errors come back into the open drawer; success updates the bag in place and closes the drawer without re-rendering the page. Without JavaScript, the Check out link (`?checkout`) opens the drawer on the server and a failed post renders it again with the problems. See [Forms in overlays](site:docs/guides/forms/forms-in-overlays/).
