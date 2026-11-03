const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000}, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });

  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);
  console.log('EMPTY_STATE', await page.evaluate(()=>({
    refEmpty: !document.getElementById('ref-empty').classList.contains('is-hidden'),
    drawDisabled: document.getElementById('btn-crop-draw').disabled,
    takeDrawDisabled: document.getElementById('btn-tcrop-draw').disabled,
    delay: document.getElementById('delay').value,
    delayLabel: document.getElementById('delay-label').textContent,
    cookie: document.cookie,
  })));

  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5); set('delay',0.5);
    set('border-size',12); set('border-color','#ff4d6d');
  });
  await page.waitForTimeout(400);
  console.log('READY', await page.evaluate(()=>({
    trimLen: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    drawDisabled: document.getElementById('btn-crop-draw').disabled,
    delayLabel: document.getElementById('delay-label').textContent,
  })));

  await page.click('#btn-record');
  await page.waitForTimeout(600);
  const cd = await page.evaluate(()=>({n: document.getElementById('countdown-number').textContent, on: document.getElementById('countdown-overlay').classList.contains('is-on'), badge: document.getElementById('take-badge-label').textContent}));
  console.log('COUNTDOWN', JSON.stringify(cd));
  await page.waitForTimeout(3000+800+2000);
  await page.waitForTimeout(900);
  console.log('TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src})));

  // crop reference via sliders
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('crop-left',10); set('crop-top',5); set('crop-width',80); set('crop-height',80);
    set('ref-out-width',600);
    set('tcrop-left',0); set('tcrop-top',10); set('tcrop-width',100); set('tcrop-height',85);
    set('take-out-width',600);
  });
  await page.waitForTimeout(400);
  console.log('CROP_STATE', await page.evaluate(()=>({
    refAspect: document.getElementById('ref-cell').style.aspectRatio,
    takeAspect: document.getElementById('take-cell').style.aspectRatio,
    refCropHidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    takeCropHidden: document.getElementById('take-crop-overlay').classList.contains('is-hidden'),
    exportSummary: document.getElementById('export-summary').textContent,
  })));

  // review with delay
  await page.click('#btn-review');
  await page.waitForTimeout(900);
  const rev = await page.evaluate(()=>({
    t: Math.round(document.getElementById('take-video').currentTime*100)/100,
    r: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100,
    rp: document.querySelector('#ref-layer video').paused,
    tp: document.getElementById('take-video').paused,
    btn: document.getElementById('btn-review').textContent.trim(),
    hint: document.getElementById('review-hint').textContent,
  }));
  console.log('REVIEW_EARLY', JSON.stringify(rev));
  await page.waitForTimeout(1200);
  const rev2 = await page.evaluate(()=>({
    t: Math.round(document.getElementById('take-video').currentTime*100)/100,
    r: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100,
    rt: document.getElementById('review-time').textContent,
    paused: document.getElementById('take-video').paused,
  }));
  console.log('REVIEW_LATE', JSON.stringify(rev2));
  await page.waitForTimeout(2500);
  const revEnd = await page.evaluate(()=>({btn: document.getElementById('btn-review').textContent.trim(), rt: document.getElementById('review-time').textContent, toast: document.getElementById('toast').textContent}));
  console.log('REVIEW_END', JSON.stringify(revEnd));

  // exports: ref, take, merged
  const saved=[];
  page.on('download', async d => { saved.push(d.suggestedFilename()); await d.saveAs('.qa/exports/'+d.suggestedFilename()); });
  async function runExport(btnId){
    await page.click(btnId);
    const start=Date.now(); let opened=false;
    while(Date.now()-start<30000){
      const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
      if(on) opened=true; else if(opened) break;
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(600);
  }
  await runExport('#btn-download-ref');
  await runExport('#btn-download-take');
  await runExport('#btn-export-merged');
  await page.waitForTimeout(600);
  console.log('SAVED', JSON.stringify(saved));
  const last = await page.evaluate(()=>window.__lastExport?{kind:window.__lastExport.kind,w:window.__lastExport.w,h:window.__lastExport.h,dur:window.__lastExport.dur}:null);
  console.log('LAST_EXPORT', JSON.stringify(last));

  // cookie state after everything
  const cookieObj = await page.evaluate(() => {
    const hit = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('mirrorPracticePrefs='));
    return hit ? JSON.parse(decodeURIComponent(hit.slice('mirrorPracticePrefs='.length))) : null;
  });
  console.log('COOKIE', JSON.stringify(cookieObj));
  await page.screenshot({path: '.qa/t4-final.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
