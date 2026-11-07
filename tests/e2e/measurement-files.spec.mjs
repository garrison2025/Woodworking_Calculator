import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const registry=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8"));
const bySlug=slug=>registry.tools.find(t=>t.slug===slug);
const downloadJson=async page=>{
  const pending=page.waitForEvent("download");
  await page.locator("#download-measurements-json").click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/-measurements\.json$/);
  return readFileSync(await download.path(),"utf8");
};
const uploadJson=(page,contents)=>page.locator("#load-measurements-json").setInputFiles({
  name:"woodworking-measurements.json",mimeType:"application/json",
  buffer:Buffer.from(contents,"utf8")
});

test("download and restore the exact measurement inputs, units and precision without a network upload",async({page})=>{
  const slug="deck-board-calculator",tool=bySlug(slug);
  const field=tool.inputs.find(f=>f.kind==="L");
  await page.goto("/"+slug+"/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#unit-select").selectOption("mm");
  await page.locator("#fraction-select").selectOption("32");
  const input=page.locator('[name="'+field.key+'"]');
  const original=Number(await input.inputValue());
  const expected=String(Number((original+5).toFixed(6)));
  await input.fill(expected);
  await expect(page.locator("#calc-error")).toBeHidden();
  const requests=[];
  page.on("request",r=>{if(r.method()!=="GET")requests.push(r.url());});
  const content=await downloadJson(page);
  const doc=JSON.parse(content);
  expect(doc.format).toBe("woodworking-measurements-v1");
  expect(doc.calculator).toBe(slug);
  expect(doc.unit).toBe("mm");
  expect(doc.fraction).toBe("32");
  expect(doc.inputs).toHaveLength(tool.inputs.length);
  expect(doc.inputs.find(x=>x.key===field.key).value).toBe(expected);
  expect(content).not.toMatch(/reviewed|approved|authorized/i);
  await input.fill(String(original+8));
  await uploadJson(page,content);
  await expect(page.locator("#action-status")).toContainText("Local measurements restored and recalculated");
  await expect(page.locator("#unit-select")).toHaveValue("mm");
  await expect(page.locator("#fraction-select")).toHaveValue("32");
  await expect(input).toHaveValue(expected);
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(requests).toEqual([]);
});

test("bad file, mismatched calculator and impossible dimensions leave existing results untouched",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const first=bySlug("deck-board-calculator").inputs[0];
  const field=page.locator('[name="'+first.key+'"]');
  const starting=await field.inputValue();
  const summary=await page.locator("#result-cards .main-metric strong").innerText();
  const good=await downloadJson(page);
  for(const bad of [
    "{broken",
    JSON.stringify({...JSON.parse(good),calculator:"rafter-calculator"}),
    JSON.stringify({...JSON.parse(good),unexpectedApproved:true}),
    JSON.stringify({...JSON.parse(good),inputs:[...JSON.parse(good).inputs,{...JSON.parse(good).inputs[0]}]}),
    JSON.stringify({...JSON.parse(good),inputs:JSON.parse(good).inputs.map((f,i)=>i===0?{...f,value:"0"}:f)})
  ]){
    await uploadJson(page,bad);
    await expect(page.locator("#action-status")).toContainText("Measurement file rejected; existing inputs unchanged");
    await expect(field).toHaveValue(starting);
    await expect(page.locator("#result-cards .main-metric strong")).toHaveText(summary);
    await expect(page.locator("#calc-error")).toBeHidden();
  }
});

test("framing manual inspection declarations are discarded even when imported dimensions are identical",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#framing-stock-options summary").click();
  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  const panel=page.locator("#framing-purchase-review");
  await expect(panel).toBeVisible();
  const checkbox=panel.locator('[data-review-global="sawSafetyReviewed"]');
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  const data=await downloadJson(page);
  expect(data).not.toContain("sawSafetyReviewed");
  await uploadJson(page,data);
  await expect(page.locator("#action-status")).toContainText("Local measurements restored and recalculated");
  await expect(panel).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator("#framing-purchase-review-status")).not.toContainText("SELF-DECLARED REVIEW COMPLETE");
  await expect(page.locator("#calc-error")).toBeHidden();
});

test("importing a local file removes a stale shared URL fragment",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/lumber-price-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#lumber-currency").selectOption("CAD");
  const saved=await downloadJson(page);
  await page.locator("#share-measurements").click();
  const link=await page.evaluate(()=>navigator.clipboard.readText());
  await page.goto(link);
  await expect(page.locator("#action-status")).toContainText("Shared measurements loaded");
  expect(new URL(page.url()).hash).toContain("measure=");
  await uploadJson(page,saved);
  await expect(page.locator("#action-status")).toContainText("Local measurements restored");
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator("#lumber-currency")).toHaveValue("CAD");
  await page.reload();
  await expect(page.locator("#unit-select")).toHaveValue("in");
});

test("a blank inactive roof input does not block calculation, JSON or sharing",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/roof-pitch-calculator/");
  const mode=page.locator("#f-roofMode");
  const angle=page.locator("#f-angle");
  const pitch=page.locator("#f-pitch");
  await mode.selectOption("1");
  await angle.fill("");
  await expect(page.locator("#calc-error")).toBeVisible();
  await mode.selectOption("0");
  await expect(angle).toBeHidden();
  await expect(page.locator("#calc-error")).toBeHidden();
  await pitch.fill("8");
  const content=await downloadJson(page);
  await page.locator("#share-measurements").click();
  await expect(page.locator("#action-status")).toContainText("Measurement link copied");
  const link=await page.evaluate(()=>navigator.clipboard.readText());
  await pitch.fill("6");
  await uploadJson(page,content);
  await expect(page.locator("#action-status")).toContainText("Local measurements restored");
  await expect(pitch).toHaveValue("8");
  await page.goto("/roof-pitch-calculator/");
  await page.goto(link);
  await expect(pitch).toHaveValue("8");
  await expect(page.locator("#calc-error")).toBeHidden();
});
