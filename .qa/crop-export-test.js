const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900}, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('download', async d => { await d.saveAs('.qa/exports/'+d.suggestedFilename()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5);
    set('crop-left',10); set('crop-top',20); set('crop-width',60); set('crop-height',50);
    set('ref-out-width',480);
  });
  await page.waitForTimeout(400);
  const exp = await page.evaluate(()=>({aspect: document.getElementById('ref-cell').style.aspectRatio, h: document.getElementById('ref-out-height').textContent, w: document.getElementById('ref-width-label').textContent}));
  console.log('EXPECTED', JSON.stringify(exp));
  await page.click('#btn-download-ref');
  const start=Date.now();
  while(Date.now()-start<20000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(!on){await page.waitForTimeout(600);break;}
    await page.waitForTimeout(250);
  }
  const ex = await page.evaluate(()=>window.__lastExport?{w:window.__lastExport.w,h:window.__lastExport.h,dur:window.__lastExport.dur}:null);
  console.log('EXPORTED', JSON.stringify(ex));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
