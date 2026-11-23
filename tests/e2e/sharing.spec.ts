import { GAME_DESCRIPTION } from '../../shared/copy';
import { test, expect } from './security-fixture';
import { PUBLIC_ORIGIN } from '../../shared/config';

async function certificate(page: any) {
  await page.goto('/certificate/fixture-1');
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
  await page.getByText('More ways to share', { exact: true }).click();
}
test('all share controls, exact intents and anonymous one-tap events', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).events = [];
    window.addEventListener('dibs-fixture-event', (e: any) =>
      (window as any).events.push(e.detail),
    );
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => {
          (window as any).copied = value;
        },
      },
    });
    Object.defineProperty(navigator, 'share', { value: undefined });
  });
  await certificate(page);
  for (const name of [
    'SHARE',
    'Instagram / TikTok story',
    'Copy link',
    'Copy text',
    'Story JPEG',
    'Feed JPEG',
  ])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  for (const [label, platform, host, path, key] of [
    ['X', 'x', 'twitter.com', '/intent/tweet', 'url'],
    ['WhatsApp', 'whatsapp', 'wa.me', '/', 'text'],
    ['Facebook', 'facebook', 'www.facebook.com', '/sharer/sharer.php', 'u'],
  ]) {
    const a = page.getByRole('link', { name: label, exact: true });
    const href = new URL((await a.getAttribute('href'))!);
    expect([href.host, href.pathname]).toEqual([host, path]);
    expect(href.searchParams.get(key)).toContain(
      `${PUBLIC_ORIGIN}/certificate/fixture-1?s=${platform}`,
    );
    if (platform === 'x') expect(href.searchParams.get('text')).toBe(GAME_DESCRIPTION);
    // Intercept the external navigation; tests never send content to a platform.
    await page
      .context()
      .route(href.origin + '/**', (route) => route.fulfill({ body: 'Local intent interception' }));
    const popup = page.waitForEvent('popup');
    await a.click();
    const target = await popup;
    await target.waitForLoadState();
    expect(target.url()).toBe(href.href);
    await target.close();
  }
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.locator('.share-hint[role=status]')).toHaveText('Copied');
  expect(await page.evaluate(() => (window as any).copied)).toBe(
    `${PUBLIC_ORIGIN}/certificate/fixture-1?s=copy-link`,
  );
  await page.getByRole('button', { name: 'Copy text', exact: true }).click();
  expect(await page.evaluate(() => (window as any).copied)).toContain(GAME_DESCRIPTION);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('feed.jpg');
  await expect(page.getByRole('link', { name: 'Open image to save manually' })).toBeVisible();
  await expect(page.getByAltText('Your Dibs image. Press and hold to save.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).events))
    .toEqual(
      ['x', 'whatsapp', 'facebook', 'copy-link', 'copy-text', 'native'].map((platform) => ({
        path: '/events/share',
        body: { platform },
      })),
    );
});

test('native sharing sends a prepared feed file; cancellation never downloads', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async (data: any) => {
        (window as any).shared = {
          name: data.files?.[0]?.name,
          type: data.files?.[0]?.type,
          size: data.files?.[0]?.size,
          text: data.text,
          url: data.url,
        };
        if ((window as any).cancelShare) throw new DOMException('cancelled', 'AbortError');
      },
    });
  });
  await certificate(page);
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  const data = await page.evaluate(() => (window as any).shared);
  expect(data.name).toContain('feed.jpg');
  expect(data.type).toBe('image/jpeg');
  expect(data.size).toBeGreaterThan(1000);
  expect(data.text).toBeUndefined();
  expect(data.url).toBeUndefined();
  await page.evaluate(() => {
    (window as any).cancelShare = true;
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  await expect(page.locator('.share-hint[role=status]')).toHaveText('Image shared.');
  expect(downloads).toBe(0);
});

test('text-only native sharing offers the PNG; blocked clipboard keeps selectable text', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false });
    Object.defineProperty(navigator, 'share', {
      value: async (data: any) => {
        (window as any).shared = data;
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw Error('blocked');
        },
      },
    });
  });
  await certificate(page);
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  expect(await page.evaluate(() => (window as any).shared.files)).toBeUndefined();
  await expect(page.locator('.share-hint[role=status]')).toContainText('Link shared.');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByLabel('Share text to copy')).toHaveText(
    `${PUBLIC_ORIGIN}/certificate/fixture-1?s=copy-link`,
  );
});

test('Instagram and TikTok export keeps a long-press image when the browser blocks downloads', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false });
    Object.defineProperty(navigator, 'share', { value: undefined });
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download) click.call(this);
    };
  });
  await certificate(page);
  await page.getByRole('button', { name: 'Instagram / TikTok story' }).click();
  await expect(page.locator('.share-hint[role=status]').first()).toHaveText(/Couldn't share\./);
  const image = page.getByAltText('Your Dibs image. Press and hold to save.');
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([1080, 1920]);
  await expect(page.getByRole('link', { name: 'Open image to save manually' })).toHaveAttribute(
    'href',
    /^blob:/,
  );
});

test('native share rejection falls back to a PNG', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async () => {
        throw new DOMException('blocked', 'NotAllowedError');
      },
    });
  });
  await certificate(page);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toContain('feed.jpg');
  await expect(page.locator('.share-hint[role=status]').first()).toContainText("Couldn't share.");
});

test('first arrival attribution survives reloads and ignores arbitrary sources', async ({
  page,
}) => {
  const arrivals: any[] = [];
  await page.exposeFunction('observeArrival', (event: any) => {
    if (event.path === '/events/arrival') arrivals.push(event.body);
  });
  await page.addInitScript(() =>
    window.addEventListener('dibs-fixture-event', (e: any) =>
      (window as any).observeArrival(e.detail),
    ),
  );
  await page.goto('/certificate/fixture-1?s=whatsapp');
  await expect.poll(() => arrivals).toEqual([{ platform: 'whatsapp' }]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
  await page.getByText('More ways to share', { exact: true }).click();
  await page.goto('/certificate/fixture-1?s=x');
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
  await page.getByText('More ways to share', { exact: true }).click();
  expect(arrivals).toEqual([{ platform: 'whatsapp' }]);
  await page.evaluate(() => localStorage.removeItem('dibs-arrived'));
  await page.goto('/certificate/fixture-1?s=not-a-platform');
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
  await page.getByText('More ways to share', { exact: true }).click();
  expect(arrivals).toEqual([{ platform: 'whatsapp' }]);
});
