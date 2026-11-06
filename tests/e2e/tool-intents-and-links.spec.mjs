import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const intents=JSON.parse(readFileSync(new URL("../../src/tool-intents.json",import.meta.url),"utf8")).tools;
const manifest=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8")).tools;
const fieldChecks=JSON.parse(readFileSync(new URL("../../src/field-verification.json",import.meta.url),"utf8")).checks;
const active=manifest.filter(t=>t.priority==="P0"||t.priority==="P1");
const bySlug=new Map(intents.map(t=>[t.slug,t]));

test("All 28 calculator landings explain real search tasks and link only to valid contextual follow-ups",async({page})=>{
  test.setTimeout(110000);
  expect(active).toHaveLength(28);
  expect(intents).toHaveLength(28);
  for(const t of active){
    const intent=bySlug.get(t.slug);
    expect(intent,"missing intent mapping for "+t.slug).toBeDefined();
    await page.goto("/"+t.slug+"/",{waitUntil:"domcontentloaded"});
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.title()).toBe(intent.seoTitle+" | Workshop Geometry Tools");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content","noindex,nofollow,noarchive");
    const fit=page.locator(".intent-fit");
    await expect(fit).toBeVisible();
    await expect(fit).toContainText(intent.useFor);
    await expect(fit).toContainText(intent.notFor);
    const choices=page.locator("aside .intent-related a[data-intent-target]");
    await expect(choices).toHaveCount(3);
    for(const [i,next] of intent.next.entries()){
      await expect(choices.nth(i)).toHaveAttribute(
        "href","/"+next.slug+"/");
      await expect(choices.nth(i)).toContainText(next.why);
      expect(next.slug).not.toBe(t.slug);
      const dest=active.find(a=>a.slug===next.slug);
      expect(dest,"linked to an unreleased P2 or non-tool route").toBeTruthy();
    }
    await expect(page.locator(".intent-query-copy")).toBeVisible();
    await expect(page.locator(".intent-query-copy")).toContainText(t.keyword);
    await expect(page.locator(".intent-query-copy"))
      .not.toContainText("Closely related search terms include");
    if(t.slug==="framing-calculator"){
      await expect(page.locator(".intent-query-copy"))
        .toContainText("wall framing calculator with windows and doors");
      await expect(page.locator(".intent-query-copy")).toContainText("king/jack stations");
    }else{
      await expect(page.locator(".intent-query-copy"))
        .not.toContainText("wall framing calculator with windows and doors");
    }
    await expect(page.locator(".field-verification")).toContainText(fieldChecks[t.slug]);
    await expect(page.locator(".field-verification")).toContainText("not a completed field inspection");
  }
});

test("Different search intents are explicitly contrasted and follow-up links navigate as real calculator pages",async({page})=>{
  for(const [source,target] of [
    ["wall-stud-calculator","framing-calculator"],
    ["stud-calculator","wall-stud-calculator"],
    ["deck-board-calculator","deck-material-calculator"],
    ["rafter-calculator","hip-rafter-calculator"],
    ["stair-calculator","stair-stringer-calculator"],
    ["roof-sheathing-calculator","hip-roof-calculator"]
  ]){
    await page.goto("/"+source+"/");
    const link=page.locator('aside a[data-intent-target="'+target+'"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp("/"+target+"/$"));
    await expect(page.locator("#calculator-form")).toBeVisible();
    await expect(page.locator("#calc-error")).toBeHidden();
  }
});

test("On mobile the task-fit guidance remains legible, while print contains geometry not SEO-only synonyms",async({page})=>{
  await page.setViewportSize({width:375,height:800});
  await page.goto("/segmented-bowl-calculator/");
  await expect(page.locator(".intent-fit")).toBeVisible();
  const fit=await page.locator(".intent-fit").boundingBox();
  expect(fit).toBeTruthy();
  expect(fit.width).toBeLessThanOrEqual(376);
  await expect(page.locator(".intent-query-copy")).toBeVisible();
  await page.emulateMedia({media:"print"});
  await expect(page.locator(".intent-fit")).toBeHidden();
  await expect(page.locator(".intent-query-copy")).toBeHidden();
  // The established compact worksheet deliberately prints the safety
  // assumptions but hides the long on-screen method (including formula).
  await expect(page.locator(".proof .formula")).toBeHidden();
  await expect(page.locator("#print-assumptions")).toBeVisible();
  await page.emulateMedia({media:"screen"});
});
