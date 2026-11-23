import {mkdirSync,writeFileSync} from 'node:fs';
const r=await fetch('https://practice.dibs-7hz.pages.dev/api/admin/network',{headers:{authorization:'Bearer '+process.env.R15_PRACTICE_ADMIN}});
if(!r.ok)throw Error('Admin network diagnostic unavailable');
const data=await r.json();if(!data.present||!/^[a-f0-9]{8}$/.test(data.hashPrefix))throw Error('Platform IP did not arrive');
mkdirSync('review/round15',{recursive:true});writeFileSync('review/round15/network-ci.json',JSON.stringify({at:new Date().toISOString(),...data},null,2));
