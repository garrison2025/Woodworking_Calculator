import {test,expect} from "@playwright/test";

// V5 refines the existing WoodLayout workbench. No numeric animation,
// extra calculator, crawler-only text, URL changes or external dependencies.
test("homepage search has an actionable, responsive empty state",async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto("/");
  const search=page.getByLabel("Find a calculator");
  const empty=page.locator("#tool-search-empty");
  await expect(empty).toBeHidden();
  await search.fill("no-such-woodworking-task");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(0);
  await expect(empty).toBeVisible();
  await expect(page.locator("#tool-search-status")).toContainText("No matching calculator");
  await expect(page.locator("#tool-directory")).toHaveClass(/is-filtering/);
  expect(await page.evaluate(()=>
    Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth
  )).toBeLessThanOrEqual(2);
  await page.getByRole("button",{name:"Clear search"}).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(empty).toBeHidden();
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(31);
  await expect(page.locator("#tool-directory")).not.toHaveClass(/is-filtering/);
});

test("changed measurements get short cosmetic feedback but preserve exact SVG and metrics",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await expect(page.locator("#dimension-svg svg")).toBeVisible();
  await expect(page.locator("#result-cards .main-metric")).toBeVisible();
  await page.evaluate(()=>{
    window.__woodlayoutMotion=[];
    const native=Element.prototype.animate;
    Element.prototype.animate=function(keyframes,options){
      if(this.id==="dimension-svg"||this.classList.contains("main-metric"))
        window.__woodlayoutMotion.push({
          target:this.id||"main-metric",keyframes,options
        });
      return native.call(this,keyframes,options);
    };
  });
  const input=page.locator("#f-width");
  const original=Number(await input.inputValue());
  expect(Number.isFinite(original)).toBe(true);
  await input.fill(String(original+17));
  await expect.poll(()=>page.evaluate(()=>
    window.__woodlayoutMotion.length)).toBeGreaterThan(0);
  const records=await page.evaluate(()=>window.__woodlayoutMotion);
  expect(records.some(item=>item.target==="main-metric")).toBe(true);
  expect(records.some(item=>item.target==="dimension-svg")).toBe(true);
  for(const item of records){
    expect(item.options.duration).toBeLessThanOrEqual(220);
    if(item.target==="dimension-svg")
      expect(item.keyframes.every(frame=>
        Object.keys(frame).every(key=>key==="opacity")
      )).toBe(true);
  }
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#dimension-svg svg")).toBeVisible();
  // Rapid edits can still reuse one trusted calculation/geometry path.
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(()=>{window.__woodlayoutMotion=[];});
  await input.fill(String(original+29));
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect.poll(()=>page.locator("#f-width").inputValue()).toBe(String(original+29));
  await page.waitForFunction(()=>document.querySelector("#action-status")?.textContent?.includes("Updated:"));
  expect(await page.evaluate(()=>window.__woodlayoutMotion)).toEqual([]);
});

test("printing finishes temporary feedback before capturing the worksheet",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await expect(page.locator("#dimension-svg svg")).toBeVisible();
  const result=await page.evaluate(async()=>{
    const input=document.querySelector("#f-width");
    input.value=String(Number(input.value)+17);
    input.dispatchEvent(new Event("input",{bubbles:true}));
    window.dispatchEvent(new Event("beforeprint"));
    const drawing=document.querySelector("#dimension-svg");
    const summary=document.querySelector("#result-cards .main-metric");
    const unfinished=[...drawing.getAnimations(),...summary.getAnimations()]
      .filter(animation=>animation.playState==="running");
    window.dispatchEvent(new Event("afterprint"));
    return {unfinished:unfinished.length,error:document.querySelector("#calc-error").hidden,
      diagram:Boolean(drawing.querySelector("svg"))};
  });
  expect(result.unfinished).toBe(0);
  expect(result.error).toBe(true);
  expect(result.diagram).toBe(true);
});
