/**
 * Deterministic, Excel-friendly measurement schedules.
 * Engine coordinates are always inches; this module applies the selected
 * display unit ONLY at the CSV boundary, avoiding repeated rounding.
 */
import {convertFromInches} from "./calcs.mjs";

const UNITS=new Set(["in","ft","mm","cm","m"]);
const numeric=(n)=>Number(n.toPrecision(12)).toString();
const csvEscape=(value,isNumeric=false)=>{
  let text=String(value??"");
  // Spreadsheet programs can evaluate formulas in untrusted labels.
  if(!isNumeric && /^[\s\u0000-\u001f]*[=+@\-]/u.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};
const titleCase=(key)=>key.replace(/([A-Z])/g," $1").replace(/^./,ch=>ch.toUpperCase());
const fieldType=(key,records)=>{
  if(key==="cutAreaFt2")return "area";
  if(key==="cutVertices")return "vertices";
  if(!records.some(r=>typeof r[key]==="number"))return "plain";
  // Ring/segment indexes are counts, never lengths. Angular sweeps are degrees.
  if(/(?:angle|degrees|deg)$/i.test(key))return "angle";
  if(/^(?:count|ring|rings|segment|segments|index|row|column|quantity|pieces|risers|treads|planeIndex)$/i.test(key))return "plain";
  return "length";
};
const unitLabel=(kind,unit)=>{
  if(kind==="area")return ["in","ft"].includes(unit)?"ft²":"m²";
  if(kind==="angle")return "°";
  if(kind==="vertices"||kind==="length")return unit;
  return null;
};
const converted=(key,value,kind,unit)=>{
  if(value===null||value===undefined)return "";
  if(kind==="vertices"&&Array.isArray(value))
    return JSON.stringify(value.map(pair=>pair.map(v=>Number(numeric(convertFromInches(v,unit))))));
  if(kind==="area"&&typeof value==="number")
    return numeric(["in","ft"].includes(unit)?value:value*.09290304);
  if(kind==="length"&&typeof value==="number")
    return numeric(convertFromInches(value,unit));
  if(typeof value==="number")return numeric(value);
  return String(value);
};

/**
 * @returns {string} Excel-compatible RFC4180 quoted CSV, with BOM and CRLF.
 * Header physical units match the selected unit. Numeric cells are plain
 * numbers (no localized commas, suffixes or fraction rounding).
 * The final "Source note" row is explicitly non-schedule metadata.
 */
export function buildScheduleCsv(records,unit,sourceNote=""){
  if(!UNITS.has(unit))throw Error("Unsupported unit.");
  if(!Array.isArray(records)||!records.length)throw Error("No schedule available.");
  const keys=[...new Set(records.flatMap(row=>Object.keys(row)))];
  const kinds=keys.map(k=>fieldType(k,records));
  const head=keys.map((k,i)=>{
    const label= k==="cutAreaFt2"?"Cut Area":k==="cutVertices"?"Cut Vertices":titleCase(k);
    const selected=unitLabel(kinds[i],unit);
    return label+(selected?" ("+selected+")":"");
  });
  const lines=[head.map(csvEscape).join(",")];
  for(const row of records)
    lines.push(keys.map((key,i)=>csvEscape(converted(key,row[key],kinds[i],unit),typeof row[key]==="number")).join(","));
  // Keep metadata on one final row for CSV column-count consistency.
  const note=keys.map((key,i)=>csvEscape(i===0?"Source note":i===1?sourceNote:"")).join(",");
  lines.push(note);
  return "\uFEFF"+lines.join("\r\n")+"\r\n";
}
