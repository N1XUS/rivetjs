// Ported from embla-carousel (packages/embla-carousel/src/__tests__/fixtures/axis-vertical.fixture.ts, v8.6.0), MIT, © David Jerleke.
// Changes: module specifiers.
import type { TestElementDimensionsType } from "../mocks/testElements.mock.ts";

/*
Fixture 1

- Vertical
- No slide margins
*/
export const FIXTURE_AXIS_Y: TestElementDimensionsType = {
  containerOffset: {
    offsetWidth: 1000,
    offsetHeight: 1000,
    offsetTop: 0,
    offsetLeft: 0,
  },
  slideOffsets: [
    {
      offsetWidth: 1000,
      offsetHeight: 800,
      offsetTop: 0,
      offsetLeft: 0,
    },
    {
      offsetWidth: 1000,
      offsetHeight: 400,
      offsetTop: 800,
      offsetLeft: 0,
    },
    {
      offsetWidth: 1000,
      offsetHeight: 200,
      offsetTop: 1200,
      offsetLeft: 0,
    },
    {
      offsetWidth: 1000,
      offsetHeight: 500,
      offsetTop: 1400,
      offsetLeft: 0,
    },
    {
      offsetWidth: 1000,
      offsetHeight: 300,
      offsetTop: 1900,
      offsetLeft: 0,
    },
  ],
  endMargin: {
    property: "marginBottom",
    value: 0,
  },
};
