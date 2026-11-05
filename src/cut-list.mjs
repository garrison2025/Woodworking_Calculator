/**
 * Deterministic, Excel-friendly measurement schedules.
 * Engine coordinates are always inches; this module applies the selected
 * display unit ONLY at the CSV boundary, avoiding repeated rounding.
 */
import {convertFromInches} from "./calcs.mjs";

const UNITS=new Set(["in","ft","mm","cm","m"]);
const numeric=(n)=>Number(n.toPrecision(12)).toString();
// The geometry engine stores coordinates quantized to 1e-8 inch. Translating
// that to mm can expose harmless 1e-7 mm conversion tails (e.g. 4.999999906).
// Normalize only exported metric lengths well below woodworking resolution;
// never round actual engine geometry or change machine-readable unit headers.
const outputLength=(inches,unit)=>{
  const v=convertFromInches(inches,unit);
  const digits={mm:6,cm:7,m:10}[unit];
  return numeric(digits===undefined?v:Number(v.toFixed(digits)));
};
const csvEscape=(value,isNumeric=false)=>{
  let text=String(value??"");
  // Spreadsheet programs can evaluate formulas in untrusted labels.
  if(!isNumeric && /^[\s\u0000-\u001f]*[=+@\-]/u.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};
const titleCase=(key)=>key.replace(/([A-Z])/g," $1").replace(/^./,ch=>ch.toUpperCase());
const fieldType=(key,records)=>{
  if(/AreaFt2$/.test(key))return "area";
  if(key==="cutVertices"||key==="planVertices")return "vertices";
  if(!records.some(r=>typeof r[key]==="number"))return "plain";
  // Ring/segment indexes are counts, never lengths. Angular sweeps are degrees.
  if(/(?:angle|degrees|deg)$/i.test(key))return "angle";
  if(/^(?:count|ring|rings|segment|segments|index|row|column|quantity|pieces|risers|treads|planeIndex)$/i.test(key))return "plain";
  // Purchase quantities and user-quoted currency amounts are NOT dimensions.
  // Their denomination appears in the separate currency column, never "(in)".
  if(/(?:Sticks|Price|Cost|Quantity|Count|Packs|PiecesPerRow|PerContact|References|Seams|Contacts|rowNumber)$/i.test(key))return "plain";
  return "length";
};
const unitLabel=(kind,unit)=>{
  if(kind==="area")return ["in","ft"].includes(unit)?"ft²":"m²";
  if(kind==="angle")return "°";
  if(kind==="vertices"||kind==="length")return unit;
  return null;
};
export const scheduleColumns=(records,unit)=>{
  if(!UNITS.has(unit))throw Error("Unsupported unit.");
  if(!Array.isArray(records))throw Error("Invalid schedule.");
  return [...new Set(records.flatMap(row=>Object.keys(row)))].map(key=>{
    const kind=fieldType(key,records);
    const label=key==="cutAreaFt2"?"Cut Area":key==="offcutAreaFt2"?"Offcut Area":key==="cutVertices"?"Cut Vertices":key==="planVertices"?"Plan Projection Vertices":titleCase(key);
    const suffix=unitLabel(kind,unit);
    return {key,kind,label:label+(suffix?" ("+suffix+")":"")};
  });
};
const converted=(key,value,kind,unit)=>{
  if(value===null||value===undefined)return "";
  if(kind==="vertices"&&Array.isArray(value))
    return JSON.stringify(value.map(pair=>pair.map(v=>Number(outputLength(v,unit)))));
  if(kind==="area"&&typeof value==="number")
    return numeric(["in","ft"].includes(unit)?value:value*.09290304);
  if(kind==="length"&&typeof value==="number")
    return outputLength(value,unit);
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
  const columns=scheduleColumns(records,unit);
  const lines=[columns.map(col=>csvEscape(col.label)).join(",")];
  for(const row of records)
    lines.push(columns.map(col=>csvEscape(converted(col.key,row[col.key],col.kind,unit),typeof row[col.key]==="number")).join(","));
  // Keep metadata on one final row for CSV column-count consistency.
  const note=columns.map((col,i)=>csvEscape(i===0?"Source note":i===1?sourceNote:"")).join(",");
  lines.push(note);
  return "\uFEFF"+lines.join("\r\n")+"\r\n";
}
