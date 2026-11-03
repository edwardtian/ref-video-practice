const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900}, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await page.screenshot({path: '.qa/final-0-empty.png'});
  const empty = await page.evaluate(() => ({
    refEmptyVisible: !document.getElementById('ref-empty').classList.contains('is-hidden'),
    camEmptyVisible: !document.getElementById('cam-empty').classList.contains('is-hidden'),
    camLive: !!document.getElementById('cam-video').srcObject,
    recordDisabled: document.getElementById('btn-record').disabled,
    reviewDisabled: document.getElementById('btn-review').disabled,
    exportDisabled: document.getElementById('btn-export-merged').disabled,
    downloadRefDisabled: document.getElementById('btn-download-ref').disabled,
    downloadTakeDisabled: document.getElementById('btn-download-take').disabled,
    cropDisabled: document.getElementById('crop-left').disabled,
    trimDisabled: document.getElementById('trim-start').disabled,
    refWidthDisabled: document.getElementById('ref-out-width').disabled,
  }));
  console.log('EMPTY', JSON.stringify(empty));

  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',3); set('trim-end',8);
    set('crop-left',0); set('crop-top',0); set('crop-width',100); set('crop-height',100);
    set('ref-out-width',640);
    set('tcrop-left',0); set('tcrop-top',0); set('tcrop-width',100); set('tcrop-height',100);
    set('take-out-width',640);
    set('border-size',10); set('border-color','#00ffcc');
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(5400);
  await page.waitForTimeout(800);
  const ready = await page.evaluate(() => ({
    takeDur: document.getElementById('take-badge-time').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    reviewDisabled: document.getElementById('btn-review').disabled,
    exportDisabled: document.getElementById('btn-export-merged').disabled,
    downloadRefDisabled: document.getElementById('btn-download-ref').disabled,
    downloadTakeDisabled: document.getElementById('btn-download-take').disabled,
    layoutSummary: document.getElementById('layout-summary').textContent,
    exportSummary: document.getElementById('export-summary').textContent,
    status: document.getElementById('status-text').textContent,
  }));
  console.log('READY', JSON.stringify(ready));
  await page.screenshot({path: '.qa/final-1-ready.png'});

  // review with seek
  await page.click('#btn-review');
  await page.waitForTimeout(1000);
  const rp = await page.evaluate(() => ({
    btn: document.getElementById('btn-review').textContent.trim(),
    status: document.getElementById('status-text').textContent,
    time: document.getElementById('review-time').textContent,
  }));
  console.log('REVIEW_RUN', JSON.stringify(rp));
  await page.evaluate(() => {
    const el = document.getElementById('review-progress'); el.value='500'; el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(1200);
  const rseek = await page.evaluate(() => ({
    time: document.getElementById('review-time').textContent,
    takeCt: document.getElementById('take-video').currentTime,
    refCt: document.querySelector('#ref-layer video').currentTime,
    paused: document.getElementById('take-video').paused,
  }));
  console.log('REVIEW_SEEK', JSON.stringify(rseek));
  await page.click('#btn-review');
  await page.waitForTimeout(600);
  const rstop = await page.evaluate(() => ({
    btn: document.getElementById('btn-review').textContent.trim(),
    status: document.getElementById('status-text').textContent,
    camLive: !!document.getElementById('cam-video').srcObject,
  }));
  console.log('REVIEW_STOP', JSON.stringify(rstop));

  // exports
  const saved=[];
  page.on('download', async d => { saved.push(d.suggestedFilename()); await d.saveAs('.qa/exports/'+d.suggestedFilename()); });
  async function runExport(btnId) {
    await page.click(btnId);
    const start=Date.now();
    while (Date.now()-start < 25000) {
      const on = await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
      if (!on) { await page.waitForTimeout(600); return; }
      await page.waitForTimeout(250);
    }
    console.log('TIMEOUT', btnId);
  }
  await runExport('#btn-download-ref');
  await runExport('#btn-download-take');
  await runExport('#btn-export-merged');
  await page.waitForTimeout(600);
  console.log('SAVED', JSON.stringify(saved));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
