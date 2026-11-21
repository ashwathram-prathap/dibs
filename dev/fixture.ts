// DEVELOPMENT ONLY. Vite removes this import from every production build.
import {ApiError} from '../src/api';
const date=new Date().toISOString().slice(0,10);
const category={id:'fixture-animals',date,name:'Animals',slug:'animals',total_registrable:2400,drop_at:new Date().toISOString()};
const entries=['Axolotl','Pangolin','Capybara','Okapi','Quokka','Wombat','Narwhal','Aardvark'];
let user={id:'fixture-reader',handle:'Teal Otter #41',school:'University of Waterloo',rerolls_used:0};
let claims:any[]=[{id:'fixture-1',category_id:category.id,claim_no:1,display:'Pangolin',handle:'Rust Finch #12',school:'McMaster',created_at:new Date().toISOString(),obscurity:4,category_name:'Animals',category_date:date,total_registrable:2400}];
let mine:any=null;
export async function request(path:string,body?:any):Promise<any>{
 await new Promise(r=>setTimeout(r,120));
 if(path==='/today')return {category,claimed:claims.length,open:2400-claims.length,nextDrop:new Date(Date.now()+3600000*12).toISOString(),turnstileSiteKey:'demo'};
 if(path==='/me')return {user,claim:mine,streak:mine?1:0,streakDates:mine?[date]:[]};
 if(path==='/me/reroll'){if(user.rerolls_used>=3||mine)throw new ApiError(403,{message:'This handle is filed.'});user={...user,handle:['Ochre Badger #25','Silver Moth #63','Amber Fox #19'][user.rerolls_used],rerolls_used:user.rerolls_used+1};return {user};}
 if(path==='/me/school'){user.school=body.school;return {user};}
 if(path.startsWith('/answers'))return {answers:entries.filter(e=>e.toLowerCase().includes(decodeURIComponent(path.split('q=')[1]||'').toLowerCase()))};
 if(path.startsWith('/ledger'))return {rows:claims};
 if(path==='/archive')return {categories:[category]};
 if(path.startsWith('/schools'))return {today:[{school:'McMaster',claims:1}],season:[{school:'McMaster',claims:1}]};
 if(path.startsWith('/certificate/'))return {claim:claims.find(c=>c.id===path.split('/').pop())||mine};
 if(path==='/claim'){
 if(mine)throw new ApiError(403,{message:'One claim per day. Yours is already on file.'});
 const entry=entries.find(e=>e.toLowerCase()===body.answer.trim().toLowerCase());
 if(!entry)throw new ApiError(422,{message:'That entry is not in this register. Please try another.'});
 const taken=claims.find(c=>c.display===entry);if(taken)throw new ApiError(409,{takenBy:taken.handle,at:taken.created_at,message:entry+' is already registered to '+taken.handle+'. Please call dibs on something else.'});
 mine={...claims[0],id:'fixture-2',claim_no:2,display:entry,handle:user.handle,school:user.school,created_at:new Date().toISOString(),obscurity:4};claims=[mine,...claims];return {claim:mine};
 }
 if(path==='/events/share')return {ok:true};
 throw new ApiError(404,{message:'No file at this address.'});
}
