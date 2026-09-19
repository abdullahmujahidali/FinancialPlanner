import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:1000}, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/login',{waitUntil:'networkidle'});
await p.fill('input[name=email]','abdullahmujahidali1@gmail.com');
await p.fill('input[name=password]','testpass123');
await Promise.all([p.waitForURL('**/',{timeout:20000}).catch(()=>{}),p.click('button')]);
await p.goto('http://localhost:3000/settings',{waitUntil:'networkidle'});
await p.waitForTimeout(1000);
// the Accounts card
const card = p.locator('section').filter({ hasText:'ACCOUNTS' }).first();
await card.screenshot({ path: process.argv[2]+'/crop-accounts.png' });
// overflow check across the page
const bad = await p.evaluate(() => {
  const out=[];
  for (const el of document.querySelectorAll('section, form, input, select, .block-card')) {
    const r=el.getBoundingClientRect();
    if (r.width===0) continue;
    const par=el.parentElement?.getBoundingClientRect();
    if (par && (r.right > par.right+1 || r.left < par.left-1)) {
      out.push((el.tagName+'.'+(el.className||'')).slice(0,90)+` r=${Math.round(r.right)} parent=${Math.round(par.right)}`);
    }
  }
  return out.slice(0,10);
});
console.log('OVERFLOWING:', bad.length ? '\n'+bad.join('\n') : 'none');
await b.close();
