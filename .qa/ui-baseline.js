const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);
  const out = process.argv[2] || 'ui-before';
  await page.screenshot({ path: `screenshots/${out}-top.png` });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log('page height', h);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${out}-bottom.png` });
  const info = await page.evaluate(() => {
    const r = (id) => { const el = document.getElementById(id); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { footer: r('footer'), review: r('btn-review'), refCell: r('ref-cell'), takeCell: r('take-cell'), body: document.body.scrollHeight };
  });
  console.log(JSON.stringify(info));
  console.log('errors:', errs);
  await browser.close();
})();
