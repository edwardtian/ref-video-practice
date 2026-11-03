const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900}, acceptDownloads: true });
  const page = await ctx.newPage();
  const saved = [];
  page.on('download', async (d) => {
    const name = d.suggestedFilename();
    const dest = path.join('.qa/exports', name);
    await d.saveAs(dest);
    saved.push({name, dest});
    console.log('DOWNLOADED', name, fs.statSync(dest).size);
  });

  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(800);
  const fi = await page.$('#file-input');
  await fi.setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5);
  });
  await page.waitForTimeout(300);
  await page.click('#btn-record');
  await page.waitForTimeout(3400);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('crop-left',10); set('crop-top',5); set('crop-width',80); set('crop-height',75);
    set('ref-out-width',480);
    set('tcrop-left',5); set('tcrop-top',10); set('tcrop-width',90); set('tcrop-height',80);
    set('take-out-width',480);
    set('border-size',12); set('border-color','#ffcc00');
  });
  await page.waitForTimeout(400);

  async function runExport(btnId) {
    await page.click(btnId);
    const start = Date.now();
    while (Date.now() - start < 25000) {
      const on = await page.evaluate(() => document.getElementById('export-overlay').classList.contains('is-on'));
      if (!on) { await page.waitForTimeout(500); return; }
      await page.waitForTimeout(250);
    }
    console.log('TIMEOUT for', btnId);
  }
  await runExport('#btn-download-ref');
  await runExport('#btn-download-take');
  await runExport('#btn-export-merged');
  await page.waitForTimeout(800);
  console.log('SAVED', JSON.stringify(saved));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
