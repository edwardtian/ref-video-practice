const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900}, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
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
  await page.waitForTimeout(800);
  console.log('TAKE_BEFORE', await page.evaluate(()=>document.getElementById('take-badge-time').textContent));

  // now shorten trim to 3s AFTER recording
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',1); set('trim-end',4);
  });
  await page.waitForTimeout(400);
  const afterTrim = await page.evaluate(() => ({
    trimLen: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    takeDur: document.getElementById('take-badge-time').textContent,
    hint: document.getElementById('review-hint').textContent,
    exportSummary: document.getElementById('export-summary').textContent,
    reviewDisabled: document.getElementById('btn-review').disabled,
    exportDisabled: document.getElementById('btn-export-merged').disabled,
  }));
  console.log('AFTER_TRIM_SHORTEN', JSON.stringify(afterTrim));

  // review should only play 3s window
  await page.click('#btn-review');
  await page.waitForTimeout(1500);
  const mid = await page.evaluate(() => ({
    t: Math.round(document.getElementById('take-video').currentTime*100)/100,
    rt: document.getElementById('review-time').textContent,
    paused: document.getElementById('take-video').paused,
    refCt: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100,
  }));
  console.log('REVIEW_MID', JSON.stringify(mid));
  await page.waitForTimeout(2200);
  const end = await page.evaluate(() => ({
    btn: document.getElementById('btn-review').textContent.trim(),
    rt: document.getElementById('review-time').textContent,
    toast: document.getElementById('toast').textContent,
    status: document.getElementById('status-text').textContent,
  }));
  console.log('REVIEW_END', JSON.stringify(end));

  // crop reset buttons
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('crop-left',20); set('tcrop-top',20);
  });
  await page.waitForTimeout(300);
  const beforeReset = await page.evaluate(()=>({refLeft: document.getElementById('crop-left-label').textContent, takeTop: document.getElementById('tcrop-top-label').textContent}));
  await page.click('#btn-crop-reset');
  await page.click('#btn-tcrop-reset');
  await page.waitForTimeout(300);
  const afterReset = await page.evaluate(()=>({
    refLeft: document.getElementById('crop-left-label').textContent,
    refW: document.getElementById('crop-width-label').textContent,
    takeTop: document.getElementById('tcrop-top-label').textContent,
    takeH: document.getElementById('tcrop-height-label').textContent,
  }));
  console.log('CROP_RESET', JSON.stringify({beforeReset, afterReset}));

  // export merged with new trim (3s window)
  await page.click('#btn-export-merged');
  const start=Date.now();
  while(Date.now()-start<25000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(!on){await page.waitForTimeout(700);break;}
    await page.waitForTimeout(250);
  }
  const ex = await page.evaluate(()=>window.__lastExport?{kind:window.__lastExport.kind,w:window.__lastExport.w,h:window.__lastExport.h,dur:window.__lastExport.dur,size:window.__lastExport.blob.size}:null);
  console.log('EXPORT_AFTER_TRIM', JSON.stringify(ex));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
