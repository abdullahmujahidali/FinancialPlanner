import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
for (const size of [192, 512]) {
  const pad = Math.round(size * 0.09);
  const fs  = Math.round(size * 0.62);
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:#0A0A0A;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:${pad}px">
      <div style="width:100%;height:100%;background:#E2FB4F;display:flex;align-items:center;justify-content:center">
        <span style="font:800 ${fs}px/1 Archivo,Helvetica,Arial,sans-serif;color:#0A0A0A;letter-spacing:-0.06em">H</span>
      </div>
    </div></body></html>`);
  await p.screenshot({ path: `public/icons/icon-${size}.png` });
  console.log('icon', size);
}
await b.close();
