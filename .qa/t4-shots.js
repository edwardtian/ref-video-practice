const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);
  await page.screenshot({path: 'screenshots/desktop-empty.png'});

  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',6);
    set('delay',0.8);
    set('border-size',14); set('border-color','#ff4d6d');
    set('ref-out-width',720); set('take-out-width',720);
  });
  await page.waitForTimeout(400);

  // crop rectangle on reference
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(200);
  const rect = await (await page.$('#ref-crop-overlay')).boundingBox();
  const x1=rect.x+rect.width*0.15, y1=rect.y+rect.height*0.10;
  const x2=rect.x+rect.width*0.85, y2=rect.y+rect.height*0.80;
  await page.mouse.move(x1,y1); await page.mouse.down();
  await page.mouse.move(x2,y2,{steps:8}); await page.mouse.up();
  await page.waitForTimeout(400);
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path: 'screenshots/desktop-crop-draw.png'});

  // countdown screenshot
  await page.click('#btn-record');
  await page.waitForTimeout(650);
  await page.screenshot({path: 'screenshots/desktop-countdown.png'});
  await page.waitForTimeout(3000+800+2500);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path: 'screenshots/desktop-ready.png'});

  // review showing delay
  await page.click('#btn-review');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForTimeout(150);
  await page.screenshot({path: 'screenshots/desktop-review-delay.png'});
  await page.click('#btn-review');
  await page.waitForTimeout(500);

  // export overlay
  await page.click('#btn-export-merged');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path: 'screenshots/desktop-export.png'});
  const start=Date.now(); let opened=false;
  while(Date.now()-start<30000){
    const on=await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    if(on) opened=true; else if(opened) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900);
  await page.screenshot({path: 'screenshots/desktop-export-done.png'});
  console.log('done');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
