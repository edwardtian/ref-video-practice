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

  // YouTube provider with delay
  await page.click('#tab-url');
  await page.fill('#url-input','https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await page.click('#btn-load-url');
  await page.waitForTimeout(9000);
  const yt = await page.evaluate(()=>({
    badge: document.getElementById('ref-badge-label').textContent,
    time: document.getElementById('ref-badge-time').textContent,
    cropDisabled: document.getElementById('crop-left').disabled,
    drawDisabled: document.getElementById('btn-crop-draw').disabled,
    downloadHint: document.getElementById('ref-download-hint').textContent,
    cropHintHidden: document.getElementById('crop-hint').classList.contains('is-hidden'),
    delay: document.getElementById('delay').value,
  }));
  console.log('YOUTUBE', JSON.stringify(yt));

  // switch to local file, trim, delay, crop, record, export
  await page.click('#tab-upload');
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5); set('delay',0.5);
    set('crop-left',10); set('crop-top',10); set('crop-width',70); set('crop-height',70);
    set('ref-out-width',480);
    set('tcrop-left',0); set('tcrop-top',5); set('tcrop-width',100); set('tcrop-height',90);
    set('take-out-width',480);
    set('border-size',12); set('border-color','#00ffcc');
  });
  await page.waitForTimeout(400);
  console.log('STATE', await page.evaluate(()=>({
    trimLen: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    refAspect: document.getElementById('ref-cell').style.aspectRatio,
    takeAspect: document.getElementById('take-cell').style.aspectRatio,
    exportSummary: document.getElementById('export-summary').textContent,
    refCropHidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    takeCropHidden: document.getElementById('take-crop-overlay').classList.contains('is-hidden'),
  })));

  await page.click('#btn-record');
  await page.waitForTimeout(650);
  console.log('CD_BADGE', await page.evaluate(()=>({badge: document.getElementById('take-badge-label').textContent, badgeTime: document.getElementById('take-badge-time').textContent, mini: document.getElementById('take-badge-mini').textContent, status: document.getElementById('status-text').textContent})));
  await page.waitForTimeout(3000+800+2500);
  await page.waitForTimeout(900);
  console.log('TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src})));

  // exports with frames
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
    return await page.evaluate(()=>window.__lastExport?{kind:window.__lastExport.kind,w:window.__lastExport.w,h:window.__lastExport.h,dur:window.__lastExport.dur}:null);
  }
  const r1 = await runExport('#btn-download-ref');
  const r2 = await runExport('#btn-download-take');
  const r3 = await runExport('#btn-export-merged');
  console.log('EXPORTS', JSON.stringify({ref:r1, take:r2, merged:r3}));
  console.log('SAVED', JSON.stringify(saved));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
