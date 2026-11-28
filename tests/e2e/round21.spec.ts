import {test,expect} from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync} from 'node:fs';
test.beforeEach(async({page},info)=>{await page.addInitScript((scale)=>{document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.fontSize=`${16*scale}px`})},Number(info.project.metadata.fontScale||1));});
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
 await page.locator('#answer').focus();await page.locator('#answer').press('Q');await page.waitForTimeout(250);
 const input=await page.locator('#answer').boundingBox();expect(input!.y).toBeGreaterThanOrEqual(0);expect(input!.y+input!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

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

test('slow response, rejected guess, paste and IME do not predict success or lose input',async({page},info)=>{
 await page.goto('/?r19&r19c&r19e&r6&r21&r21-slow');await page.locator('#answer').fill('Okapi');await page.getByRole('button',{name:'CALL DIBS',exact:true}).click();
 await expect(page.locator('.compact-payoff')).toHaveCount(0);await expect(page.locator('.compact-payoff')).toBeVisible();
 await page.locator('#answer').dispatchEvent('compositionstart');await page.locator('#answer').fill('Quokka');await page.locator('#answer').dispatchEvent('compositionend');
 await expect(page.locator('#answer')).toHaveValue('Quokka');await expect(page.locator('.compact-payoff')).toHaveAttribute('data-reveal','done');
 await page.locator('#answer').press('Enter');await expect(page.locator('.win-stamp')).toContainText('QUOKKA');
 await submit(page,'not-a-catalog-answer');await expect(page.getByText("Not on today's list; check the spelling.",{exact:false}).first()).toBeVisible();
 await expect(page.locator('.off-register-stamp')).toHaveCount(0);
});
test('media change and keyboard skip finish once; result stays usable at keyboard viewport',async({page},info)=>{
 await page.goto('/?r19&r19c&r19e&r6&r21');await submit(page,'Okapi');await expect(page.locator('.compact-payoff')).toBeVisible();
 const skip=page.getByRole('button',{name:'Skip animation'});if(await skip.isVisible()){await skip.focus();await skip.press('Enter')}
 await expect(page.locator('.compact-payoff')).toHaveAttribute('data-reveal','done');await submit(page,'Quokka');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.compact-payoff')).toHaveAttribute('data-reveal','done');
 if(page.viewportSize()!.width<768){await page.setViewportSize({width:page.viewportSize()!.width,height:420});await page.locator('#answer').focus();await page.locator('#answer').fill('W');await page.waitForTimeout(300);expect(await page.locator('#answer').inputValue()).toBe('W');}
 if(info.project.name.startsWith('chromium-390-light')) {const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(a.violations).toEqual([]);}
 await shot(page,info,'keyboard');
});
