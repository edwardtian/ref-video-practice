const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
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
  await page.waitForTimeout(500);
  await page.click('#btn-record');
  await page.waitForTimeout(5400);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.click('#btn-review');
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForTimeout(200);
  const vis = await page.evaluate(() => ({
    refLayer: document.getElementById('ref-layer').children.length,
    refVideoPaused: document.querySelector('#ref-layer video').paused,
    refCt: document.querySelector('#ref-layer video').currentTime,
    takeCt: document.getElementById('take-video').currentTime,
    takePaused: document.getElementById('take-video').paused,
    takeMuted: document.getElementById('take-video').muted,
    refMuted: document.querySelector('#ref-layer video').muted,
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
  }));
  console.log('REVIEW_VIS', JSON.stringify(vis));
  await page.screenshot({path: 'screenshots/desktop-review.png'});
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
