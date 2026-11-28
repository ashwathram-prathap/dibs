import {test,expect} from './security-fixture';
import {mkdirSync} from 'node:fs';
async function submit(page:any,answer:string){await page.locator('#answer').fill(answer);await page.getByRole('button',{name:'CALL DIBS',exact:true}).click();}
async function shot(page:any,info:any,name:string){const dir=`review/r21-flow/${info.project.name}`;mkdirSync(dir,{recursive:true});await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test('paced reveal skips on first typing, retains input, final values and title',async({page},info)=>{
 await page.goto('/?r19&r19c&r19e&r6&r21');await page.locator('#answer').waitFor();
 await submit(page,'Okapi');await expect(page.locator('.compact-payoff .win-stamp')).toContainText('OKAPI');
 await page.locator('#answer').pressSequentially('Q');await expect(page.locator('#answer')).toHaveValue('Q');
 await expect(page.locator('.compact-payoff')).toHaveAttribute('data-reveal','done');
 await submit(page,'Quokka');await expect(page.locator('.off-register-stamp')).toHaveText('Off the register');
 await expect(page.locator('.claim-tier')).toContainText('3,004');
 await expect(page.locator('.claim-tier')).toContainText('#4');
 await shot(page,info,'off-register');
 await expect(page.locator('#answer')).toBeEditable();
 await submit(page,'Wombat');await expect(page.getByRole('button',{name:'See my results',exact:false})).toBeVisible();
 await page.getByRole('button',{name:'See my results',exact:false}).click();
 await expect(page.locator('.title-stamp')).toHaveText('Owner');
 await expect(page.locator('.title-award')).toContainText('so far');
 await expect(page.getByRole('button',{name:'SHARE',exact:true})).toBeEnabled();await shot(page,info,'done');
});
test('reduced motion golden off-register remains distinct and uses stored +50',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?r19&r19c&r19e&r6&r21&off&gold');
 await submit(page,'Okapi');await expect(page.locator('.compact-payoff')).toHaveAttribute('data-reveal','done');
 await expect(page.locator('.claim-payoff')).toContainText('50 golden bonus');
 await expect(page.locator('.off-register-stamp')).toBeVisible();await expect(page.locator('.golden-notice')).toBeVisible();
 await expect(page.getByRole('button',{name:'Skip animation'})).toHaveCount(0);await shot(page,info,'gold-off-reduced');
});
test('unknown readings have no off-register reward and pointer skip is accessible',async({page},info)=>{
 await page.goto('/?r19&r19c&r19e&r6&r21&missing');await submit(page,'Okapi');
 await expect(page.locator('.claim-tier')).toContainText('Standard score');await expect(page.locator('.off-register-stamp')).toHaveCount(0);
 const skip=page.getByRole('button',{name:'Skip animation'});if(await skip.isVisible())await skip.click();
 await expect(page.locator('.compact-payoff')).toHaveAttribute('data-reveal','done');await shot(page,info,'standard');
});
