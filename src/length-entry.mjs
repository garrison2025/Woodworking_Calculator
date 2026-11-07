// US workshop dimension entry: exact binary inch fractions alongside decimals.
// The calculator engine and exports continue receiving decimal inches only.
// Fractions are intentionally limited to power-of-two denominators to avoid
// suggesting that arbitrary ratios are conventional fractional-inch marks.
const DECIMAL=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const INCH_FRACTION=/^([+-]?)(?:(\d+)(?:\s+|-))?(\d+)\/(\d+)$/;
const MAX_ENTRY_LENGTH=64;
const MAX_FRACTION_WHOLE=1e9;

export function parseEditableLength(raw,unit){
  const text=String(raw).trim();
  if(!text||text.length>MAX_ENTRY_LENGTH)return null;
  if(DECIMAL.test(text)){
    const n=Number(text);
    return Number.isFinite(n)?n:null;
  }
  if(unit!=="in")return null;
  const m=INCH_FRACTION.exec(text);
  if(!m)return null;
  const whole=m[2]===undefined?0:Number(m[2]);
  const numerator=Number(m[3]),denominator=Number(m[4]);
  // Only 1/2, 1/4, ..., 1/64 (including mixed 5 1/2 and 5-1/2).
  // Keep the numerator proper and the integer part in an exact range:
  // a silently rounded 1/64 inch would be an incorrect cut dimension.
  if(!Number.isSafeInteger(whole)||whole>MAX_FRACTION_WHOLE||
    !Number.isSafeInteger(numerator)||numerator<=0||
    !Number.isSafeInteger(denominator)||denominator<2||
    denominator>64||(denominator&(denominator-1))!==0||
    numerator>=denominator)return null;
  const value=(whole+numerator/denominator)*(m[1]==="-"?-1:1);
  return Number.isFinite(value)?value:null;
}

export function canonicalLengthText(raw,unit){
  const parsed=parseEditableLength(raw,unit);
  if(parsed===null)throw Error("Enter a decimal length or, in inches, a fraction such as 5 1/2.");
  return String(parsed);
}
