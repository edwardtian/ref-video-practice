const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000}, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('download', async d => { await d.saveAs('.qa/exports/'+d.suggestedFilename()); console.log('DL', d.suggestedFilename()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5);  // 3s trim
    set('delay',1.0);
    set('border-size',10); set('border-color','#00ffcc');
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(3600+800+2000);
  await page.waitForTimeout(900);
  console.log('TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent})));
  await page.click('#btn-export-merged');
  const start=Date.now(); let opened=false;
  while(Date.now()-start<30000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(on) opened=true; else if(opened) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900);
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
