const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload(); await page.waitForTimeout(800);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',6); set('delay',1.2); set('border-size',20); set('border-color','#00ff88'); set('ref-out-width',900);
  });
  await page.waitForTimeout(600);
  const cookie = await page.evaluate(() => document.cookie.includes('mirrorPracticePrefs'));
  console.log('cookie written:', cookie);
  // reload to confirm restore
  await page.reload(); await page.waitForTimeout(1000);
  console.log('restored:', JSON.stringify(await page.evaluate(() => ({
    delay: document.getElementById('delay-label').textContent,
    border: document.getElementById('border-size-label').textContent,
    color: document.getElementById('border-color-label').textContent,
    out: document.getElementById('ref-width-label').textContent,
    peek: document.querySelector('.footer-peek').textContent.replace(/\s+/g,' ').trim(),
  }))));
  // reset
  await page.click('#btn-reset'); await page.waitForTimeout(600);
  console.log('after reset:', JSON.stringify(await page.evaluate(() => ({
    delay: document.getElementById('delay-label').textContent,
    border: document.getElementById('border-size-label').textContent,
    color: document.getElementById('border-color-label').textContent,
    out: document.getElementById('ref-width-label').textContent,
    step: [...document.querySelectorAll('.step')].find(b => b.classList.contains('is-current'))?.textContent.trim(),
    hint: document.getElementById('review-hint').textContent,
    peek: document.querySelector('.footer-peek').textContent.replace(/\s+/g,' ').trim(),
  }))));
  console.log('errors:', errs);
  await browser.close();
})();
