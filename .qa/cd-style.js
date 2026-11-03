const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.click('#btn-record');
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const ov = document.getElementById('countdown-overlay');
    const num = document.getElementById('countdown-number');
    const cs = getComputedStyle(ov);
    const csn = getComputedStyle(num);
    const r = ov.getBoundingClientRect();
    return {
      display: cs.display, zIndex: cs.zIndex, bg: cs.backgroundColor,
      rect: {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
      numDisplay: csn.display, numFontSize: csn.fontSize, numColor: csn.color,
      numRect: (()=>{const nr=num.getBoundingClientRect(); return {x:Math.round(nr.x),y:Math.round(nr.y),w:Math.round(nr.width),h:Math.round(nr.height)}})(),
      text: num.textContent,
      parent: ov.parentElement.id,
    };
  });
  console.log('STYLE', JSON.stringify(st,null,1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
