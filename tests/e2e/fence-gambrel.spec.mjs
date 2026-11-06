import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const n=(el,attr)=>el.getAttribute(attr).then(Number);

test("picket actual face and 14 equal gaps agree with SVG and numeric CSV",async({page})=>{
  await page.goto("/fence-picket-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const faces=page.locator("#dimension-svg svg .picket-face");
  await expect(faces).toHaveCount(13);
  const gap=(96-13*3.5)/14;
  expect(await n(faces.first(),"data-left")).toBeCloseTo(gap,7);
  expect(await n(faces.last(),"data-right")).toBeCloseTo(96-gap,7);
  const firstWidth=await n(faces.first(),"width"),firstX=await n(faces.first(),"x"),
    nextX=await n(faces.nth(1),"x");
  expect((nextX-firstX-firstWidth)/firstWidth).toBeCloseTo(gap/3.5,7);
  await page.locator("#unit-select").selectOption("mm");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Face Left (mm)"');
  expect(csv).toContain('"Face Right (mm)"');
  await page.locator("#f-mode").selectOption("1");
  await page.locator("#f-count").fill("12");
  await expect(faces).toHaveCount(12);
  await page.locator("#f-count").fill("100");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(faces).toHaveCount(0);
});

test("gambrel four real segments, two pitch breaks and area are consistent",async({page})=>{
  await page.goto("/gambrel-roof-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const lines=page.locator("#dimension-svg svg .gambrel-slope-segment");
  await expect(lines).toHaveCount(4);
  expect(await n(lines.nth(0),"data-end-x")).toBeCloseTo(60,8);
  expect(await n(lines.nth(0),"data-end-y")).toBeCloseTo(60,8);
  expect(await n(lines.nth(1),"data-end-x")).toBeCloseTo(132,8);
  expect(await n(lines.nth(1),"data-end-y")).toBeCloseTo(84,8);
  expect(await n(lines.nth(2),"data-end-y")).toBeCloseTo(60,8);
  await page.locator("#f-lowerPitch").fill("8");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Ridge elevation"})).toContainText("64 in");
  await page.locator("#unit-select").selectOption("mm");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Start X (mm)"');
  expect(csv).toContain('"Signed Vertical Change (mm)"');
  await page.locator("#f-upperPitch").fill("10");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(lines).toHaveCount(0);
});
