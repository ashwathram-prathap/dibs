import satori,{init} from 'satori/standalone';
import {Resvg,initWasm} from '@resvg/resvg-wasm';
import layoutWasm from 'satori/layout.wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
let font:Promise<ArrayBuffer>|undefined;
let ready:Promise<unknown>|undefined;
const div=(style:Record<string,unknown>,...children:any[])=>({type:'div',props:{style:{display:'flex',...style},children}});
export async function og(site:string,claim:any){
 ready||=Promise.all([init(layoutWasm),initWasm(resvgWasm)]);await ready;
 font||=fetch(site+'/fonts/archivo-og.woff').then(r=>{if(!r.ok)throw new Error('Font unavailable');return r.arrayBuffer()}).catch(e=>{font=undefined;throw e});const data=await font;
 const title=claim?claim.display.toUpperCase():'DIBS.';const serial=claim?'CERTIFICATE OF DIBS No. '+String(claim.claim_no).padStart(4,'0'):'REGISTRY OF CLAIMS / FORM C-1';
 const tree=div({flexDirection:'column',background:'#F1ECE2',color:'#1A1A17',width:1200,height:630,padding:46,fontFamily:'Archivo',border:'14px double #1A1A17'},
 div({fontSize:22,justifyContent:'space-between',borderBottom:'2px solid #1A1A17',paddingBottom:24},div({},serial),div({},claim?claim.category_date:'FIRST COME. FIRST SERVED.')),
 div({fontSize:30,marginTop:35},claim?'I called dibs on':'One category. One claim.'),
 div({fontSize:title.length>20?70:title.length>12?100:155,lineHeight:1,letterSpacing:-6,marginTop:20,flexGrow:1},title),
 div({justifyContent:'space-between',alignItems:'center',borderTop:'2px solid #1A1A17',paddingTop:24,fontSize:25},div({},claim?claim.handle+' · '+claim.category_name:'Yours for the day.'),div({color:'#E1462B',border:'4px solid #E1462B',padding:'7px 18px',transform:'rotate(-3deg)',fontSize:40},claim?'REGISTERED':'DIBS')));
 const svg=await satori(tree as any,{width:1200,height:630,fonts:[{name:'Archivo',data,weight:900,style:'normal'}]});const renderer=new Resvg(svg);try{const png=renderer.render();try{return new Response(png.asPng(),{headers:{'content-type':'image/png','cache-control':'public, max-age=300','x-robots-tag':'noindex'}})}finally{png.free()}}finally{renderer.free()}
}
