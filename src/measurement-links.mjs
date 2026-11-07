// A share link carries ONLY the selected unit, precision, currency label,
// and numeric calculator inputs. URL fragments are never sent in HTTP requests.
// There is no remote persistence or implied field/structural approval.
const PREFIX="#measure=";
const UNITS=new Set(["in","ft","mm","cm","m"]);
const FRACTIONS=new Set(["16","32"]);
const NUMERIC=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const MAX_FRAGMENT=6000;
const MAX_VALUE=40;

const checkFields=fields=>{
  if(!Array.isArray(fields)||!fields.length||fields.length>100)throw Error("Invalid calculator input registry.");
  const keys=fields.map(f=>f.key);
  if(new Set(keys).size!==keys.length||keys.some(k=>!/^[A-Za-z][A-Za-z0-9]*$/.test(k)))
    throw Error("Invalid calculator input keys.");
  return keys;
};
const numericText=value=>{
  const raw=String(value).trim();
  if(!raw||raw.length>MAX_VALUE||!NUMERIC.test(raw)||!Number.isFinite(Number(raw)))
    throw Error("Invalid shared measurement.");
  return raw;
};

export function createMeasurementFragment({unit,fraction,currency=null,fields}){
  const keys=checkFields(fields);
  if(!UNITS.has(unit)||!FRACTIONS.has(String(fraction)))throw Error("Invalid display options.");
  if(currency!==null&&!/^[A-Z]{3}$/.test(currency))throw Error("Invalid currency label.");
  const params=new URLSearchParams([["v","1"],["u",unit],["p",String(fraction)]]);
  if(currency!==null)params.set("c",currency);
  for(let i=0;i<keys.length;i++)params.set("f."+keys[i],numericText(fields[i].value));
  const fragment=PREFIX+params.toString();
  if(fragment.length>MAX_FRAGMENT)throw Error("Measurement link is too long; export a CSV instead.");
  return fragment;
}

export function parseMeasurementFragment(fragment,fields,allowedCurrencies=[]){
  if(typeof fragment!=="string"||!fragment.startsWith(PREFIX))return null;
  if(fragment.length>MAX_FRAGMENT)throw Error("Measurement link is too long.");
  const keys=checkFields(fields);
  const expected=new Set(["v","u","p",...keys.map(k=>"f."+k)]);
  if(allowedCurrencies.length)expected.add("c");
  const params=new URLSearchParams(fragment.slice(PREFIX.length));
  const actual=[...params.keys()];
  if(actual.length!==expected.size||new Set(actual).size!==actual.length||
    actual.some(k=>!expected.has(k)))
    throw Error("Measurement link has incomplete or duplicate fields.");
  if(params.get("v")!=="1")throw Error("Unsupported measurement link version.");
  const unit=params.get("u"),fraction=params.get("p");
  if(!UNITS.has(unit)||!FRACTIONS.has(fraction))throw Error("Invalid measurement link display options.");
  const currency=params.get("c");
  if(allowedCurrencies.length&&!allowedCurrencies.includes(currency))
    throw Error("Invalid measurement link currency.");
  const inputs={};
  for(const key of keys)inputs[key]=numericText(params.get("f."+key));
  return {unit,fraction,currency,inputs};
}
