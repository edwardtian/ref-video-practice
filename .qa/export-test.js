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
  await page.waitForTimeout(800);
  const fi = await page.$('#file-input');
  await fi.setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1800);

  // trim 2..7
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',7);
  });
  await page.waitForTimeout(300);

  // record 5s
  await page.click('#btn-record');
  await page.waitForTimeout(5600);
  await page.waitForTimeout(700);
  console.log('TAKE_DUR', await page.evaluate(()=>document.getElementById('take-badge-time').textContent));

  // crop ref and take, set widths
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('crop-left',10); set('crop-top',5); set('crop-width',80); set('crop-height',75);
    set('ref-out-width',480);
    set('tcrop-left',5); set('tcrop-top',10); set('tcrop-width',90); set('tcrop-height',80);
    set('take-out-width',480);
    set('border-size',12); set('border-color','#ffcc00');
  });
  await page.waitForTimeout(400);
  console.log('ASPECTS', await page.evaluate(()=>({ref: document.getElementById('ref-cell').style.aspectRatio, take: document.getElementById('take-cell').style.aspectRatio})));

  // Export reference only
  await page.click('#btn-download-ref');
  await page.waitForTimeout(1500);
  const e1 = await page.evaluate(() => window.__lastExport ? {kind: window.__lastExport.kind, w: window.__lastExport.w, h: window.__lastExport.h, dur: window.__lastExport.dur, size: window.__lastExport.blob.size, type: window.__lastExport.blob.type} : null);
  console.log('EXPORT_REF', JSON.stringify(e1));

  // Export take only
  await page.click('#btn-download-take');
  await page.waitForTimeout(1500);
  const e2 = await page.evaluate(() => window.__lastExport ? {kind: window.__lastExport.kind, w: window.__lastExport.w, h: window.__lastExport.h, dur: window.__lastExport.dur, size: window.__lastExport.blob.size} : null);
  console.log('EXPORT_TAKE', JSON.stringify(e2));

  // Export merged
  await page.click('#btn-export-merged');
  await page.waitForTimeout(1500);
  const e3 = await page.evaluate(() => window.__lastExport ? {kind: window.__lastExport.kind, w: window.__lastExport.w, h: window.__lastExport.h, dur: window.__lastExport.dur, size: window.__lastExport.blob.size} : null);
  console.log('EXPORT_MERGED', JSON.stringify(e3));

  // validate merged audio + decodability
  const v3 = await page.evaluate(async () => {
    const ex = window.__lastExport;
    if (!ex) return null;
    const buf = await ex.blob.arrayBuffer();
    const ac = new AudioContext();
    let dec=null, err=null;
    try { dec = await ac.decodeAudioData(buf.slice(0)); } catch(e){ err=String(e&&e.message||e); }
    const v=document.createElement('video'); const u=URL.createObjectURL(ex.blob); v.src=u; v.muted=true;
    const meta=await new Promise(r=>{v.onloadedmetadata=()=>r({dur:v.duration,w:v.videoWidth,h:v.videoHeight}); v.onerror=()=>r({err:String(v.error&&v.error.message)}); setTimeout(()=>r({timeout:1}),4000)});
    let frames=0; const step=(n,e)=>{frames++; if(frames<12) v.requestVideoFrameCallback(step);};
    v.requestVideoFrameCallback(step);
    await v.play().catch(()=>{});
    await new Promise(r=>setTimeout(r,900));
    await ac.close();
    return {audio: dec?{dur:dec.duration,ch:dec.numberOfChannels}:null, audioErr:err, meta, frames, ct:v.currentTime};
  });
  console.log('MERGED_VALIDATE', JSON.stringify(v3));
  await page.screenshot({path: '.qa/desk-8-exported.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
