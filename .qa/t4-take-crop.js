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
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(1000);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',3); set('delay',0.5);
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(3600+800+2000);
  await page.waitForTimeout(900);
  console.log('TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent})));

  // draw take crop
  await page.click('#btn-tcrop-draw');
  await page.waitForTimeout(200);
  const mode = await page.evaluate(()=>({
    btn: document.getElementById('btn-tcrop-draw').textContent,
    active: document.getElementById('take-crop-overlay').classList.contains('is-active'),
    hidden: document.getElementById('take-crop-overlay').classList.contains('is-hidden'),
    label: document.getElementById('take-crop-box-label').textContent,
  }));
  console.log('TAKE_MODE', JSON.stringify(mode));
  const rect = await (await page.$('#take-crop-overlay')).boundingBox();
  const x1=rect.x+rect.width*0.25, y1=rect.y+rect.height*0.15;
  const x2=rect.x+rect.width*0.85, y2=rect.y+rect.height*0.75;
  await page.mouse.move(x1,y1); await page.mouse.down();
  await page.mouse.move(x2,y2,{steps:8}); await page.mouse.up();
  await page.waitForTimeout(400);
  const drawn = await page.evaluate(()=>({
    left: document.getElementById('tcrop-left-label').textContent,
    top: document.getElementById('tcrop-top-label').textContent,
    width: document.getElementById('tcrop-width-label').textContent,
    height: document.getElementById('tcrop-height-label').textContent,
    boxLabel: document.getElementById('take-crop-box-label').textContent,
    aspect: document.getElementById('take-cell').style.aspectRatio,
    outH: document.getElementById('take-out-height').textContent,
    cookieHas: document.cookie.includes('mirrorPracticePrefs'),
  }));
  console.log('TAKE_DRAWN', JSON.stringify(drawn));
  await page.screenshot({path: '.qa/t4-take-crop.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
