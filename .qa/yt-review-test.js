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
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(700);
  await page.click('#tab-url');
  await page.fill('#url-input', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await page.click('#btn-load-url');
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',5); set('trim-end',9);
  });
  await page.waitForTimeout(400);
  console.log('YT_TRIM', await page.evaluate(()=>({len: document.getElementById('trim-length').textContent, limit: document.getElementById('rec-limit').textContent})));
  await page.click('#btn-record');
  await page.waitForTimeout(4600);
  await page.waitForTimeout(700);
  console.log('YT_TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src})));
  await page.click('#btn-review');
  await page.waitForTimeout(1800);
  const rev = await page.evaluate(() => ({
    takePaused: document.getElementById('take-video').paused,
    takeCt: document.getElementById('take-video').currentTime,
    takeMuted: document.getElementById('take-video').muted,
    reviewTime: document.getElementById('review-time').textContent,
    btnReview: document.getElementById('btn-review').textContent.trim(),
    status: document.getElementById('status-text').textContent,
    hint: document.getElementById('review-hint').textContent,
  }));
  console.log('YT_REVIEW', JSON.stringify(rev));
  await page.waitForTimeout(2500);
  const rev2 = await page.evaluate(() => ({
    takePaused: document.getElementById('take-video').paused,
    takeCt: document.getElementById('take-video').currentTime,
    reviewTime: document.getElementById('review-time').textContent,
    btnReview: document.getElementById('btn-review').textContent.trim(),
    status: document.getElementById('status-text').textContent,
  }));
  console.log('YT_REVIEW_MID', JSON.stringify(rev2));
  await page.screenshot({path: '.qa/desk-13-youtube-review.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
