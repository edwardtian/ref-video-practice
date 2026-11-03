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
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',2); set('delay',0);
  });
  await page.waitForTimeout(400);

  await page.click('#btn-record');
  await page.waitForTimeout(600);
  await page.click('#btn-stop');
  await page.waitForTimeout(900);
  const st = await page.evaluate(()=>({
    countdownOn: document.getElementById('countdown-overlay').classList.contains('is-on'),
    recOn: document.getElementById('rec-overlay').classList.contains('is-on'),
    badge: document.getElementById('take-badge-label').textContent,
    badgeTime: document.getElementById('take-badge-time').textContent,
    status: document.getElementById('status-text').textContent,
    recordDisabled: document.getElementById('btn-record').disabled,
    toast: document.getElementById('toast').textContent,
    takeSrc: !!document.getElementById('take-video').src,
  }));
  console.log('CANCELLED', JSON.stringify(st));

  // record normally now
  await page.click('#btn-record');
  await page.waitForTimeout(3000+2000+1500);
  await page.waitForTimeout(900);
  console.log('TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src})));

  await page.click('#btn-review');
  await page.waitForTimeout(800);
  const r = await page.evaluate(()=>({
    t: Math.round(document.getElementById('take-video').currentTime*100)/100,
    ref: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100,
    refPaused: document.querySelector('#ref-layer video').paused,
    rt: document.getElementById('review-time').textContent,
    hint: document.getElementById('review-hint').textContent,
  }));
  console.log('REVIEW_D0', JSON.stringify(r));
  await page.click('#btn-review');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',2); set('delay',3);
  });
  await page.waitForTimeout(400);
  console.log('DELAY3', await page.evaluate(()=>({
    recLimit: document.getElementById('rec-limit').textContent,
    exportSummary: document.getElementById('export-summary').textContent,
    hint: document.getElementById('delay-hint').textContent,
  })));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
