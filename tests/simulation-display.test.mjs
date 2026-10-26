import test from "node:test";
import assert from "node:assert/strict";
import {
  visibleSimulationViewport,
  simulationPixelRatio,
  adaptiveResolutionScale,
} from "../lib/simulationDisplay.js";

test("phone visible viewport follows browser chrome and keyboard without losing touch classification", () => {
  const view = visibleSimulationViewport({
    width: 390,
    height: 844,
    dpr: 3,
    coarse: true,
    visual: { width: 390, height: 510, offsetTop: 54, offsetLeft: 0 },
  });
  assert.equal(view.height, 510);
  assert.equal(view.top, 54);
  assert.equal(view.width, 390);
  assert.equal(view.isMobile, true);
  const rotated = visibleSimulationViewport({
    width: 844,
    height: 390,
    dpr: 3,
    coarse: true,
  });
  assert.equal(rotated.isMobile, true);
  assert.equal(rotated.width / rotated.height, 844 / 390);
  assert(visibleSimulationViewport({ width: 0, height: NaN }).height > 0);
});

test("resolution respects pixel budgets on high-DPI phones and large displays", () => {
  for (const dimensions of [
    { width: 390, height: 844, isMobile: true },
    { width: 844, height: 390, isMobile: true },
    { width: 4096, height: 2160, isMobile: false },
  ]) {
    const dpr = simulationPixelRatio({
      ...dimensions,
      quality: "auto",
      devicePixelRatio: 3,
    });
    const budget = dimensions.isMobile ? 900000 : 2000000;
    assert(dimensions.width * dimensions.height * dpr * dpr <= budget + 1);
    assert(dpr <= 1.6 && dpr > 0);
  }
  assert(
    simulationPixelRatio({
      width: 390,
      height: 844,
      isMobile: true,
      devicePixelRatio: 3,
      quality: "high",
    }) <= 1.6,
  );
});

test("automatic quality backs off on sustained slow frames and requires recovery hysteresis", () => {
  assert.equal(adaptiveResolutionScale(1, 50), 0.9);
  assert.equal(adaptiveResolutionScale(0.6, 100), 0.6);
  assert.equal(adaptiveResolutionScale(0.8, 16, 4), 0.8);
  assert.equal(adaptiveResolutionScale(0.8, 16, 8), 0.85);
  assert.equal(adaptiveResolutionScale(1, 16, 20), 1);
  assert.equal(adaptiveResolutionScale(0.8, 28, 100), 0.8);
});
