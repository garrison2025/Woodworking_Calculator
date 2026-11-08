import {test,expect} from "@playwright/test";

const paneNames=async(page)=>page.locator("[data-workspace] > .pane")
  .evaluateAll(nodes=>nodes.map(node=>node.classList.contains("input-pane")?"input":
    node.classList.contains("result-pane")?"results":"diagram"));

test("workspace reading order and Tab traversal agree with responsive visual layout",async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto("/stud-calculator/");
  for(const width of [320,390,768,1024,1440,390]){
    await page.setViewportSize({width,height:840});
    const compact=width<=1220;
    await expect.poll(()=>paneNames(page)).toEqual(compact?
      ["input","results","diagram"]:["input","diagram","results"]);
    const order=await page.locator("[data-workspace] > .pane")
      .evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();
        return {x:r.left,y:r.top,right:r.right,bottom:r.bottom}}));
    if(width<=680){
      expect(order[0].bottom,"inputs before results").toBeLessThan(order[1].y+1);
      expect(order[1].bottom,"results before diagram").toBeLessThan(order[2].y+1);
    }else if(width>=1221){
      expect(order[0].x,"left input panel").toBeLessThan(order[1].x);
      expect(order[1].x,"middle drawing panel").toBeLessThan(order[2].x);
    }
    await page.locator("#load-measurements-json").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(compact?"#copy-result":"#zoom-out")).toBeFocused();
    if(compact){
      await page.locator("#download-csv").focus();
      await page.keyboard.press("Tab");
      await expect(page.locator("#zoom-out")).toBeFocused();
    }else{
      await page.locator("#print-sheet").focus();
      await page.keyboard.press("Tab");
      await expect(page.locator("#copy-result")).toBeFocused();
    }
    const overflow=await page.evaluate(()=>
      Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
    expect(overflow,"page overflow "+width).toBeLessThanOrEqual(2);
  }
});

test("resizing while result action is focused preserves focus and an intact result",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/rafter-calculator/");
  const action=page.locator("#copy-result");
  await expect(page.locator("#calc-error")).toBeHidden();
  const metric=await page.locator("#result-cards .metric").first().innerText();
  await action.focus();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>paneNames(page)).toEqual(["input","results","diagram"]);
  await expect(action).toBeFocused();
  await page.setViewportSize({width:1440,height:900});
  await expect.poll(()=>paneNames(page)).toEqual(["input","diagram","results"]);
  await expect(action).toBeFocused();
  expect((await page.locator("#result-cards .metric").first().innerText()).replace(/\s+/g," ").trim())
    .toBe(metric.replace(/\s+/g," ").trim());
  await expect(page.locator("#calc-error")).toBeHidden();
});

test("slow or failed calculator startup protects edits and offers retry",async({page})=>{
  let finishConfig;
  const blockedConfig=new Promise(resolve=>{finishConfig=resolve;});
  await page.route("**/assets/tool-config/wall-stud-calculator.json",async route=>{
    await blockedConfig;
    await route.fulfill({status:503,body:"Temporary failure"});
  });
  await page.goto("/wall-stud-calculator/",{waitUntil:"domcontentloaded"});
  const length=page.locator("#f-length");
  const startup=page.locator("#calculator-startup");
  try{
    await expect(startup).toContainText("Loading calculator settings");
    await expect(length).toBeDisabled();
  }finally{
    finishConfig();
  }
  await expect(startup).toContainText("The calculator could not load");
  await expect(length).toBeDisabled();
  await page.unroute("**/assets/tool-config/wall-stud-calculator.json");
  await page.getByRole("button",{name:"Retry loading calculator"}).click();
  await expect(length).toBeEnabled();
  await expect(startup).toBeHidden();
  await length.fill("161");
  await expect(page.getByText("Final bay exceeds nominal spacing.",{exact:true})).toBeVisible();
  await length.fill("160");
  await expect(page.getByText("Final bay exceeds nominal spacing.",{exact:true})).toHaveCount(0);
});

test("rise/run disables exports when the entered run is too small",async({page})=>{
  await page.goto("/rise-run-calculator/");
  const run=page.locator("#f-run");
  await run.fill("1e-309");
  await expect(page.locator("#calc-error")).toContainText("run must be at least");
  await expect(page.locator("#download-csv")).toBeDisabled();
  await run.fill("72");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#download-csv")).toBeEnabled();
});


test("maximum OC mode keeps the wall drawing and downloaded cut schedule aligned",async({page})=>{
  await page.goto("/wall-stud-calculator/");
  await expect(page.locator("#calculator-startup")).toBeHidden();
  await page.locator("#f-length").fill("161");
  await page.locator("#f-spacingMode").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.getByText("Equalized maximum-OC layout.",{exact:true})).toBeVisible();
  const shapes=page.locator("#dimension-svg .wall-cut-stud");
  await expect(shapes).toHaveCount(12);
  const stationPositions=await shapes.evaluateAll(nodes=>
    nodes.map(el=>Number(el.getAttribute("data-position"))));
  expect(stationPositions[0]).toBe(0);
  expect(stationPositions.at(-1)).toBe(161);
  for(let i=1;i<stationPositions.length;i++){
    expect(stationPositions[i]-stationPositions[i-1]).toBeLessThanOrEqual(16+1e-8);
  }
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(12);
  const downloadEvent=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const downloaded=await downloadEvent;
  const fs=await import("node:fs/promises");
  const csv=await fs.readFile(await downloaded.path(),"utf8");
  expect(csv).toContain("equalized maximum OC");
  expect(csv).toContain('"Stud 12"');
  expect(csv).toContain('"161"');
  await page.locator("#f-spacingMode").selectOption("0");
  await expect(page.getByText("Final bay exceeds nominal spacing.",{exact:true})).toBeVisible();
  await expect(shapes).toHaveCount(11);
});
