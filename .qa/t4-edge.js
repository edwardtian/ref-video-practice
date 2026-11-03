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

  // delay 0
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',2); set('delay',0);
  });
  await page.waitForTimeout(400);
  console.log('DELAY0', await page.evaluate(()=>({
    recLimit: document.getElementById('rec-limit').textContent,
    hint: document.getElementById('delay-hint').textContent,
    delayLabel: document.getElementById('delay-label').textContent,
  })));

  await page.click('#btn-record');
  await page.waitForTimeout(600);
  console.log('CD', await page.evaluate(()=>({n: document.getElementById('countdown-number').textContent, on: document.getElementById('countdown-overlay').classList.contains('is-on'), stopDisabled: document.getElementById('btn-stop').disabled})));
  // stop during countdown
  await page.click('#btn-stop');
  await page.waitForTimeout(700);
  console.log('STOP_DURING_CD', await page.evaluate(()=>({
    countdownOn: document.getElementById('countdown-overlay').classList.contains('is-on'),
    recording: document.getElementById('rec-overlay').classList.contains('is-on'),
    takeSrc: !!document.getElementById('take-video').src,
    badge: document.getElementById('take-badge-label').textContent,
    status: document.getElementById('status-text').textContent,
    recordDisabled: document.getElementById('btn-record').disabled,
    toast: document.getElementById('toast').textContent,
  })));

  // now record with delay 0 fully
  await page.click('#btn-record');
  await page.waitForTimeout(3000+2000+1500);
  await page.waitForTimeout(900);
  console.log('TAKE_D0', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src})));

  // review with delay 0
  await page.click('#btn-review');
  await page.waitForTimeout(800);
  console.log('REVIEW_D0', await page.evaluate(()=>({
    t: Math.round(document.getElementById('take-video').currentTime*100)/100,
    r: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100,
    rp: document.querySelector('#ref-layer video').paused,
    rt: document.getElementById('review-time').textContent,
    hint: document.getElementById('review-hint').textContent,
  })));
  await page.click('#btn-review');
  await page.waitForTimeout(500);

  // large delay 3s with trim 2s
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
