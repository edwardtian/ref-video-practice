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
    set('trim-start',2); set('trim-end',6);
  });
  await page.waitForTimeout(400);
  const pre = await page.evaluate(() => ({
    refCropHidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    takeCropHidden: document.getElementById('take-crop-overlay').classList.contains('is-hidden'),
    countdownOn: document.getElementById('countdown-overlay').classList.contains('is-on'),
    recOn: document.getElementById('rec-overlay').classList.contains('is-on'),
  }));
  console.log('PRE', JSON.stringify(pre));
  await page.click('#btn-record');
  await page.waitForTimeout(700);
  const mid = await page.evaluate(() => ({
    n: document.getElementById('countdown-number').textContent,
    on: document.getElementById('countdown-overlay').classList.contains('is-on'),
    recOn: document.getElementById('rec-overlay').classList.contains('is-on'),
    status: document.getElementById('status-text').textContent,
    badge: document.getElementById('take-badge-label').textContent,
    badgeTime: document.getElementById('take-badge-time').textContent,
    refCropHidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    takeCropHidden: document.getElementById('take-crop-overlay').classList.contains('is-hidden'),
  }));
  console.log('COUNTDOWN_MID', JSON.stringify(mid));
  await page.screenshot({path: '.qa/t4-countdown-live.png'});
  await page.waitForTimeout(3200);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    n: document.getElementById('countdown-number').textContent,
    on: document.getElementById('countdown-overlay').classList.contains('is-on'),
    recOn: document.getElementById('rec-overlay').classList.contains('is-on'),
    timer: document.getElementById('rec-timer').textContent,
    cap: document.getElementById('rec-cap').textContent,
    dur: document.getElementById('take-badge-time').textContent,
  }));
  console.log('AFTER', JSON.stringify(after));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
