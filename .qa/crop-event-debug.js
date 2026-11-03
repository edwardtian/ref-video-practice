const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);

  // instrument
  await page.evaluate(() => {
    window.__evt = [];
    const ov = document.getElementById('ref-crop-overlay');
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(t => {
      ov.addEventListener(t, (e) => window.__evt.push({t, target: e.target.id || e.target.className, x: Math.round(e.clientX), y: Math.round(e.clientY)}), true);
    });
  });
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(200);
  const ov = await page.$('#ref-crop-overlay');
  const rect = await ov.boundingBox();
  const x1 = rect.x + rect.width*0.2, y1 = rect.y + rect.height*0.1;
  const x2 = rect.x + rect.width*0.8, y2 = rect.y + rect.height*0.7;
  await page.mouse.move(x1,y1);
  await page.mouse.down();
  await page.mouse.move(x2,y2,{steps:8});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({
    evt: window.__evt.slice(0,14),
    cropLeft: document.getElementById('crop-left-label').textContent,
    cropWidth: document.getElementById('crop-width-label').textContent,
    boxStyle: (()=>{const b=document.getElementById('ref-crop-box'); return {left:b.style.left,top:b.style.top,width:b.style.width,height:b.style.height};})(),
    ovPointer: getComputedStyle(document.getElementById('ref-crop-overlay')).pointerEvents,
    boxPointer: getComputedStyle(document.getElementById('ref-crop-box')).pointerEvents,
    shadeTopPointer: getComputedStyle(document.getElementById('ref-shade-top')).pointerEvents,
  }));
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
