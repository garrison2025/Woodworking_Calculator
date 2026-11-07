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
