/**
 * Category chart palette, assigned by RANK (largest slice first) rather than by
 * hashing the name — so the legend reads as an ordered scale and the donut and
 * its legend always agree. Lives outside the chart component so server
 * components can import it without pulling in client code.
 */
export const DONUT_COLORS = [
  "#E2FB4F", // 1st — acid lime, the dominant slice
  "#0E0E0E", // 2nd — ink
  "#3E7CB1", // 3rd — steel blue
  "#F2C14E", // 4th — amber
  "#7FB77E", // 5th — sage
  "#9B6FC7"  // 6th+ — violet
];

/**
 * The donut sits on a white panel rather than a coloured one: blush segments
 * were vanishing into the blush background, and no accent reads reliably
 * against every other accent.
 */
