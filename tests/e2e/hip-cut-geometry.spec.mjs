import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const parseLine=(line)=>{
  let field="",quoted=false;const cells=[];
  for(let i=0;i<line.length;i++){
    if(line[i]==='"'){
      if(quoted&&line[i+1]==='"'){field+='"';i++;}
      else quoted=!quoted;
    }else if(line[i]===","&&!quoted){cells.push(field);field="";}
    else field+=line[i];
  }
  cells.push(field);return cells;
};
const polygon=(raw)=>raw.trim().split(/\s+/).map(v=>v.split(",").map(Number));
const shoelace=(p)=>Math.abs(p.reduce((s,v,i)=>{
  const q=p[(i+1)%p.length];return s+v[0]*q[1]-q[0]*v[1];
},0))/2;

test("hip-roof CSV plan projection points are precisely the rendered SVG polygon vertices",async({page})=>{
  await page.goto("/hip-roof-calculator/");
  for(const [key,v] of [["width","96"],["length","192"],["pitch","0"],["overhang","0"]])
    await page.locator("#f-"+key).fill(v);
  await expect(page.locator("#calc-error")).toBeHidden();
  const faces=page.locator("#dimension-svg svg .roof-panel-cut");
  await expect(faces).toHaveCount(6);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(6);
  await expect(page.locator("#cut-table thead")).toContainText("Cut Vertices (in)");
  await expect(page.locator("#cut-table thead")).toContainText("Plan Projection Vertices (in)");
  await expect(page.locator("#cut-table thead")).toContainText("Offcut Area (ft²)");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Stock face area before allowance"})).toContainText("192 ft²");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Unreused stock area"})).toContainText("64 ft²");

  const pending=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await pending).path(),"utf8").replace(/^\uFEFF/,"");
  const lines=csv.trimEnd().split("\r\n");
  expect(lines).toHaveLength(8); // one header, six sheet polygons, one source note
  const cols=parseLine(lines[0]);
  const expectedScale=Math.min(710/192,213/96);
  const x0=(900-192*expectedScale)/2,y0=(344-96*expectedScale)/2;
  const used=[];
  for(let i=0;i<6;i++){
    const cells=parseLine(lines[i+1]);
    const get=key=>cells[cols.indexOf(key)];
    const id=get("Item");
    const plot=polygon(await faces.nth(i).getAttribute("points"));
    const projected=JSON.parse(get("Plan Projection Vertices (in)"));
    const local=JSON.parse(get("Cut Vertices (in)"));
    expect(id).toBe("S"+(i+1));
    await expect(faces.nth(i)).toHaveAttribute("data-panel",id);
    await expect(faces.nth(i)).toHaveAttribute("data-plane",String(["North slope","South slope","West hip","East hip"].indexOf(get("Plane"))));
    expect(Number(get("Row"))).toBeGreaterThan(0);
    expect(Number(get("Column"))).toBeGreaterThan(0);
    expect(plot.length).toBe(projected.length);
    expect(local.length).toBe(projected.length);
    for(let k=0;k<plot.length;k++){
      expect(plot[k][0]).toBeCloseTo(x0+projected[k][0]*expectedScale,5);
      expect(plot[k][1]).toBeCloseTo(y0+projected[k][1]*expectedScale,5);
      const next=plot[(k+1)%plot.length];
      expect(Math.hypot(plot[k][0]-next[0],plot[k][1]-next[1])).toBeGreaterThan(1e-6);
    }
    const cutArea=Number(get("Cut Area (ft²)"))*144;
    used.push(cutArea);
    expect(shoelace(plot)/(expectedScale*expectedScale)).toBeCloseTo(cutArea,5);
    expect(Number(get("Offcut Area (ft²)"))+Number(get("Cut Area (ft²)"))).toBeCloseTo(32,8);
  }
  expect(used.reduce((s,v)=>s+v,0)).toBeCloseTo(192*96,5);
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Cut Vertices (mm)");
  await expect(page.locator("#cut-table thead")).toContainText("Plan Projection Vertices (mm)");
  await expect(page.locator("#cut-table thead")).toContainText("Offcut Area (m²)");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const metric=readFileSync(await (await dl).path(),"utf8");
  expect(metric).toContain('"Cut Vertices (mm)","Plan Projection Vertices (mm)"');
  expect(metric).toContain('"Cut Area (m²)","Offcut Area (m²)"');
  await page.locator("#f-sheetLength").fill("0.001");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(faces).toHaveCount(0);
});

test("square pitched hip roof has no repeated zero-length polygon cutting edges",async({page})=>{
  await page.goto("/hip-roof-calculator/");
  for(const [key,value] of [
    ["width","144"],["length","144"],["pitch","6"],["overhang","0"]
  ])await page.locator("#f-"+key).fill(value);
  await page.locator("#f-orientation").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  const polys=page.locator("#dimension-svg svg .roof-panel-cut");
  await expect(polys).toHaveCount(12);
  for(let i=0;i<12;i++){
    const points=polygon(await polys.nth(i).getAttribute("points"));
    expect(points.length).toBeGreaterThanOrEqual(3);
    for(let j=0;j<points.length;j++){
      const a=points[j],b=points[(j+1)%points.length];
      expect(Math.hypot(a[0]-b[0],a[1]-b[1])).toBeGreaterThan(1e-6);
    }
  }
  await expect(page.locator("#cut-table thead")).toContainText("Offcut Area (ft²)");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(12);
});
