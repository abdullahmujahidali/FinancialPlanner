/**
 * Category chart palette, assigned by RANK (largest slice first) rather than by
 * hashing the name — so the legend reads as an ordered scale and the donut and
 * its legend always agree. Lives outside the chart component so server
 * components can import it without pulling in client code.
 */
export const DONUT_COLORS = [
  "#E2FB4F", // 1st — acid lime, the dominant slice
  "#0E0E0E", // 2nd — ink
  "#E98D7C", // 3rd — blush
  "#7FB77E", // 4th — sage
  "#F2C14E", // 5th — amber
  "#6C8EBF"  // 6th+ — steel blue
];
