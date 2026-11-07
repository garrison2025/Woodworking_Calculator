// Portable, local-only input snapshots for one calculator. File data contains
// numeric form inputs and display choices, never site measurements, human
// inspections, structural approvals or purchasing authorization.
import {createMeasurementFragment,parseMeasurementFragment} from "./measurement-links.mjs";

const FORMAT="woodworking-measurements-v1";
const MAX_CHARS=12000;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELDS=["format","calculator","unit","fraction","currency","inputs"];
const isRecord=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const hasExactKeys=(obj,keys)=>isRecord(obj)&&
  Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));

export function buildMeasurementFile({slug,unit,fraction,currency=null,fields}){
  if(typeof slug!=="string"||!SLUG.test(slug))throw Error("Invalid calculator identity.");
  const fragment=createMeasurementFragment({unit,fraction,currency,fields});
  const doc={
    format:FORMAT,calculator:slug,unit,fraction:String(fraction),currency,
    inputs:Object.fromEntries(fields.map(f=>[f.key,String(f.value).trim()]))
  };
  // Validate identical data by the existing link codec. A JSON backup and a
  // shared link must never implement two competing numeric validation rules.
  if(!fragment.startsWith("#measure="))throw Error("Invalid measurement snapshot.");
  const serialized=JSON.stringify(doc,null,2)+"\n";
  if(serialized.length>MAX_CHARS)throw Error("Measurement file exceeds size limit.");
  return serialized;
}

export function parseMeasurementFile(content,{slug,fields,allowedCurrencies=[]}){
  if(typeof content!=="string"||content.length>MAX_CHARS)
    throw Error("Measurement file is too large or unreadable.");
  let doc;
  try{doc=JSON.parse(content.replace(/^\uFEFF/,""));}
  catch{throw Error("Measurement file is not valid JSON.");}
  if(!hasExactKeys(doc,FIELDS)||doc.format!==FORMAT)
    throw Error("Unsupported or altered measurement file.");
  if(doc.calculator!==slug||typeof slug!=="string"||!SLUG.test(slug))
    throw Error("Measurement file is for a different calculator.");
  if(!isRecord(doc.inputs)||!Array.isArray(fields)||
    !hasExactKeys(doc.inputs,fields.map(f=>f.key)))
    throw Error("Measurement file has missing, extra or duplicated input fields.");
  // Strictly require editable numeric strings rather than coercing arbitrary
  // JSON objects or booleans. Missing/NaN/Infinity values are not accepted.
  if(Object.values(doc.inputs).some(v=>typeof v!=="string"))
    throw Error("Measurement file contains non-text numeric fields.");
  if(typeof doc.unit!=="string"||typeof doc.fraction!=="string"||
    (doc.currency!==null&&typeof doc.currency!=="string"))
    throw Error("Measurement file contains invalid display settings.");
  const fragment=createMeasurementFragment({
    unit:doc.unit,fraction:doc.fraction,currency:doc.currency,
    fields:fields.map(f=>({key:f.key,value:doc.inputs[f.key]}))
  });
  const snapshot=parseMeasurementFragment(fragment,fields,allowedCurrencies);
  if(!snapshot)throw Error("Measurement file cannot be decoded.");
  return snapshot;
}
