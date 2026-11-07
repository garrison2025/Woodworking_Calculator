import {test} from "node:test";
import assert from "node:assert/strict";
import {buildMeasurementFile,parseMeasurementFile} from "../src/measurement-files.mjs";

const slug="deck-board-calculator";
const fields=[{key:"coverage",value:"120.125"},{key:"boardWidth",value:"5.50"},{key:"gap",value:"0.125"}];
const make=(opts={})=>buildMeasurementFile({slug,unit:"in",fraction:"32",fields,...opts});
const parse=(text,opts={})=>parseMeasurementFile(text,{slug,fields,...opts});
const alter=(fn)=>{
  const doc=JSON.parse(make());
  fn(doc);
  return JSON.stringify(doc);
};

test("readable local JSON round-trips every exact numeric string and the display settings",()=>{
  const content=make();
  const doc=JSON.parse(content);
  assert.equal(doc.format,"woodworking-measurements-v1");
  assert.equal(doc.calculator,slug);
  assert.deepEqual(doc.inputs,fields);
  assert.deepEqual(parse(content),{
    unit:"in",fraction:"32",currency:null,
    inputs:{coverage:"120.125",boardWidth:"5.50",gap:"0.125"}
  });
  assert.doesNotMatch(content,/inspection|authorized|approved|purchaseReviewDraft/i);
  assert.deepEqual(parse("\uFEFF"+content),parse(content));
});

test("currency labels round-trip but cannot be invented for tools without currency choice",()=>{
  const saved=make({currency:"CAD",unit:"mm"});
  assert.equal(parse(saved,{allowedCurrencies:["USD","CAD"]}).currency,"CAD");
  assert.throws(()=>parse(saved),/incomplete or duplicate/);
  assert.throws(()=>parse(saved,{allowedCurrencies:["USD"]}),/currency/);
});

test("malformed, wrong-tool, wrong-version and oversized files cannot import",()=>{
  assert.throws(()=>parse("{broken"),/valid JSON/);
  assert.throws(()=>parse(make(),{slug:"rafter-calculator"}),/different calculator/);
  assert.throws(()=>parse(alter(doc=>doc.format="woodworking-measurements-v2")) ,/Unsupported/);
  assert.throws(()=>parse(alter(doc=>doc.approved=true)),/Unsupported/);
  assert.throws(()=>parse(" ".repeat(12001)),/too large/);
});

test("no missing, duplicated, unknown or altered rows may be silently accepted",()=>{
  assert.throws(()=>parse(alter(doc=>doc.inputs.pop())),/rows/);
  assert.throws(()=>parse(alter(doc=>doc.inputs.push({...doc.inputs[0]}))),/rows/);
  assert.throws(()=>parse(alter(doc=>doc.inputs[1].key=doc.inputs[0].key)),/duplicated/);
  assert.throws(()=>parse(alter(doc=>doc.inputs[0].key="alien")),/duplicated/);
  assert.throws(()=>parse(alter(doc=>doc.inputs[0].extra="BAD")),/rows/);
  assert.throws(()=>parse(alter(doc=>doc.inputs[0].value=1)),/rows/);
});

test("numeric and display tampering use exactly the same validator as shared URL fragments",()=>{
  for(const bad of ["Infinity","NaN","0x10","","1e400","<img onerror=alert(1)>"]){
    assert.throws(()=>parse(alter(doc=>doc.inputs[0].value=bad)),/measurement/);
  }
  assert.throws(()=>parse(alter(doc=>doc.unit="yards")),/display options/);
  assert.throws(()=>parse(alter(doc=>doc.fraction="64")),/display options/);
  assert.throws(()=>parse(alter(doc=>doc.currency="USD")),/incomplete or duplicate/);
});

test("save rejects malformed decimal input and nonstandard calculator identity",()=>{
  assert.throws(()=>make({slug:"../framing-calculator"}),/identity/);
  assert.throws(()=>make({fields:[{...fields[0],value:"1e1000"},...fields.slice(1)]}),/measurement/);
  assert.throws(()=>make({fields:[...fields,{key:"gap",value:"5"}]}),/keys/);
});
