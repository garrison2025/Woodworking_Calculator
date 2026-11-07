import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute,convertFromInches,convertToInches} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";
const b={dimensionBasis:0,thickness:1,width:6,length:96,quantity:10,
 waste:10,priceBasis:0,boardFootRate:5.5,thousandBoardFootRate:5500,tax:8};
const metric=(r,name)=>{const m=r.metrics.find(x=>x.label===name);assert.ok(m,name);return m.value};
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,String(a)+" != "+b);
test("board foot quote rounds whole physical purchase quantity before tax",()=>{
 const r=compute("lumber-price-calculator",b);
 assert.equal(r.shape,"lumber-board");assert.equal(r.rows.length,1);
 near(metric(r,"Board feet per piece"),4);
 assert.equal(metric(r,"Entered piece count"),10);
 assert.equal(metric(r,"Whole purchased pieces including reserve"),11);
 near(metric(r,"Board feet before reserve"),40);
 near(metric(r,"Purchased board feet"),44);
 near(metric(r,"Effective price per board foot"),5.5);
 near(metric(r,"Subtotal before tax"),242);
 near(metric(r,"Tax amount"),19.36);
 near(metric(r,"Total quoted price"),261.36);
 assert.equal(r.rows[0].dimensionBasis,"Entered nominal");
 near(r.rows[0].orderedBoardFeet,44);
 near(r.lumberBoard.length,96);near(r.lumberBoard.width,6);
});
test("price per thousand board feet is exactly per board foot divided by 1000",()=>{
 const regular=compute("lumber-price-calculator",b),
   perThousand=compute("lumber-price-calculator",{...b,priceBasis:1,thousandBoardFootRate:5500});
 near(metric(regular,"Total quoted price"),metric(perThousand,"Total quoted price"));
 near(metric(perThousand,"Effective price per board foot"),5.5);
 const other=compute("lumber-price-calculator",{...b,priceBasis:1,thousandBoardFootRate:9250});
 near(metric(other,"Subtotal before tax"),44*9.25);
});
test("actual dressed dimensions are never guessed from nominal measurements",()=>{
 const nominal=compute("lumber-price-calculator",b);
 const actual=compute("lumber-price-calculator",{...b,dimensionBasis:1,thickness:.75,width:5.5});
 near(metric(nominal,"Board feet per piece"),4);
 near(metric(actual,"Board feet per piece"),2.75);
 near(metric(actual,"Purchased board feet"),30.25);
 near(metric(actual,"Subtotal before tax"),166.375);
 assert.equal(actual.rows[0].dimensionBasis,"Entered actual measured");
 const modeOnly=compute("lumber-price-calculator",{...b,dimensionBasis:1});
 near(metric(modeOnly,"Board feet per piece"),4);
});
test("small nonzero reserves round to whole purchased boards",()=>{
 const r=compute("lumber-price-calculator",{...b,quantity:1,waste:.1,tax:0});
 assert.equal(metric(r,"Whole purchased pieces including reserve"),2);
 near(metric(r,"Purchased board feet"),8);
 near(metric(r,"Total quoted price"),44);
 const noReserve=compute("lumber-price-calculator",{...b,quantity:1,waste:0,tax:0});
 assert.equal(metric(noReserve,"Whole purchased pieces including reserve"),1);
});
test("typed CSV preserves board-foot and monetary values, not linear dimensions",()=>{
 const r=compute("lumber-price-calculator",b);
 for(const u of ["in","mm","ft"]){
  const cols=scheduleColumns(r.rows,u);
  for(const field of ["Board Feet Per Piece","Ordered Board Feet","Price Per Board Foot","Subtotal","Tax Amount","Total Cost"]){
   assert.ok(cols.some(c=>c.label===field),field+" missing for "+u);
   assert.ok(cols.every(c=>c.label!==field+" ("+u+")"),field+" incorrectly typed as length");
  }
  const csv=buildScheduleCsv(r.rows,u,"USER SUPPLIED RATES; MBF=1000 BOARD FEET");
  assert.match(csv,/"44"/);assert.match(csv,/"261.36"/);assert.match(csv,/"Source note"/);
  assert.ok(!csv.includes("NaN"));
 }
});
test("invalid counts, rates, dimensions, tax and totals fail explicitly",()=>{
 for(const bad of [
  {thickness:0},{width:0},{length:0},{quantity:0},{quantity:1.5},
  {quantity:5001},{waste:-1},{waste:101},{tax:-1},{tax:101},
  {priceBasis:3},{dimensionBasis:2},{boardFootRate:-1},
  {priceBasis:1,thousandBoardFootRate:-5},{length:1e-9},{width:1e-9},
  {thickness:1e8,width:1e8},{boardFootRate:1e8}
 ]){
  const r=safeCompute("lumber-price-calculator",{...b,...bad});
  assert.equal(r.ok,false,JSON.stringify(bad));
 }
});
test("lumber volume and purchase cost hold across in/mm/ft/cm/m round trips",()=>{
 const r=compute("lumber-price-calculator",b);
 for(const unit of ["in","mm","ft","cm","m"]){
  const moved={...b};
  for(const field of ["thickness","width","length"])
   moved[field]=convertToInches(convertFromInches(b[field],unit),unit);
  const other=compute("lumber-price-calculator",moved);
  near(metric(other,"Purchased board feet"),metric(r,"Purchased board feet"),1e-8);
  near(metric(other,"Total quoted price"),metric(r,"Total quoted price"),1e-6);
 }
});

test("unquoted orders report board feet and leave CSV price cells empty",()=>{
 for(const input of [{...b,boardFootRate:0},{...b,priceBasis:1,thousandBoardFootRate:0}]){
  const result=compute("lumber-price-calculator",input);
  near(metric(result,"Board feet per piece"),4);
  near(metric(result,"Purchased board feet"),44);
  assert.equal(result.metrics.some(m=>m.kind==="C"),false);
  assert.equal(result.rows[0].totalCost,null);
  assert.match(buildScheduleCsv(result.rows,"in").split("\r\n")[1],/,"44","","","",""$/);
 }
});
