import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const downloadCutList=async page=>{
  const pending=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  return readFileSync(await (await pending).path(),"utf8");
};
const downloadBackup=async page=>{
  const pending=page.waitForEvent("download");
  await page.locator("#download-measurements-json").click();
  return JSON.parse(readFileSync(await (await pending).path(),"utf8"));
};

test("inch ruler fractions produce identical calculations, rows and CSV to decimals",async({page})=>{
  await page.goto("/stud-calculator/");
  const length=page.locator("#f-length");
  await expect(length).toHaveAttribute("type","text");
  await expect(page.locator("#f-spacing")).toHaveAttribute("type","text");
  await expect(page.locator("#f-pitch")).toHaveAttribute("type","number");
  await length.fill("120.5");
  await expect(page.locator("#calc-error")).toBeHidden();
  const metrics=await page.locator("#result-cards").innerText();
  const rows=await page.locator("#cut-table tbody").innerText();
  const decimalCsv=await downloadCutList(page);
  const svg=await page.locator("#dimension-svg svg").getAttribute("data-model-span-in");
  await length.fill("120 1/2");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(await page.locator("#result-cards").innerText()).toBe(metrics);
  expect(await page.locator("#cut-table tbody").innerText()).toBe(rows);
  expect(await downloadCutList(page)).toBe(decimalCsv);
  expect(await page.locator("#dimension-svg svg").getAttribute("data-model-span-in")).toBe(svg);
  await expect(page.locator("#print-input-table")).toContainText("120 1/2 in");
  await length.fill("120-1/2");
  expect(await page.locator("#result-cards").innerText()).toBe(metrics);
  await length.fill("120.5");
  expect(await page.locator("#result-cards").innerText()).toBe(metrics);
});

test("share URLs and local JSON backups serialize fractional inches as canonical decimals",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/deck-board-calculator/");
  const input=page.locator("#f-width");
  // Verify the actual field name exists rather than rely on appearance.
  await expect(input).toHaveCount(1);
  await input.fill("120 1/2");
  await expect(page.locator("#calc-error")).toBeHidden();
  const csv=await downloadCutList(page);
  const saved=await downloadBackup(page);
  expect(saved.inputs.find(row=>row.key==="width").value).toBe("120.5");
  await page.locator("#share-measurements").click();
  await expect(page.locator("#action-status")).toContainText("Measurement link copied");
  const link=await page.evaluate(()=>navigator.clipboard.readText());
  expect(link).toContain("f.width=120.5");
  expect(link).not.toContain("120+1%2F2");
  await page.goto(link);
  await expect(page.locator("#f-width")).toHaveValue("120.5");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(await downloadCutList(page)).toBe(csv);
  await page.locator("#f-width").fill("100");
  await page.locator("#load-measurements-json").setInputFiles({
    name:"saved-measurements.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(saved))
  });
  await expect(page.locator("#action-status")).toContainText("Local measurements restored");
  await expect(page.locator("#f-width")).toHaveValue("120.5");
  await expect(page.locator("#calc-error")).toBeHidden();
});

test("unit switching converts entered inch fractions before changing the displayed units",async({page})=>{
  await page.goto("/stud-calculator/");
  await page.locator("#f-length").fill("120 1/2");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(3060.7,5);
  await page.locator("#unit-select").selectOption("in");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(120.5,6);
  await page.locator("#unit-select").selectOption("ft");
  await expect(page.locator("#f-length")).toHaveAttribute("type","text");
  await page.locator("#f-length").fill("10 1/2");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#f-length")).toHaveAttribute("aria-invalid","true");
  await expect(page.locator("#download-csv")).toBeDisabled();
  await page.locator("#f-length").fill("10.5");
  await expect(page.locator("#calc-error")).toBeHidden();
});

test("malformed/improper fractions reject stale drawings and disable every export",async({page})=>{
  await page.goto("/hole-spacing-calculator/");
  const length=page.locator("#f-length");
  await expect(page.locator("#calc-error")).toBeHidden();
  for(const invalid of ["5 1/0","5 3/2","5 1/3","1/128","5-1/2-1/4"]){
    await length.fill(invalid);
    await expect(page.locator("#calc-error")).toBeVisible();
    await expect(length).toHaveAttribute("aria-invalid","true");
    await expect(page.locator("#dimension-svg svg")).toHaveCount(0);
    await expect(page.locator("#download-csv")).toBeDisabled();
    await expect(page.locator("#share-measurements")).toBeDisabled();
    await expect(page.locator("#download-measurements-json")).toBeDisabled();
  }
  await length.fill("120");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#download-csv")).toBeEnabled();
});
