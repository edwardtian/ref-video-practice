const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });

  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await page.screenshot({path: 'screenshots/desktop-empty.png'});

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
  await page.waitForTimeout(500);
  await page.screenshot({path: 'screenshots/desktop-trimmed.png'});

  await page.click('#btn-record');
  await page.waitForTimeout(5400);
  await page.waitForTimeout(900);
  await page.screenshot({path: 'screenshots/desktop-ready.png'});

  await page.click('#btn-review');
  await page.waitForTimeout(1600);
  await page.screenshot({path: 'screenshots/desktop-review.png'});

  await page.click('#btn-review');
  await page.waitForTimeout(600);

  await page.click('#btn-export-merged');
  await page.waitForTimeout(1400);
  await page.screenshot({path: 'screenshots/desktop-export.png'});
  const start=Date.now();
  while(Date.now()-start<30000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(!on){break;}
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(700);
  await page.screenshot({path: 'screenshots/desktop-export-done.png'});

  // narrow viewport
  await page.setViewportSize({width:900,height:1000});
  await page.waitForTimeout(500);
  await page.screenshot({path: 'screenshots/desktop-narrow.png'});

  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
