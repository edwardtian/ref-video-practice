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
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);

  // set preferences
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',6);
    set('crop-left',15); set('crop-top',10); set('crop-width',70); set('crop-height',75);
    set('ref-out-width',600);
    set('tcrop-left',5); set('tcrop-top',10); set('tcrop-width',90); set('tcrop-height',80);
    set('take-out-width',540);
    set('border-size',18); set('border-color','#00aa55');
    set('delay',1.2);
  });
  await page.waitForTimeout(600);
  await page.click('#btn-ref-mute');
  await page.click('#btn-ref-loop');
  await page.waitForTimeout(600);
  const cookie = await page.evaluate(() => document.cookie);
  console.log('COOKIE_RAW', cookie.length, cookie.slice(0,120));
  const decoded = await page.evaluate(() => {
    const hit = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('mirrorPracticePrefs='));
    return hit ? JSON.parse(decodeURIComponent(hit.slice('mirrorPracticePrefs='.length))) : null;
  });
  console.log('COOKIE_OBJ', JSON.stringify(decoded));

  // reload
  await page.reload();
  await page.waitForTimeout(1000);
  const restored = await page.evaluate(() => ({
    trimStart: document.getElementById('trim-start').value,
    trimEnd: document.getElementById('trim-end').value,
    trimLen: document.getElementById('trim-length').textContent,
    cropLeft: document.getElementById('crop-left-label').textContent,
    cropTop: document.getElementById('crop-top-label').textContent,
    cropWidth: document.getElementById('crop-width-label').textContent,
    cropHeight: document.getElementById('crop-height-label').textContent,
    refWidth: document.getElementById('ref-width-label').textContent,
    refOutW: document.getElementById('ref-out-width').value,
    tcropLeft: document.getElementById('tcrop-left-label').textContent,
    tcropWidth: document.getElementById('tcrop-width-label').textContent,
    takeOutW: document.getElementById('take-out-width').value,
    borderSize: document.getElementById('border-size-label').textContent,
    borderColor: document.getElementById('border-color').value,
    delay: document.getElementById('delay').value,
    delayLabel: document.getElementById('delay-label').textContent,
    muted: document.querySelector('#ref-layer video') ? document.querySelector('#ref-layer video').muted : null,
    loopPrimary: document.getElementById('btn-ref-loop').classList.contains('primary'),
    trimDisabled: document.getElementById('trim-start').disabled,
    cropHidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    toast: document.getElementById('toast').textContent,
  }));
  console.log('RESTORED', JSON.stringify(restored));
  await page.screenshot({path: '.qa/t4-cookie-restored.png'});

  // load reference again; trim should restore
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  const trimmed = await page.evaluate(() => ({
    trimStart: document.getElementById('trim-start').value,
    trimEnd: document.getElementById('trim-end').value,
    trimLen: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    toast: document.getElementById('toast').textContent,
    toastOn: document.getElementById('toast').classList.contains('is-on'),
  }));
  console.log('TRIM_RESTORED', JSON.stringify(trimmed));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
