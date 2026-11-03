const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(800);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',6);
  });
  await page.waitForTimeout(300);
  await page.click('#btn-record');
  await page.waitForTimeout(6400);
  await page.waitForTimeout(700);

  // discard modal
  await page.click('#btn-retake');
  await page.waitForTimeout(300);
  const modal = await page.evaluate(() => ({
    on: document.getElementById('discard-modal').classList.contains('is-on'),
  }));
  console.log('MODAL_OPEN', JSON.stringify(modal));
  await page.click('#btn-discard-cancel');
  await page.waitForTimeout(200);
  const stillThere = await page.evaluate(() => ({takeSrc: !!document.getElementById('take-video').src, modal: document.getElementById('discard-modal').classList.contains('is-on')}));
  console.log('AFTER_CANCEL', JSON.stringify(stillThere));

  await page.click('#btn-retake');
  await page.waitForTimeout(200);
  await page.click('#btn-discard-confirm');
  await page.waitForTimeout(400);
  const discarded = await page.evaluate(() => ({takeSrc: !!document.getElementById('take-video').src, downloadTakeDisabled: document.getElementById('btn-download-take').disabled, badge: document.getElementById('take-badge-label').textContent}));
  console.log('AFTER_DISCARD', JSON.stringify(discarded));

  // export cancel mid-way
  await page.click('#btn-record');
  await page.waitForTimeout(6400);
  await page.waitForTimeout(700);
  await page.click('#btn-export-merged');
  await page.waitForTimeout(900);
  const mid = await page.evaluate(() => ({overlay: document.getElementById('export-overlay').classList.contains('is-on'), status: document.getElementById('export-status').textContent}));
  console.log('EXPORT_MID', JSON.stringify(mid));
  await page.click('#btn-export-cancel');
  await page.waitForTimeout(1500);
  const cancelled = await page.evaluate(() => ({
    overlay: document.getElementById('export-overlay').classList.contains('is-on'),
    toast: document.getElementById('toast').textContent,
    toastOn: document.getElementById('toast').classList.contains('is-on'),
    exportActiveBtn: document.getElementById('btn-export-merged').disabled,
  }));
  console.log('EXPORT_CANCELLED', JSON.stringify(cancelled));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
