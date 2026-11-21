let fixture: typeof import('../dev/fixture') | undefined;
if(import.meta.env.DEV && import.meta.env.VITE_DEMO === 'true') fixture = await import('../dev/fixture');
export class ApiError extends Error { constructor(public status:number,public data:Record<string,any>){super(data.message||'The registry could not complete that request. Please try again.')} }
export async function api<T>(path:string,body?:unknown):Promise<T>{
 if(fixture)return fixture.request(path,body) as Promise<T>;
 const r=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json(); if(!r.ok)throw new ApiError(r.status,data);return data;
}
export const isDemo=import.meta.env.DEV && import.meta.env.VITE_DEMO==='true';
