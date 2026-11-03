const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5);
    set('border-size',18); set('border-color','#00aa55');
    set('crop-left',10); set('ref-out-width',600);
  });
  await page.waitForTimeout(300);
  await page.click('#btn-record');
  await page.waitForTimeout(3400);
  await page.waitForTimeout(800);
  console.log('T1', await page.evaluate(()=>({take: document.getElementById('take-badge-time').textContent, refLen: document.getElementById('trim-length').textContent})));

  // record again while a take exists
  await page.click('#btn-record');
  await page.waitForTimeout(1000);
  const during2 = await page.evaluate(() => ({
    overlay: document.getElementById('rec-overlay').classList.contains('is-on'),
    camLayer: document.getElementById('cam-layer').style.display,
    takeLayer: document.getElementById('take-layer').style.display,
    takeSrc: !!document.getElementById('take-video').src,
    timer: document.getElementById('rec-timer').textContent,
  }));
  console.log('REC2_DURING', JSON.stringify(during2));
  await page.waitForTimeout(2600);
  await page.waitForTimeout(800);
  console.log('T2', await page.evaluate(()=>({take: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src})));

  // reset session
  await page.click('#btn-reset');
  await page.waitForTimeout(800);
  const reset = await page.evaluate(() => ({
    refEmpty: !document.getElementById('ref-empty').classList.contains('is-hidden'),
    takeSrc: !!document.getElementById('take-video').src,
    trimLen: document.getElementById('trim-length').textContent,
    borderLabel: document.getElementById('border-size-label').textContent,
    borderWrap: document.getElementById('divider-wrap').style.display,
    refWidth: document.getElementById('ref-width-label').textContent,
    takeWidth: document.getElementById('take-width-label').textContent,
    cropLeft: document.getElementById('crop-left-label').textContent,
    refLayerChildren: document.getElementById('ref-layer').children.length,
    downloadRefDisabled: document.getElementById('btn-download-ref').disabled,
    exportDisabled: document.getElementById('btn-export-merged').disabled,
    camLive: !!document.getElementById('cam-video').srcObject,
    toast: document.getElementById('toast').textContent,
  }));
  console.log('RESET', JSON.stringify(reset));
  await page.screenshot({path: '.qa/reset-after.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
