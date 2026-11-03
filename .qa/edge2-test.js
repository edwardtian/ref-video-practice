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
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref.mp4');   // silent reference
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',8);
    set('border-size',0);
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(2200);
  await page.click('#btn-stop');     // early stop ~2s
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => ({
    takeDur: document.getElementById('take-badge-time').textContent,
    trimLen: document.getElementById('trim-length').textContent,
    hint: document.getElementById('review-hint').textContent,
    exportSummary: document.getElementById('export-summary').textContent,
    borderWrap: document.getElementById('divider-wrap').style.display,
  }));
  console.log('EARLY_STOP', JSON.stringify(st));

  // review with shorter take
  await page.click('#btn-review');
  await page.waitForTimeout(1400);
  const rev = await page.evaluate(() => ({
    rt: document.getElementById('review-time').textContent,
    tt: Math.round(document.getElementById('take-video').currentTime*100)/100,
    paused: document.getElementById('take-video').paused,
    refCt: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100,
  }));
  console.log('REVIEW', JSON.stringify(rev));
  await page.waitForTimeout(1500);
  const revEnd = await page.evaluate(() => ({
    btn: document.getElementById('btn-review').textContent.trim(),
    toast: document.getElementById('toast').textContent,
    rt: document.getElementById('review-time').textContent,
  }));
  console.log('REVIEW_END', JSON.stringify(revEnd));

  // export merged (silent ref + take audio)
  await page.click('#btn-export-merged');
  const start=Date.now();
  while(Date.now()-start<20000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(!on){await page.waitForTimeout(600);break;}
    await page.waitForTimeout(250);
  }
  const ex = await page.evaluate(()=>window.__lastExport?{kind:window.__lastExport.kind,w:window.__lastExport.w,h:window.__lastExport.h,dur:window.__lastExport.dur,size:window.__lastExport.blob.size}:null);
  console.log('EXPORT', JSON.stringify(ex));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
