---
title: Storefront
description: "A small shop: product grid with filters, a product page with gallery and reviews, cart drawer, a bag pill that morphs into the order summary, and checkout."
template: guide
status: experimental
related: [components/carousel, components/morph, components/drawer, components/number-stepper, components/rating, components/segment]
---

A fictional shop, Fieldnote Supply, in three screens. Product photos are AI-generated sample images; prices, products, reviews and people are invented.

## Listing, bag and checkout

::example{id=showcase-storefront}

- Category: [Segment](/components/segment/); sort: [NativeSelect](/components/native-select/). The grid is one `For` over a derived list, so filtering only moves product cards.
- Cart quantities are [NumberSteppers](/components/number-stepper/) (1–10; the changed digit rolls in, none under reduced motion) with a remove button beside each line.
- Cart and checkout share one [Drawer](/components/drawer/): Check out switches its content to the checkout step (heading, back button, a short slide of the body and footer; instant under reduced motion), so the overlay never closes and reopens between them.
- The bag pill at the bottom is a [Morph](/components/morph/): View morphs it into the order summary, Check out closes it and opens the drawer at the checkout step.
- Checkout is a [Form](/components/form/) with required fields and a postcode check; the Pay button sits in the drawer footer, so it stays put while field errors come and go.

## Product page

::example{id=showcase-storefront-product}

- Gallery: a [Carousel](/components/carousel/) with thumbnail tabs (APG tabbed carousel: arrow keys move between photos), previous / next buttons, a counter, swipe and drag, looping; slide motion turns off under reduced motion. Colour is a radio group of swatches with a sold-out state; size is a [Segment](/components/segment/) with a disabled item.
- Reviews: a read-only [Rating](/components/rating/) per review, a [ProgressBar](/components/progress-bar/) per star, and an interactive Rating to rate the product.

## Checkout on the server

::example{id=showcase-storefront-checkout}

The same checkout as a live page (`export const live = true`): the drawer's form posts to a server action. Errors come back into the open drawer; success updates the bag in place and closes the drawer without re-rendering the page. Without JavaScript, the Check out link (`?checkout`) opens the drawer on the server and a failed post renders it again with the problems. See [Forms in overlays](site:docs/guides/forms/forms-in-overlays/).
