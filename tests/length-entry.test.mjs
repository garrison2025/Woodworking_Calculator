import {test} from "node:test";
import assert from "node:assert/strict";
import {parseEditableLength,canonicalLengthText} from "../src/length-entry.mjs";

test("decimal lengths preserve their units and signed numeric values",()=>{
  for(const unit of ["in","ft","mm","cm","m"]){
    for(const [raw,expected] of [["5.5",5.5],[".125",.125],["-3.25",-3.25],["0",0],["1e-7",1e-7],["+12.",12]]){
      assert.equal(parseEditableLength(raw,unit),expected,unit+" "+raw);
    }
  }
});

test("US fractional-inch notation converts exactly to decimal inches",()=>{
  for(const [raw,expected] of [
    ["1/2",.5],["3/4",.75],["5 1/2",5.5],["5-1/2",5.5],
    ["-5 1/2",-5.5],["-5-1/2",-5.5],["-1/4",-.25],
    ["0 1/64",.015625],["+15 31/32",15.96875],["  4  1/8  ",4.125],
    ["1/64",.015625],["63/64",.984375]
  ]) {
    assert.equal(parseEditableLength(raw,"in"),expected,raw);
    assert.equal(canonicalLengthText(raw,"in"),String(expected),raw);
  }
});

test("fractions are rejected outside inch mode and cannot be mistaken for decimal feet",()=>{
  for(const unit of ["ft","mm","cm","m"]){
    for(const raw of ["5 1/2","3/4","5-1/2"])
      assert.equal(parseEditableLength(raw,unit),null,unit+" "+raw);
  }
});

test("fraction parsing rejects unsafe cut instructions and ambiguous notation",()=>{
  for(const raw of [
    "1/0","1/1","1/3","1/128","65/64","3/2","0/2",
    "5 2/2","5 3/4 in","5' 1/2","5/2/3","5--1/2",
    "5 - 1/2","5.1 1/2","5 1/-2","1 /2","1/ 2",
    "Infinity","NaN","0x10","12abc","1e500",
    "", " ".repeat(100),"1000000001 1/2",
    "<img src=x onerror=alert(1)>"
  ]){
    assert.equal(parseEditableLength(raw,"in"),null,raw);
    assert.throws(()=>canonicalLengthText(raw,"in"),/decimal length or.*fraction/i);
  }
});

test("inch fractions are exact binary increments that round-trip across decimals",()=>{
  for(let denominator=2;denominator<=64;denominator*=2){
    for(let numerator=1;numerator<denominator;numerator++){
      const n=parseEditableLength(`17 ${numerator}/${denominator}`,"in");
      assert.equal(n,17+numerator/denominator);
      assert.equal(parseEditableLength(canonicalLengthText(`17 ${numerator}/${denominator}`,"in"),"mm"),n);
    }
  }
});


test("quoted feet-and-inches entries preserve exact ruler fractions in inch mode",()=>{
  for(const [raw,expected] of [
    ["8'",96],["8' 3\"",99],["8'3 1/2\"",99.5],["8' 3-1/2\"",99.5],
    ["-1' 2 1/2\"",-14.5],["0' 3/4\"",.75],["+2' 0\"",24],
    ["3' 11 63/64\"",47.984375],["3' 11.75\"",47.75]
  ]){
    assert.equal(parseEditableLength(raw,"in"),expected,raw);
    assert.equal(canonicalLengthText(raw,"in"),String(expected),raw);
    for(const unit of ["ft","mm","cm","m"])
      assert.equal(parseEditableLength(raw,unit),null,unit+" "+raw);
  }
});

test("feet/inch entries reject missing or ambiguous marks and invalid inch fractions",()=>{
  for(const raw of [
    "8' 3", "8' 3/4", "8' 12\"", "8' 12.0\"", "8' -1/2\"",
    "8' +2\"", "8' 4/3\"", "8' 1/128\"", "8' 1/2\"\"",
    "8''", "8.5'", "1e2' 3\"", "8' 1' 2\"", "8' \"",
    "1000000001' 1\"", "8' 11 63/64\" 1/2"
  ]){
    assert.equal(parseEditableLength(raw,"in"),null,raw);
    assert.throws(()=>canonicalLengthText(raw,"in"),/decimal length/i,raw);
  }
});
