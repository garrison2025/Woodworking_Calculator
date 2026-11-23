// Read-only MCP adapter over WoodLayout's existing, tested geometry engine.
// Neither this file nor the Worker modifies the static website.
import {safeCompute} from "../src/calcs.mjs";

const SOURCE="https://woodlayout.com";
const DISCLAIMER="Geometric/reference estimates only. Verify physical dimensions and local requirements before construction. No structural or safety certification.";

function inRange(value,name,min,max){
  if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)
    throw new RangeError(name+" must be a finite number in ["+min+", "+max+"].");
  return value;
}
function integer(value,name,min,max){
  inRange(value,name,min,max);
  if(!Number.isInteger(value))throw new RangeError(name+" must be a whole number.");
  return value;
}
function calculate(slug,input,maxRows=0){
  const outcome=safeCompute(slug,input);
  if(!outcome.ok)return {ok:false,error:outcome.error};
  const data=outcome.data;
  // Expose bounded, useful results, not the entire browser SVG / cut-layout state.
  const metrics=data.metrics.map(m=>({label:m.label,value:m.value,kind:m.kind}));
  const rows=maxRows?data.rows.slice(0,maxRows):[];
  return {ok:true,source:SOURCE+"/"+slug+"/",unit:"inches unless metric kind indicates otherwise",
    disclaimer:DISCLAIMER,metrics,
    ...(maxRows?{rowCount:data.rows.length,rows,rowsTruncated:data.rows.length>maxRows}:{})};
}

export function riseRun({rise,run}){
  return calculate("rise-run-calculator",{
    rise:inRange(rise,"rise",0,100000),
    run:inRange(run,"run",0.001,100000)
  });
}

export function lumberBoardFeet({thickness,width,length,quantity=1,wastePercent=0,
  pricePerBoardFoot=0,taxPercent=0}){
  return calculate("lumber-price-calculator",{
    dimensionBasis:1, // Entered actual measured dimensions; never auto-convert nominal sizes.
    thickness:inRange(thickness,"thickness",0.001,10000),
    width:inRange(width,"width",0.001,10000),
    length:inRange(length,"length",0.001,100000),
    quantity:integer(quantity,"quantity",1,1000),
    waste:inRange(wastePercent,"wastePercent",0,100),
    priceBasis:0,boardFootRate:inRange(pricePerBoardFoot,"pricePerBoardFoot",0,1000000),
    thousandBoardFootRate:0,tax:inRange(taxPercent,"taxPercent",0,100)
  });
}

export function balusterSpacing({openingLength,balusterWidth,maxClearGap}){
  return calculate("baluster-spacing-calculator",{
    length:inRange(openingLength,"openingLength",0.001,10000),
    width:inRange(balusterWidth,"balusterWidth",0.001,1000),
    gap:inRange(maxClearGap,"maxClearGap",0.001,1000)
  },30);
}
