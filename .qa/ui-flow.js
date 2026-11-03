const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);

  const step = () => page.evaluate(() => ({
    current: [...document.querySelectorAll('.step')].find(b => b.classList.contains('is-current'))?.textContent.trim(),
    done: [...document.querySelectorAll('.step.is-done')].map(b => b.textContent.trim()),
    hint: document.getElementById('review-hint').textContent,
    status: document.getElementById('status-text').textContent,
    refSub: document.getElementById('ref-stage-sub').textContent,
    takeSub: document.getElementById('take-stage-sub').textContent,
    meta: document.getElementById('strip-export-meta').textContent,
    recordTag: document.getElementById('record-state-tag').textContent,
    reviewDisabled: document.getElementById('btn-review').disabled,
    exportDisabled: document.getElementById('btn-export-merged').disabled,
    altDisabled: document.getElementById('btn-download-merged-alt').disabled,
    peek: document.querySelector('.footer-peek').textContent.replace(/\s+/g,' ').trim(),
  }));

  console.log('EMPTY     ', JSON.stringify(await step()));

  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',6); set('delay',0.8);
    set('border-size',14); set('border-color','#ff4d6d');
  });
  await page.waitForTimeout(400);
  console.log('REF LOADED', JSON.stringify(await step()));

  // collapse source to check the compact state
  await page.click('#btn-source-collapse');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/ui-after-ref.png' });
  const srcHidden = await page.evaluate(() => document.getElementById('source-body').classList.contains('is-hidden'));
  console.log('source collapsed:', srcHidden);

  await page.click('#btn-record');
  await page.waitForTimeout(650);
  console.log('COUNTDOWN ', JSON.stringify(await step()));
  await page.screenshot({ path: 'screenshots/ui-after-countdown.png' });
  await page.waitForTimeout(3000 + 800 + 2600);
  await page.waitForTimeout(900);
  console.log('TAKE      ', JSON.stringify(await step()));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/ui-after-take.png' });

  await page.click('#btn-review');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/ui-after-review.png' });
  await page.click('#btn-review');
  await page.waitForTimeout(500);

  // footer expanded
  await page.click('.footer-summary');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/ui-after-footer-open.png' });
  await page.click('.footer-summary');
  await page.waitForTimeout(200);

  // keyboard shortcut export
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press('e');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/ui-after-export.png' });
  await page.waitForTimeout(9000);
  console.log('AFTER EXPORT', JSON.stringify(await step()));
  await page.screenshot({ path: 'screenshots/ui-after-export-done.png' });

  console.log('errors:', errs);
  await browser.close();
})();
