import { chromium, devices } from "playwright";

const b = await chromium.launch();

const login = async (p) => {
  await p.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "demo@example.com");
  await p.fill('input[name="password"]', "demodemo123");
  await Promise.all([
    p.waitForURL("http://localhost:3000/", { timeout: 40000 }),
    p.click('button:has-text("Sign in")')
  ]);
  await p.waitForTimeout(3000);
};

// Neon serverless can cold-start and throw a one-off fetch error; retry.
const grab = async (p, url, file) => {
  for (let i = 0; i < 5; i++) {
    await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const bad = await p.getByText("Error connecting to database").count().catch(() => 0);
    const overlay = await p.locator("nextjs-portal").count().catch(() => 0);
    if (!bad && !overlay) {
      await p.screenshot({ path: file });
      console.log("ok", file);
      return true;
    }
    console.log("retry", url, "(err:" + bad + " overlay:" + overlay + ")");
    await p.waitForTimeout(3000);
  }
  console.log("FAILED", url);
  return false;
};

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await login(p);
for (const [url, name] of [
  ["/", "dashboard"],
  ["/ledger", "ledger"],
  ["/year", "year"],
  ["/goals", "goals"],
  ["/assets", "assets"]
]) {
  await grab(p, url, `public/shots/app-${name}.png`);
}
await ctx.close();

const mctx = await b.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 3 });
const m = await mctx.newPage();
await login(m);
for (const [url, name] of [["/", "dashboard"], ["/ledger", "ledger"], ["/goals", "goals"]]) {
  await grab(m, url, `public/shots/mobile-${name}.png`);
}
await mctx.close();
await b.close();
