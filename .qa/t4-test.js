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
  const init = await page.evaluate(() => ({
    delayLabel: document.getElementById('delay-label').textContent,
    delayValue: document.getElementById('delay').value,
    delayHint: document.getElementById('delay-hint').textContent,
    cookie: document.cookie,
    cropOverlayHidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    countdownOn: document.getElementById('countdown-overlay').classList.contains('is-on'),
    drawBtn: document.getElementById('btn-crop-draw').textContent,
  }));
  console.log('INIT', JSON.stringify(init));

  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',6);   // 4s trim
    set('delay',0.5);
  });
  await page.waitForTimeout(400);
  const limits = await page.evaluate(() => ({
    trimLen: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    hint: document.getElementById('review-hint').textContent,
    exportSummary: document.getElementById('export-summary').textContent,
    delayLabel: document.getElementById('delay-label').textContent,
  }));
  console.log('LIMITS', JSON.stringify(limits));

  // click record -> countdown
  await page.click('#btn-record');
  const cd = [];
  for (let i=0;i<8;i++) {
    await page.waitForTimeout(450);
    const s = await page.evaluate(() => ({
      n: document.getElementById('countdown-number').textContent,
      on: document.getElementById('countdown-overlay').classList.contains('is-on'),
      rec: document.getElementById('rec-overlay').classList.contains('is-on'),
      badge: document.getElementById('take-badge-label').textContent,
      timer: document.getElementById('rec-timer').textContent,
      status: document.getElementById('status-text').textContent,
    }));
    cd.push(s);
  }
  console.log('COUNTDOWN', JSON.stringify(cd));
  await page.screenshot({path: '.qa/t4-countdown.png'});
  await page.waitForTimeout(5000);
  await page.waitForTimeout(800);
  const take = await page.evaluate(() => ({
    dur: document.getElementById('take-badge-time').textContent,
    src: !!document.getElementById('take-video').src,
    badge: document.getElementById('take-badge-label').textContent,
    countdownOn: document.getElementById('countdown-overlay').classList.contains('is-on'),
  }));
  console.log('TAKE', JSON.stringify(take));
  await page.screenshot({path: '.qa/t4-take.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
