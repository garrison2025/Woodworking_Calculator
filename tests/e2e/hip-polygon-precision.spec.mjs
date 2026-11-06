import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const csvRows=text=>{
  const parse=line=>{
    const out=[];let s="",quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'&&quoted&&line[i+1]==='"'){s+='"';i++;}
      else if(ch==='"')quoted=!quoted;
      else if(ch===","&&!quoted){out.push(s);s="";}
      else s+=ch;
    }
    out.push(s);return out;
  };
  const lines=text.replace(/^\uFEFF/,"").trim().split("\r\n"),headers=parse(lines[0]);
  return lines.slice(1).map(line=>{
    const values=parse(line);
    return Object.fromEntries(headers.map((key,i)=>[key,values[i]]));
  }).filter(row=>row[headers[0]]!=="Source note");
};
const svgPoints=el=>el.getAttribute("points").trim().split(/\s+/)
  .map(pair=>pair.split(",").map(Number));

test("real hip-roof SVG includes all 4 tiny corner cuts and agrees with numeric mm polygon CSV",async({page})=>{
  await page.goto("/hip-roof-calculator/");
  for(const [id,value] of Object.entries({
    width:"96",length:"192",pitch:"0",overhang:"0",
    sheetWidth:"48",sheetLength:"47.999999"
  }))await page.locator("#f-"+id).fill(value);
  await expect(page.locator("#calc-error")).toBeHidden();
  const cuts=page.locator("#dimension-svg svg .roof-panel-cut");
  await expect(cuts).toHaveCount(16);
  const shapes=await cuts.evaluateAll(els=>els.map(el=>({
    id:el.dataset.panel,plane:el.dataset.plane,
    points:el.getAttribute("points").trim().split(/\s+/)
      .map(pair=>pair.split(",").map(Number))
  })));
  expect(new Set(shapes.map(p=>p.plane)).size).toBe(4);
  const scale=Math.min(710/192,213/96);
  const origin=[(900-192*scale)/2,(344-96*scale)/2];
  await page.locator("#unit-select").selectOption("mm");
  const ready=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const exported=csvRows(readFileSync(await (await ready).path(),"utf8"));
  expect(exported).toHaveLength(16);
  const byId=new Map(exported.map(x=>[x.Item,x]));
  let tiny=0;
  for(const shape of shapes){
    const r=byId.get(shape.id);
    expect(r).toBeTruthy();
    const original=JSON.parse(r["Plan Projection Vertices (mm)"]);
    expect(original).toHaveLength(shape.points.length);
    for(const [i,point] of shape.points.entries()){
      expect((point[0]-origin[0])/scale*25.4).toBeCloseTo(original[i][0],3);
      expect((point[1]-origin[1])/scale*25.4).toBeCloseTo(original[i][1],3);
    }
    if(Number(r["Cut Area (m²)"])<1e-15){
      tiny++;
      expect(Number(r["Cut Area (m²)"])).toBeGreaterThan(0);
    }
  }
  expect(tiny).toBe(4);
  // Restore inch editing before setting a sub-coordinate-resolution polygon.
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-sheetLength").fill("47.99999998");
  await expect(page.locator("#calc-error")).toContainText("resolution");
  await expect(cuts).toHaveCount(0);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
});

test("hip stock-local polygon SVG coordinates stay consistent with exported reuse CSV",async({page})=>{
  await page.goto("/hip-roof-calculator/");
  for(const [id,value] of Object.entries({
    width:"96",length:"192",pitch:"0",overhang:"0",
    sheetWidth:"48",sheetLength:"47.999999",roofKerf:"0.125"
  }))await page.locator("#f-"+id).fill(value);
  await page.locator("#f-reuseMode").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  const pieces=page.locator("#roof-reuse-svg svg .roof-stock-cut");
  const boards=page.locator("#roof-reuse-svg svg .roof-stock-full");
  expect(await pieces.count()).toBeGreaterThan(0);
  const polygons=await pieces.evaluateAll(els=>els.map(el=>({
    item:el.dataset.item,stock:el.dataset.stock,
    points:el.getAttribute("points").trim().split(/\s+/)
      .map(pair=>pair.split(",").map(Number))
  })));
  const stockBoxes=await boards.evaluateAll(els=>els.map(el=>({
    stock:el.dataset.stock,
    x:Number(el.getAttribute("x")),y:Number(el.getAttribute("y")),
    width:Number(el.getAttribute("width")),height:Number(el.getAttribute("height"))
  })));
  const byStock=new Map(stockBoxes.map(box=>[box.stock,box]));
  await page.locator("#unit-select").selectOption("mm");
  const ready=page.waitForEvent("download");
  await page.locator("#download-roof-reuse-csv").click();
  const rows=csvRows(readFileSync(await (await ready).path(),"utf8"));
  expect(rows).toHaveLength(16);
  const byId=new Map(rows.map(row=>[row.Item,row]));
  for(const shape of polygons){
    const row=byId.get(shape.item),box=byStock.get(shape.stock);
    expect(row).toBeTruthy();
    expect(box).toBeTruthy();
    expect(row["Stock Id"]).toBe(shape.stock);
    const vertices=JSON.parse(row["Stock Cut Vertices (mm)"]);
    expect(vertices).toHaveLength(shape.points.length);
    const scale=box.width/47.999999;
    for(const [i,p] of shape.points.entries()){
      expect((p[0]-box.x)/scale*25.4).toBeCloseTo(vertices[i][0],3);
      expect((p[1]-box.y)/scale*25.4).toBeCloseTo(vertices[i][1],3);
    }
  }
  await page.locator("#f-roofKerf").fill("0.000000001");
  await expect(page.locator("#calc-error")).toContainText("kerf");
  await expect(pieces).toHaveCount(0);
  await expect(page.locator("#download-roof-reuse-csv")).toBeDisabled();
});
