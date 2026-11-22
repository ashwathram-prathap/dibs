import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend<{ cspCheck: void }>({
  cspCheck: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        (window as any).__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) =>
          (window as any).__cspViolations.push({
            directive: e.violatedDirective,
            uri: e.blockedURI,
          }),
        );
      });
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (
          /content.security.policy|violates.*directive|refused to.*(?:script|style|connect)/i.test(
            msg.text(),
          )
        )
          errors.push(msg.text());
      });
      await use();
      expect(errors).toEqual([]);
      if (!page.isClosed())
        expect(await page.evaluate(() => (window as any).__cspViolations || [])).toEqual([]);
    },
    { auto: true },
  ],
});
