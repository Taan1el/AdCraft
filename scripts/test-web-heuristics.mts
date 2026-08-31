import assert from "node:assert/strict";

import { sobelEdgeRatio } from "../apps/web/lib/heuristics.ts";

for (const [width, height] of [[1, 1], [1, 8], [8, 1], [2, 2], [2, 8], [8, 2]]) {
  const result = sobelEdgeRatio({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  });

  assert.deepEqual(
    result,
    { ratio: 0, topRatio: 0, bottomRatio: 0 },
    `${width}x${height} image must produce finite zero edge ratios`,
  );
}

const regular = sobelEdgeRatio({
  width: 3,
  height: 3,
  data: new Uint8ClampedArray(3 * 3 * 4),
});
assert.ok(Object.values(regular).every(Number.isFinite), "regular edge ratios must stay finite");

console.log("Heuristic edge-ratio tests passed.");
