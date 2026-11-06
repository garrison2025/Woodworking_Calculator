import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

function parseCsv(csv){
  const raw=csv.replace(/^\uFEFF/,"").trim().split("\r\n");
  const row=line=>{
    const items=[];let cell="",quote=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'&&quote&&line[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')quote=!quote;
      else if(c===","&&!quote){items.push(cell);cell="";}
      else cell+=c;
    }
    items.push(cell);
    return items;
  };
  const head=row(raw[0]);
  return raw.slice(1).map(line=>{
    const cells=row(line);
    return Object.fromEntries(head.map((k,i)=>[k,cells[i]]));
  }).filter(x=>x[head[0]]!=="Source note");
}
const downloadRows=async page=>{
  const event=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  return parseCsv(readFileSync(await (await event).path(),"utf8"));
};

test("kerf SVG rectangles are positioned from exported slot edges and thickness",async({page})=>{
  await page.goto("/kerf-bending-calculator/");
  await page.locator("#f-radius").fill("6.25");
  await page.locator("#f-angle").fill("135");
  await page.locator("#f-web").fill("0.1875");
  await expect(page.locator("#calc-error")).toBeHidden();
  const stock=page.locator("#dimension-svg svg .kerf-stock");
  const cuts=page.locator("#dimension-svg svg .kerf-slot");
  const stockAttrs=await stock.evaluate(el=>({
    x:+el.getAttribute("x"),width:+el.getAttribute("width"),
    y:+el.getAttribute("y"),height:+el.getAttribute("height"),
    arc:+el.dataset.arcIn,thickness:+el.dataset.thicknessIn
  }));
  const slots=await cuts.evaluateAll(els=>els.map(el=>({
    center:+el.dataset.centerIn,left:+el.dataset.leftIn,right:+el.dataset.rightIn,
    depth:+el.dataset.cutDepthIn,web:+el.dataset.retainedWebIn,
    x:+el.getAttribute("x"),y:+el.getAttribute("y"),
    width:+el.getAttribute("width"),height:+el.getAttribute("height")
  })));
  expect(slots.length).toBeGreaterThan(2);
  await page.locator("#unit-select").selectOption("mm");
  const rows=await downloadRows(page);
  expect(rows).toHaveLength(slots.length);
  const scale=stockAttrs.width/stockAttrs.arc;
  for(let i=0;i<slots.length;i++){
    const slot=slots[i],r=rows[i];
    expect(slot.center*25.4).toBeCloseTo(+r["Position (mm)"],5);
    expect(slot.left*25.4).toBeCloseTo(+r["Slot Left (mm)"],5);
    expect(slot.right*25.4).toBeCloseTo(+r["Slot Right (mm)"],5);
    expect(slot.depth*25.4).toBeCloseTo(+r["Cut Depth (mm)"],5);
    expect(slot.web*25.4).toBeCloseTo(+r["Retained Web (mm)"],5);
    expect(slot.x).toBeCloseTo(stockAttrs.x+slot.left*scale,6);
    expect(slot.width).toBeCloseTo((slot.right-slot.left)*scale,6);
    expect(slot.y).toBeCloseTo(stockAttrs.y,6);
    expect(slot.height).toBeCloseTo(slot.depth/stockAttrs.thickness*stockAttrs.height,6);
    if(i>0)expect(slot.left).toBeGreaterThan(slots[i-1].right);
  }
});

test("crown SVG plan and bevel rays reproduce the same angular CSV",async({page})=>{
  await page.goto("/crown-molding-calculator/");
  await page.locator("#f-spring").fill("45");
  await page.locator("#f-corner").fill("90");
  await page.locator("#f-inside").selectOption("0");
  await page.locator("#f-left").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  const plan=page.locator("#dimension-svg svg .crown-miter-ray");
  const bevel=page.locator("#dimension-svg svg .crown-bevel-ray");
  const p=await plan.evaluate(el=>({
    sign:+el.dataset.sign,miter:+el.dataset.magnitudeDeg,turn:+el.dataset.planTurnDeg,
    x1:+el.getAttribute("x1"),x2:+el.getAttribute("x2"),
    y1:+el.getAttribute("y1"),y2:+el.getAttribute("y2")
  }));
  const b=await bevel.evaluate(el=>({
    angle:+el.dataset.bevelDeg,
    x1:+el.getAttribute("x1"),x2:+el.getAttribute("x2"),
    y1:+el.getAttribute("y1"),y2:+el.getAttribute("y2")
  }));
  expect(p.sign).toBe(-1);
  expect(p.turn).toBeCloseTo(-p.miter,9);
  expect(Math.atan2(-(p.y2-p.y1),p.x2-p.x1)*180/Math.PI).toBeCloseTo(p.turn,8);
  expect(Math.atan2(-(b.y2-b.y1),b.x2-b.x1)*180/Math.PI).toBeCloseTo(b.angle,8);
  await page.locator("#unit-select").selectOption("mm");
  const rows=await downloadRows(page);
  expect(rows).toHaveLength(1);
  expect(+rows[0]["Miter Magnitude Angle (°)"]).toBeCloseTo(p.miter,8);
  expect(+rows[0]["Bevel Magnitude Angle (°)"]).toBeCloseTo(b.angle,8);
  expect(+rows[0]["Illustrative Miter Angle (°)"]).toBeCloseTo(p.turn,8);
  expect(await page.locator("#dimension-svg svg").textContent()).toContain("NOT SAW SETTING");
});

test("stringer nominal SVG riser/tread corners match all metric CSV datums",async({page})=>{
  await page.goto("/stair-stringer-calculator/");
  await page.locator("#f-rise").fill("95");
  await page.locator("#f-risers").fill("14");
  await page.locator("#f-tread").fill("11");
  await expect(page.locator("#calc-error")).toBeHidden();
  const line=page.locator("#dimension-svg svg .stringer-step-profile");
  const vertex=await line.evaluate(el=>({
    points:el.getAttribute("points").trim().split(/\s+/).map(pair=>pair.split(",").map(Number)),
    scale:+el.dataset.svgScale,ox:+el.dataset.originX,oy:+el.dataset.originY
  }));
  expect(vertex.points).toHaveLength(28);
  await page.locator("#unit-select").selectOption("mm");
  const rows=await downloadRows(page);
  expect(rows).toHaveLength(14);
  for(let i=0;i<rows.length;i++){
    const run=+rows[i]["Horizontal Run (mm)"]/25.4,
      top=+rows[i]["Riser Top Height (mm)"]/25.4;
    const p=vertex.points[2*i+1];
    expect(p[0]).toBeCloseTo(vertex.ox+run*vertex.scale,5);
    expect(p[1]).toBeCloseTo(vertex.oy-top*vertex.scale,5);
    if(i<rows.length-1){
      const next=vertex.points[2*i+2];
      const treadEnd=+rows[i]["Tread End (mm)"]/25.4;
      expect(next[0]).toBeCloseTo(vertex.ox+treadEnd*vertex.scale,5);
      expect(next[1]).toBeCloseTo(p[1],5);
    }
  }
});
