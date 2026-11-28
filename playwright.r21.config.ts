import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const engines=process.env.R21_ENGINES?.split(',')||['chromium','webkit'];
const widths=process.env.R21_FULL?[320,360,390,768,1280,1440,2560]:[390,1440];
const projects=process.env.R21_DEVICES?(base.projects||[]).filter((p:any)=>p.use?.browserName!=='firefox'&&!String(p.testMatch||'').includes('specials')):engines.flatMap(browserName=>widths.flatMap(width=>['light','dark'].flatMap(colorScheme=>(process.env.R21_FULL&&width<=390?[1,1.3]:[1]).map(fontScale=>({name:`${browserName}-${width}-${colorScheme}-font${fontScale}`,metadata:{fontScale},use:{browserName:browserName as any,colorScheme:colorScheme as any,viewport:{width,height:width===320?568:width<768?844:900}}})))));
export default defineConfig({testDir:'tests/e2e',testMatch:'round21.spec.ts',fullyParallel:true,workers:4,timeout:60000,retries:0,
 reporter:[['list'],['json',{outputFile:process.env.R21_REPORT||'review/r21-flow/browser-tests.json'}]],outputDir:'.tmp/r21/artifacts',
 use:{baseURL:'http://127.0.0.1:5251',timezoneId:'America/Toronto',video:'on',screenshot:'only-on-failure'},projects,
 webServer:{command:'npx vite preview --mode security-test --host 127.0.0.1 --port 5251',url:'http://127.0.0.1:5251',env:{DIBS_TEST_OUT_DIR:'.tmp/r21/browser-dist'}}});
