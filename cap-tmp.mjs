import { chromium } from "playwright";
const b = await chromium.launch();
// 390x844 CSS px is the iPhone 13 viewport: ratio 2.164, the real device shape.
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
});
const m = await ctx.newPage();
await m.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
await m.fill('input[name="email"]', "demo@example.com");
await m.fill('input[name="password"]', "demodemo123");
await Promise.all([m.waitForURL("http://localhost:3000/", { timeout: 90000 }), m.click('button:has-text("Sign in")')]);
await m.waitForTimeout(3000);
for (const [url, name] of [["/", "dashboard"], ["/ledger", "ledger"], ["/goals", "goals"]]) {
  await m.goto("http://localhost:3000" + url, { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(3000);
  await m.screenshot({ path: `public/shots/mobile-${name}.png` });
  console.log("ok", name);
}
await b.close();
