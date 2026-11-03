const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',4);
  });
  await page.waitForTimeout(300);
  await page.click('#btn-record');
  await page.waitForTimeout(4400);
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => ({
    camLayer: document.getElementById('cam-layer').style.display,
    takeLayer: document.getElementById('take-layer').style.display,
    overlay: document.getElementById('take-play-overlay').classList.contains('is-on'),
    camEmpty: document.getElementById('cam-empty').classList.contains('is-hidden'),
    takeBadge: document.getElementById('take-badge-label').textContent,
    takeMuted: document.getElementById('take-video').muted,
    camLive: !!document.getElementById('cam-video').srcObject,
    recordDisabled: document.getElementById('btn-record').disabled,
    stopDisabled: document.getElementById('btn-stop').disabled,
    retakeDisabled: document.getElementById('btn-retake').disabled,
    playDisabled: document.getElementById('btn-take-play').disabled,
    downloadDisabled: document.getElementById('btn-download-take').disabled,
  }));
  console.log('AFTER_REC', JSON.stringify(st));
  await page.screenshot({path: '.qa/state-after-rec.png'});

  // play take, then stop via button
  await page.click('#btn-take-play');
  await page.waitForTimeout(900);
  const playing = await page.evaluate(() => ({
    paused: document.getElementById('take-video').paused,
    btnLabel: document.getElementById('btn-take-play').textContent.trim(),
    btnDisabled: document.getElementById('btn-take-play').disabled,
    overlay: document.getElementById('take-play-overlay').classList.contains('is-on'),
    camLive: !!document.getElementById('cam-video').srcObject,
  }));
  console.log('TAKE_PLAYING', JSON.stringify(playing));
  await page.click('#btn-take-play');
  await page.waitForTimeout(700);
  const stopped = await page.evaluate(() => ({
    paused: document.getElementById('take-video').paused,
    btnLabel: document.getElementById('btn-take-play').textContent.trim(),
    camLive: !!document.getElementById('cam-video').srcObject,
    camLayer: document.getElementById('cam-layer').style.display,
    takeLayer: document.getElementById('take-layer').style.display,
  }));
  console.log('TAKE_STOPPED', JSON.stringify(stopped));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
