// Ported from embla-carousel (packages/embla-carousel/src/__tests__/fixtures/selectedAndPreviousSnap-rtl.fixture.ts, v8.6.0), MIT, © David Jerleke.
// Changes: module specifiers.
import type { TestElementDimensionsType } from "../mocks/testElements.mock.ts";

/*
Fixture 1

- Horizontal
- RTL
- No slide margins
*/
export const FIXTURE_SELECTED_PREVIOUS_SNAP_RTL: TestElementDimensionsType = {
  containerOffset: {
    offsetWidth: 1000,
    offsetHeight: 190,
    offsetTop: 0,
    offsetLeft: 0,
  },
  slideOffsets: [
    {
      offsetWidth: 800,
      offsetHeight: 190,
      offsetTop: 0,
      offsetLeft: 200,
    },
    {
      offsetWidth: 400,
      offsetHeight: 190,
      offsetTop: 0,
      offsetLeft: -200,
    },
    {
      offsetWidth: 200,
      offsetHeight: 190,
      offsetTop: 0,
      offsetLeft: -400,
    },
    {
      offsetWidth: 500,
      offsetHeight: 190,
      offsetTop: 0,
      offsetLeft: -900,
    },
    {
      offsetWidth: 300,
      offsetHeight: 190,
      offsetTop: 0,
      offsetLeft: -1200,
    },
  ],
  endMargin: {
    property: "marginLeft",
    value: 0,
  },
};
