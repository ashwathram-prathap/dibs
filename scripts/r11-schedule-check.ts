import './test-traffic';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { localTime } from '../shared/time';
const b = await chromium.launch(),
  results: any[] = [];
try {
  for (const origin of ['https://practice.dibs-7hz.pages.dev', 'https://dibs.here']) {
    const today = (await (await fetch(origin + '/api/today')).json()) as any;
    const expected = localTime(today.nextDrop, 'America/Toronto', true).full;
    const c = await b.newContext({
        viewport: { width: 1440, height: 900 },
        timezoneId: 'America/Toronto',
      }),
      p = await c.newPage();
    const pages: any[] = [];
    for (const path of ['/', '/about']) {
      await p.goto(origin + path);
      await p.locator('main h1').waitFor();
      const labels = await p.locator('.local-drop').allTextContents();
      assert.ok(labels.length);
      assert.ok(
        labels.every((x) => x === expected),
        JSON.stringify({ labels, expected }),
      );
      pages.push({ path, labels });
    }
    const ics = await (await fetch(origin + '/reminder.ics')).text();
    const target = new Date(Date.parse(today.nextDrop) - 300000);
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(target)
      .replaceAll('-', '')
      .replace(' ', 'T')
      .replaceAll(':', '');
    assert.ok(ics.includes('DTSTART;TZID=America/Toronto:' + stamp));
    assert.ok(ics.includes('RRULE:FREQ=DAILY'));
    results.push({
      origin,
      nextDrop: today.nextDrop,
      expected,
      pages,
      calendarStart: stamp,
      calendarStartCorrect: true,
      daily: true,
      productionDeployed: false,
      passed: true,
    });
    await c.close();
  }
} finally {
  await b.close();
  writeFileSync('review/round11/schedule-contract.json', JSON.stringify(results, null, 2));
}
console.log(results);
