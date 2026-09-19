import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
await p.fill('input[name="email"]', "demo@example.com");
await p.fill('input[name="password"]', "demodemo123");
await Promise.all([p.waitForURL("http://localhost:3000/", { timeout: 90000 }), p.click('button:has-text("Sign in")')]);
await p.waitForTimeout(3000);
for (const [url, name] of [["/", "dashboard"], ["/ledger", "ledger"], ["/year", "year"], ["/goals", "goals"], ["/assets", "assets"]]) {
  await p.goto("http://localhost:3000" + url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `public/shots/app-${name}.png` });
  console.log("ok", name);
}
await b.close();
