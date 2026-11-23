import {McpServer} from "@modelcontextprotocol/server";
import {createMcpHandler} from "agents/mcp/server";
import {z} from "zod";
import {riseRun,lumberBoardFeet,balusterSpacing} from "./core.mjs";

const number=(description,min,max)=>z.number().finite().min(min).max(max).describe(description);
function textResult(fn){
  return async(args)=>{
    try{
      const result=fn(args);
      return {isError:!result.ok,content:[{type:"text",text:JSON.stringify(result)}]};
    }catch(error){
      return {isError:true,content:[{type:"text",text:JSON.stringify({
        ok:false,error:error instanceof Error?error.message:"Invalid input"
      })}]};
    }
  };
}
function createServer(){
  const server=new McpServer({name:"WoodLayout Calculators",version:"1.0.0"});
  server.registerTool("woodlayout_rise_run",{
    description:"Calculate slope length, slope angle, pitch per 12 and percent grade from a measured rise and horizontal run (inches). Reference geometry only.",
    inputSchema:z.object({
      rise:number("Vertical rise in inches",0,100000),
      run:number("Horizontal run in inches",0.001,100000)
    })
  },textResult(riseRun));
  server.registerTool("woodlayout_board_feet",{
    description:"Calculate board feet, whole purchased lumber quantity and optional quoted price from actual measured lumber dimensions (inches). No structural design.",
    inputSchema:z.object({
      thickness:number("Actual lumber thickness, inches",0.001,10000),
      width:number("Actual lumber width, inches",0.001,10000),
      length:number("Actual piece length, inches",0.001,100000),
      quantity:z.number().int().min(1).max(1000).default(1),
      wastePercent:number("Additional whole-piece reserve, percent",0,100).default(0),
      pricePerBoardFoot:number("Quoted price per board foot; 0 means no quote",0,1000000).default(0),
      taxPercent:number("Tax percentage when quoting",0,100).default(0)
    })
  },textResult(lumberBoardFeet));
  server.registerTool("woodlayout_baluster_spacing",{
    description:"Calculate geometric baluster count, equal clear gaps and sample face positions for a measured opening. Not a building-code or safety approval.",
    inputSchema:z.object({
      openingLength:number("Clear opening length in inches",0.001,10000),
      balusterWidth:number("Measured baluster width in inches",0.001,1000),
      maxClearGap:number("Maximum chosen clear gap in inches (not a code recommendation)",0.001,1000)
    })
  },textResult(balusterSpacing));
  return server;
}

const handleMcp=createMcpHandler(createServer);
export default {
  fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/health"&&request.method==="GET")
      return Response.json({ok:true,name:"WoodLayout MCP",version:"1.0.0",
        site:"https://woodlayout.com",tools:3},
        {headers:{"cache-control":"no-store"}});
    if(url.pathname!=="/mcp")
      return Response.json({service:"WoodLayout MCP",endpoint:"/mcp",
        site:"https://woodlayout.com"},{status:404,headers:{"cache-control":"no-store"}});
    return handleMcp(request,env,ctx);
  }
};
