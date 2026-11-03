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
    set('trim-start',5); set('trim-end',12);   // 7s window
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(7600);
  await page.waitForTimeout(700);
  await page.click('#btn-review');
  const samples = [];
  for (let i=0;i<28;i++) {
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({
      t: Math.round(document.getElementById('take-video').currentTime*100)/100,
      p: document.getElementById('take-video').paused,
      m: document.getElementById('take-video').muted,
      rt: document.getElementById('review-time').textContent,
      btn: document.getElementById('btn-review').textContent.trim(),
      toast: document.getElementById('toast').textContent,
      toastOn: document.getElementById('toast').classList.contains('is-on'),
    }));
    samples.push(s);
  }
  console.log(JSON.stringify(samples.slice(0,14)));
  console.log('---');
  console.log(JSON.stringify(samples.slice(14)));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
