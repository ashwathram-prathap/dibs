import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const token = readFileSync('.dev.vars.staging', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1],
  origin = 'https://practice.dibs-7hz.pages.dev';
const get = async () =>
  (await (
    await fetch(origin + '/api/admin/schedule', { headers: { authorization: 'Bearer ' + token } })
  ).json()) as any;
const initial = await get();
const dates = ['2027-01-08', '2027-01-09'];
for (const date of dates)
  assert.equal(initial.days.find((d: any) => d.date === date).status, 'empty');
const b = await chromium.launch(),
  context = await b.newContext({ viewport: { width: 390, height: 844 } }),
  p = await context.newPage();
const checks: any[] = [];
try {
  await p.goto(origin + '/admin/schedule');
  await p.locator('#schedule-token').fill(token);
  await p.getByRole('button', { name: 'Open calendar', exact: true }).click();
  await p.locator('.calendar-day').first().waitFor();
  const open = async (date: string) => {
    await p.getByRole('button', { name: new RegExp('^' + date + ':') }).click();
    await p.locator('.calendar-editor').waitFor();
  };
  const updated = async () => {
    await p.locator('.calendar-editor').waitFor({ state: 'hidden' });
  };
  await open(dates[0]);
  await p.locator('#topic-choice').selectOption('countries');
  await p.getByRole('button', { name: 'Set topic', exact: true }).click();
  await updated();
  assert.equal((await get()).days.find((d: any) => d.date === dates[0]).slug, 'countries');
  checks.push('Library pick');
  await open(dates[1]);
  await p.getByText('Request a new topic', { exact: true }).click();
  await p.locator('#new-topic').fill('Car brands');
  await p.getByRole('button', { name: 'Request topic', exact: true }).click();
  await updated();
  assert.equal((await get()).days.find((d: any) => d.date === dates[1]).status, 'needs recipe');
  checks.push('New topic request');
  await open(dates[0]);
  await p.getByText('Move or swap', { exact: true }).click();
  await p.locator('#move-day').selectOption(dates[1]);
  await p.getByRole('button', { name: 'Swap days', exact: true }).click();
  await updated();
  let state = await get();
  assert.equal(state.days.find((d: any) => d.date === dates[1]).slug, 'countries');
  assert.equal(state.days.find((d: any) => d.date === dates[0]).request, 'Car brands');
  checks.push('Swap');
  for (const date of dates) {
    await open(date);
    await p.getByRole('button', { name: 'Clear day', exact: true }).click();
    await updated();
  }
  checks.push('Clear');
  for (const date of dates)
    assert.equal((await get()).days.find((d: any) => d.date === date).status, 'empty');
  writeFileSync(
    'review/round9/calendar-live-actions.json',
    JSON.stringify(
      { at: new Date().toISOString(), checks, temporaryDaysRestoredToEmpty: true },
      null,
      2,
    ),
  );
  console.log(checks.join(', ') + ' passed on live practice.');
} finally {
  await context.close();
  await b.close();
}
