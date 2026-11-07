import {test} from "node:test";
import assert from "node:assert/strict";
import {createMeasurementFragment,parseMeasurementFragment} from "../src/measurement-links.mjs";

const fields=[{key:"wallLength",value:"120.25"},{key:"gap",value:"0.125"},{key:"count",value:"4"}];
const make=(override={})=>createMeasurementFragment({
  unit:"mm",fraction:"32",fields,...override
});
test("share fragment round-trips exact numeric input strings",()=>{
  const fragment=make();
  assert.ok(fragment.startsWith("#measure=v=1&u=mm&p=32&"));
  assert.deepEqual(parseMeasurementFragment(fragment,fields),{
    unit:"mm",fraction:"32",currency:null,
    inputs:{wallLength:"120.25",gap:"0.125",count:"4"}
  });
  assert.equal(parseMeasurementFragment("#methods",fields),null);
});
test("currency choices are whitelisted; default no-currency pages reject c",()=>{
  const fragment=make({currency:"USD"});
  assert.equal(parseMeasurementFragment(fragment,fields,["USD","EUR"]).currency,"USD");
  assert.throws(()=>parseMeasurementFragment(fragment,fields),/incomplete or duplicate/);
  assert.throws(()=>parseMeasurementFragment(fragment,fields,["EUR"]),/currency/);
  assert.throws(()=>make({currency:"<USD>"}),/currency/);
});
test("partial, duplicate, unknown, nonfinite, malformed and unsupported fragments fail closed",()=>{
  const valid=make();
  for(const candidate of [
    valid.replace(/&f\.gap=[^&]+/,""),
    valid+"&f.gap=2",
    valid+"&admin=1",
    valid.replace("v=1","v=2"),
    valid.replace("u=mm","u=x"),
    valid.replace("p=32","p=8"),
    valid.replace("f.gap=0.125","f.gap="),
    valid.replace("f.gap=0.125","f.gap=1e309"),
    valid.replace("f.gap=0.125","f.gap=%3Cscript%3E")
  ])assert.throws(()=>parseMeasurementFragment(candidate,fields));
});
test("export validation rejects invalid numeric values and duplicate input keys",()=>{
  assert.throws(()=>make({fields:[...fields.slice(0,2),{key:"gap",value:"4"}]}),/keys/);
  assert.throws(()=>make({fields:[fields[0],{...fields[1],value:"Infinity"},fields[2]]}),/measurement/);
  assert.throws(()=>make({fields:[fields[0],{...fields[1],value:"0x10"},fields[2]]}),/measurement/);
});
test("large fragments do not parse or serialize",()=>{
  const huge="#measure="+"a".repeat(6001);
  assert.throws(()=>parseMeasurementFragment(huge,fields),/too long/);
});
