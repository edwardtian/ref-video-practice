const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(800);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',4);
    set('border-size',0);
  });
  await page.waitForTimeout(300);
  const border0 = await page.evaluate(() => ({
    wrapDisplay: document.getElementById('divider-wrap').style.display,
    dividerDisplay: document.getElementById('divider').style.display,
    label: document.getElementById('border-size-label').textContent,
  }));
  console.log('BORDER0', JSON.stringify(border0));

  await page.click('#btn-record');
  await page.waitForTimeout(4400);
  await page.waitForTimeout(700);
  const take = await page.evaluate(() => ({
    dur: document.getElementById('take-badge-time').textContent,
    src: !!document.getElementById('take-video').src,
    playBtnDisabled: document.getElementById('btn-take-play').disabled,
    overlayOn: document.getElementById('take-play-overlay').classList.contains('is-on'),
  }));
  console.log('TAKE', JSON.stringify(take));

  // take-only playback
  await page.click('#btn-take-play');
  await page.waitForTimeout(1200);
  const tp = await page.evaluate(() => ({
    paused: document.getElementById('take-video').paused,
    ct: document.getElementById('take-video').currentTime,
    muted: document.getElementById('take-video').muted,
    btn: document.getElementById('btn-take-play').textContent.trim(),
    camLive: !!document.getElementById('cam-video').srcObject,
  }));
  console.log('TAKE_PLAY', JSON.stringify(tp));
  await page.waitForTimeout(3200);
  const tpEnd = await page.evaluate(() => ({
    paused: document.getElementById('take-video').paused,
    btn: document.getElementById('btn-take-play').textContent.trim(),
    camLive: !!document.getElementById('cam-video').srcObject,
  }));
  console.log('TAKE_PLAY_END', JSON.stringify(tpEnd));

  // review both
  await page.click('#btn-review');
  await page.waitForTimeout(1500);
  const rev = await page.evaluate(() => ({
    takePaused: document.getElementById('take-video').paused,
    takeMuted: document.getElementById('take-video').muted,
    refMuted: document.querySelector('#ref-layer video').muted,
    btnReview: document.getElementById('btn-review').textContent.trim(),
    btnRef: document.getElementById('btn-ref-play').textContent.trim(),
    camLive: !!document.getElementById('cam-video').srcObject,
    hint: document.getElementById('review-hint').textContent,
    status: document.getElementById('status-text').textContent,
  }));
  console.log('REVIEW', JSON.stringify(rev));
  await page.screenshot({path: '.qa/desk-12-review.png'});
  await page.waitForTimeout(3000);
  const revEnd = await page.evaluate(() => ({
    btnReview: document.getElementById('btn-review').textContent.trim(),
    status: document.getElementById('status-text').textContent,
    camLive: !!document.getElementById('cam-video').srcObject,
    takePaused: document.getElementById('take-video').paused,
  }));
  console.log('REVIEW_END', JSON.stringify(revEnd));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
