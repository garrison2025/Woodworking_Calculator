import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const tools=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8")).tools;
const defaults=slug=>Object.fromEntries(tools.find(t=>t.slug===slug).inputs.map(f=>[f.key,f.value]));
const num=async(node,name)=>Number(await node.getAttribute(name));

test("all three slope triangle pages label the same numerical line as their metrics",async({page})=>{
  for(const [slug,metricName] of [
    ["rise-run-calculator","Slope length"],
    ["roof-pitch-calculator","Slope line"],
    ["gable-roof-calculator","Each slope length"]
  ]){
    await page.goto("/"+slug+"/");
    const label=page.locator("#dimension-svg svg text").filter({hasText:"SLOPE LINE "});
    await expect(label).toHaveCount(1);
    const text=await label.textContent();
    expect(text).toMatch(/^SLOPE LINE [0-9,.]+ (in|ft|mm|cm|m)$/);
    const result=await page.locator("#result-cards .metric").filter({hasText:metricName}).innerText();
    expect(result).toContain(text.slice("SLOPE LINE ".length));
    if(slug==="rise-run-calculator"){
      await expect(page.locator("#dimension-svg svg")).toContainText("GENERAL SLOPE");
      await expect(page.locator("#dimension-svg svg")).not.toContainText("ROOF FACE");
    }
    await page.locator("#unit-select").selectOption("mm");
    const changed=await label.textContent();
    expect(changed).toMatch(/^SLOPE LINE [0-9,.]+ mm$/);
    const metricMm=await page.locator("#result-cards .metric").filter({hasText:metricName}).innerText();
    expect(metricMm).toContain(changed.slice("SLOPE LINE ".length));
  }
});

test("shelf faces and cabinet boundary use exact measured cut-list elevations even for thin shelves",async({page})=>{
  await page.goto("/shelf-spacing-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  await page.locator("#f-height").fill("1000");
  await page.locator("#f-thickness").fill("0.1");
  await expect(page.locator("#calc-error")).toBeHidden();
  const faces=page.locator("#dimension-svg svg .shelf-face");
  await expect(faces).toHaveCount(3);
  const boundary=page.locator("#dimension-svg svg .shelf-case-outline");
  const caseWorld=await num(boundary,"data-interior-height");
  const casePixel=await num(boundary,"height");
  const caseY=await num(boundary,"y");
  expect(casePixel).toBeCloseTo(195,8);
  for(let i=0;i<3;i++){
    const face=faces.nth(i);
    const bottom=await num(face,"data-shelf-bottom");
    const top=await num(face,"data-shelf-top");
    const topY=await num(face,"y");
    const facePixel=await num(face,"height");
    expect(top-bottom).toBeGreaterThan(0);
    expect(facePixel).toBeCloseTo((top-bottom)/caseWorld*casePixel,7);
    expect(topY).toBeCloseTo(caseY+(caseWorld-top)/caseWorld*casePixel,7);
    expect(facePixel).toBeLessThan(0.1);
  }
  const metric=await page.locator("#result-cards .metric").filter({hasText:"Shelf stack thickness"}).innerText();
  expect(metric).toContain("0.3 mm");
});

test("deck plan last micro-rip preserves fraction of actual row face without minimum drawn height",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await page.locator("#f-width").fill("112.5001");
  await expect(page.locator("#calc-error")).toBeHidden();
  const boards=page.locator("#dimension-svg svg .deck-plan-board");
  await expect(boards).toHaveCount(21);
  const first=boards.first(),last=boards.last();
  const w0=await num(first,"data-rip-width"),wLast=await num(last,"data-rip-width");
  const h0=await num(first,"height"),hLast=await num(last,"height");
  expect(w0).toBeCloseTo(5.5,6);
  expect(wLast).toBeCloseTo(0.0001,6);
  expect(hLast).toBeGreaterThan(0);
  expect(hLast).toBeCloseTo(h0*wLast/w0,8);
  expect(hLast).toBeLessThan(0.01);
  const start=await num(last,"data-across-start");
  const gap=defaults("deck-material-calculator").gap;
  expect(start).toBeCloseTo(20*(w0+gap),7);
  const metric=await page.locator("#result-cards .metric").filter({hasText:"Last rip"}).innerText();
  expect(metric).toContain("0.0001 in");
});
