import { chromium } from 'playwright';
const [,, ...pages] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => m.type()==='error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));

await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await p.fill('input[name=email]', 'abdullahmujahidali1@gmail.com');
await p.fill('input[name=password]', 'testpass123');
await Promise.all([p.waitForURL('**/', {timeout:20000}).catch(()=>{}), p.click('button')]);
await p.waitForTimeout(2500);
console.log('after login URL:', p.url());

for (const spec of pages) {
  const [name, path, w] = spec.split('|');
  await p.setViewportSize({ width: Number(w||1440), height: 1000 });
  await p.goto('http://localhost:3000'+path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: name+'.png', fullPage: true });
  console.log('shot:', name, path, w||1440);
}
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.slice(0,10).join('\n'));
await b.close();
