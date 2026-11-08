import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const registry=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8"));
const tool=slug=>registry.tools.find(t=>t.slug===slug);

test("numeric measurements round-trip in a no-network URL fragment, including units and reset",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  const t=tool("deck-board-calculator");
  const field=t.inputs.find(f=>f.kind==="L");
  expect(field).toBeTruthy();
  await page.goto("/deck-board-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  await page.locator("#fraction-select").selectOption("32");
  const editor=page.locator('[name="'+field.key+'"]');
  const changed=String(Number((Number(await editor.inputValue())*1.01).toFixed(6)));
  await editor.fill(changed);
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#share-measurements").click();
  await expect(page.locator("#action-status")).toContainText("Measurement link copied");
  const link=await page.evaluate(()=>navigator.clipboard.readText());
  expect(link).toContain("/deck-board-calculator/#measure=v=1&u=mm&p=32&");
  expect(link).not.toContain("?"); // fragment, not a URL query sent in HTTP
  expect(page.url()).not.toContain("#measure="); // opt-in copy doesn't rewrite history
  await page.goto(link);
  await expect(page.locator("#unit-select")).toHaveValue("mm");
  await expect(page.locator("#fraction-select")).toHaveValue("32");
  await expect(page.locator('[name="'+field.key+'"]')).toHaveValue(changed);
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#action-status")).toContainText("Shared measurements loaded");
  await page.locator("#reset-values").click();
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.reload();
  await expect(page.locator("#unit-select")).toHaveValue("in");
});

test("malformed, duplicated and over-limit measurement fragments fail closed",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/wall-stud-calculator/");
  const baseline=await page.locator("#result-cards .main-metric strong").textContent();
  const first=tool("wall-stud-calculator").inputs[0];
  await page.locator("#share-measurements").click();
  const valid=await page.evaluate(()=>navigator.clipboard.readText());
  for(const mutation of [
    valid+"&f."+first.key+"=1",
    valid+"&foreign=999",
    valid.replace("#measure=v=1","#measure=v=99"),
    valid.replace(/&f\.[^&]+=[^&]+/,"")
  ]){
    await page.goto(mutation);
    await expect(page.locator("#action-status")).toContainText("Invalid or incomplete measurement link ignored");
    await expect(page.locator("#result-cards .main-metric strong")).toHaveText(baseline);
    await expect(page.locator("#calc-error")).toBeHidden();
  }
});

test("currency label round trips but optional human review declarations never enter a copied link",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/lumber-price-calculator/");
  await page.locator("#lumber-currency").selectOption("CAD");
  await page.locator("#share-measurements").click();
  const url=await page.evaluate(()=>navigator.clipboard.readText());
  expect(url).toContain("&c=CAD&");
  expect(url).not.toMatch(/approved|reviewed|authorized/i);
  await page.goto(url);
  await expect(page.locator("#lumber-currency")).toHaveValue("CAD");
  await expect(page.locator("#action-status")).toContainText("Shared measurements loaded");
  await expect(page.locator("#calc-error")).toBeHidden();
});


test("previous five-field wall stud share links restore the original nominal layout",async({page})=>{
  const wall=tool("wall-stud-calculator");
  const former=wall.inputs.filter(field=>field.key!=="spacingMode");
  const params=new URLSearchParams([["v","1"],["u","in"],["p","16"],
    ...former.map(field=>["f."+field.key,field.key==="length"?"161":String(field.value)])]);
  await page.goto("/wall-stud-calculator/#measure="+params.toString());
  await expect(page.locator("#calculator-startup")).toBeHidden();
  await expect(page.locator("#f-spacingMode")).toHaveValue("0");
  await expect(page.locator("#f-length")).toHaveValue("161");
  await expect(page.getByText("Final bay exceeds nominal spacing.",{exact:true})).toBeVisible();
  await expect(page.locator("#action-status")).toContainText("Shared measurements loaded");
  // A missing REAL measurement is still incomplete: only the newly added
  // spacingMode may be absent from a legacy Wall Stud fragment.
  params.delete("f.plates");
  await page.goto("/wall-stud-calculator/#measure="+params.toString());
  await expect(page.locator("#action-status")).toContainText("Invalid or incomplete measurement link ignored");
});

test("previous five-field wall stud JSON imports as nominal while malformed legacy JSON fails closed",async({page})=>{
  const wall=tool("wall-stud-calculator");
  const oldInputs=wall.inputs.filter(field=>field.key!=="spacingMode")
    .map(field=>({key:field.key,value:field.key==="length"?"161":String(field.value)}));
  const legacy={
    format:"woodworking-measurements-v1",calculator:"wall-stud-calculator",
    unit:"in",fraction:"16",currency:null,inputs:oldInputs
  };
  await page.goto("/wall-stud-calculator/");
  await expect(page.locator("#load-measurements-json")).toBeEnabled();
  const upload=async data=>page.locator("#load-measurements-json").setInputFiles({
    name:"legacy-wall-stud.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(data))
  });
  await upload(legacy);
  await expect(page.locator("#action-status")).toContainText("Local measurements restored and recalculated");
  await expect(page.locator("#f-spacingMode")).toHaveValue("0");
  await expect(page.locator("#f-length")).toHaveValue("161");
  await upload({...legacy,inputs:oldInputs.slice(0,-1)});
  await expect(page.locator("#action-status")).toContainText("Measurement file rejected");
  await expect(page.locator("#f-length")).toHaveValue("161");
});
