import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:1000} });
const p = await ctx.newPage();
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>m.type()==='error'&&errs.push('CONSOLE '+m.text().slice(0,120)));
await p.goto('http://localhost:3000/login',{waitUntil:'networkidle'});
await p.fill('input[name=email]','abdullahmujahidali1@gmail.com');
await p.fill('input[name=password]','testpass123');
await Promise.all([p.waitForURL('**/',{timeout:20000}).catch(()=>{}),p.click('button')]);

for (const w of [390, 1440]) {
  await p.setViewportSize({width:w,height:1000});
  for (const path of ['/','/ledger','/entry','/assets','/goals','/review','/import','/settings']) {
    await p.goto('http://localhost:3000'+path,{waitUntil:'networkidle'});
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const bad=[];
      for (const el of document.querySelectorAll('*')) {
        const b=el.getBoundingClientRect(); if(!b.width) continue;
        const par=el.parentElement?.getBoundingClientRect();
        if(par && par.width && (b.right>par.right+1.5||b.left<par.left-1.5))
          bad.push(el.tagName.toLowerCase()+'.'+String(el.className).slice(0,55));
      }
      return { bad:[...new Set(bad)].slice(0,4),
               hscroll: document.documentElement.scrollWidth > window.innerWidth+1 };
    });
    if (r.bad.length || r.hscroll) console.log(`[${w}] ${path} hscroll=${r.hscroll}`, r.bad.join(' | '));
  }
}
console.log(errs.length ? 'ERRORS:\n'+[...new Set(errs)].slice(0,6).join('\n') : 'no JS errors');
await b.close();
