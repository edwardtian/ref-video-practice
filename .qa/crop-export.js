const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000}, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload(); await page.waitForTimeout(1000);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5);
  });
  await page.waitForTimeout(300);

  // crop the reference to 60% wide x 50% tall
  await page.click('#btn-crop-draw'); await page.waitForTimeout(250);
  const ov = await (await page.$('#ref-crop-overlay')).boundingBox();
  await page.mouse.move(ov.x + ov.width*0.2, ov.y + ov.height*0.2);
  await page.mouse.down();
  await page.mouse.move(ov.x + ov.width*0.8, ov.y + ov.height*0.7, { steps: 8 });
  await page.mouse.up(); await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const applied = await page.evaluate(() => ({
    crop: document.getElementById('crop-width-label').textContent + 'x' + document.getElementById('crop-height-label').textContent,
    height: document.getElementById('ref-out-height').textContent,
    meta: document.getElementById('strip-export-meta').textContent,
  }));
  console.log('crop applied:', JSON.stringify(applied));

  // record a take
  await page.click('#btn-record');
  await page.waitForTimeout(3200 + 800 + 2400);
  await page.waitForTimeout(800);

  // export merged
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.click('#btn-export-merged');
  const download = await dl;
  const out = '.qa/out-merged.webm';
  await download.saveAs(out);
  console.log('saved:', download.suggestedFilename(), fs.statSync(out).size, 'bytes');

  // also export the cropped reference alone
  const dl2 = page.waitForEvent('download', { timeout: 120000 });
  await page.click('#btn-download-ref');
  const d2 = await dl2;
  await d2.saveAs('.qa/out-ref.webm');
  console.log('saved ref:', d2.suggestedFilename());
  console.log('errors:', errs);
  await browser.close();
})();
