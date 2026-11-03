const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1920,height:1080} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',7);
    set('crop-left',5); set('crop-top',0); set('crop-width',90); set('crop-height',90);
    set('ref-out-width',720);
    set('tcrop-left',0); set('tcrop-top',8); set('tcrop-width',100); set('tcrop-height',86);
    set('take-out-width',720);
    set('border-size',16); set('border-color','#ff4d6d');
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(5400);
  await page.waitForTimeout(900);
  await page.screenshot({path: '.qa/final-wide-ready.png', fullPage: false});
  const dims = await page.evaluate(() => ({
    refCell: (()=>{const r=document.getElementById('ref-cell').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),y:Math.round(r.y)}})(),
    refPanel: (()=>{const r=document.getElementById('ref-panel').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),y:Math.round(r.y)}})(),
    takeCell: (()=>{const r=document.getElementById('take-cell').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),y:Math.round(r.y)}})(),
    takePanel: (()=>{const r=document.getElementById('take-panel').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),y:Math.round(r.y)}})(),
    docHeight: document.documentElement.scrollHeight,
    viewportH: window.innerHeight,
  }));
  console.log('WIDE_DIMS', JSON.stringify(dims));

  // export overlay screenshot
  await page.click('#btn-export-merged');
  await page.waitForTimeout(1400);
  await page.screenshot({path: '.qa/final-wide-export.png'});
  const ov = await page.evaluate(() => ({on: document.getElementById('export-overlay').classList.contains('is-on'), title: document.getElementById('export-title').textContent, status: document.getElementById('export-status').textContent}));
  console.log('OVERLAY', JSON.stringify(ov));
  const start=Date.now();
  while(Date.now()-start<25000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(!on){break;}
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(600);
  await page.screenshot({path: '.qa/final-wide-done.png'});
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
