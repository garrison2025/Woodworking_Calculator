import {test,expect} from "@playwright/test";
import {readFileSync,statSync} from "node:fs";

const registry=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8"));
const tools=registry.tools.filter(t=>t.priority==="P0"||t.priority==="P1");

test("homepage renders tool search and recent history without downloading calculator engines",async({page})=>{
  const requests=[];
  page.on("request",request=>requests.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect(page.locator("#tool-search-status")).toHaveText("Showing 31 of 31 tools");
  expect(requests).toContain("/assets/home.mjs");
  for(const path of ["/assets/app.mjs","/assets/calcs.mjs","/assets/cut-list.mjs",
    "/assets/framing-stations.mjs","/assets/framing-review-versions.mjs","/assets/tools.json"])
    expect(requests,"Homepage unexpectedly fetched "+path).not.toContain(path);
  await page.getByLabel("Find a calculator").fill("crown molding");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(1);
  await page.getByLabel("Find a calculator").fill("");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(31);
  await page.goto("/roof-pitch-calculator/");
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  await page.waitForFunction(()=>localStorage.getItem("woodwork-recent")?.includes("roof-pitch-calculator"));
  await page.goto("/");
  await expect(page.locator("#recent-links a")).toHaveCount(1);
  await expect(page.locator("#recent-links a")).toHaveText(["Roof Pitch in Degrees & Percent ↗"]);
  await page.getByRole("button",{name:"Clear history"}).click();
  await expect(page.locator("#recent-tools")).toBeHidden();
  await page.reload();
  await expect(page.locator("#recent-tools")).toBeHidden();
});

test("tool runtime downloads only its matching compact config, never all 31 definitions",async({page})=>{
  const fullBytes=statSync(new URL("../../src/tools.json",import.meta.url)).size;
  for(const slug of ["framing-calculator","deck-board-calculator","spiral-staircase-calculator"]){
    const requested=[];
    page.on("request",req=>requested.push(new URL(req.url()).pathname));
    const response=await page.goto("/"+slug+"/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(page.locator("#result-cards .metric").first()).toBeVisible();
    expect(requested).toContain("/assets/tool-config/"+slug+".json");
    expect(requested).not.toContain("/assets/tools.json");
    const configResponse=await page.request.get("/assets/tool-config/"+slug+".json");
    expect(configResponse.status()).toBe(200);
    const bytes=await configResponse.body();
    expect(bytes.length).toBeLessThan(fullBytes/2);
    const config=JSON.parse(bytes.toString("utf8"));
    expect(config).toEqual(tools.find(t=>t.slug===slug));
    await expect(page.locator("#download-csv")).toBeEnabled();
  }
});

test("static category and legal pages do not fetch tool-specific scripts or registry",async({page})=>{
  for(const url of ["/framing/","/decks-and-railings/","/privacy/","/about/"]){
    const js=[];
    page.on("request",r=>{
      if(/\.(?:mjs|json)(?:\?|$)/.test(r.url()))js.push(new URL(r.url()).pathname);
    });
    const response=await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(js).toEqual([]);
  }
});
