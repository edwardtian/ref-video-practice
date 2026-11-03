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
  await page.waitForTimeout(1200);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);

  const st = () => page.evaluate(() => ({
    ref: document.getElementById('crop-left-label').textContent + ',' + document.getElementById('crop-top-label').textContent + ',' +
         document.getElementById('crop-width-label').textContent + ',' + document.getElementById('crop-height-label').textContent,
    take: document.getElementById('tcrop-left-label').textContent + ',' + document.getElementById('tcrop-top-label').textContent + ',' +
          document.getElementById('tcrop-width-label').textContent + ',' + document.getElementById('tcrop-height-label').textContent,
    refBtn: document.getElementById('btn-crop-draw').textContent,
    takeBtn: document.getElementById('btn-tcrop-draw').textContent,
    refBoxHidden: document.getElementById('ref-crop-box').classList.contains('is-hidden'),
    takeBtnDisabled: document.getElementById('btn-tcrop-draw').disabled,
  }));

  // ---- stray click should not leave a sliver
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(250);
  const ov = await (await page.$('#ref-crop-overlay')).boundingBox();
  await page.mouse.click(ov.x + ov.width * 0.5, ov.y + ov.height * 0.5);
  await page.waitForTimeout(250);
  console.log('stray click -> box hidden:', JSON.stringify(await st()));
  // Enter with nothing drawn must NOT crop
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  console.log('enter w/o rect:', JSON.stringify(await st()));

  // ---- sliders drive the draft while editing
  await page.evaluate(() => {
    const el = document.getElementById('crop-left'); el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  console.log('slider draft:', JSON.stringify(await st()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  console.log('esc after slider:', JSON.stringify(await st()));

  // ---- take stage crop
  await page.click('#btn-tcrop-draw');
  await page.waitForTimeout(300);
  const tov = await (await page.$('#take-crop-overlay')).boundingBox();
  await page.mouse.move(tov.x + tov.width * 0.25, tov.y + tov.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(tov.x + tov.width * 0.75, tov.y + tov.height * 0.9, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('take drawn:', JSON.stringify(await st()));
  await page.screenshot({ path: 'screenshots/crop-6-take.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('take applied:', JSON.stringify(await st()));

  // ---- crop persists across reload
  await page.reload();
  await page.waitForTimeout(1200);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1800);
  console.log('after reload:', JSON.stringify(await st()));

  // ---- recording still works with a crop applied
  await page.click('#btn-record');
  await page.waitForTimeout(3200);
  await page.waitForTimeout(3000);
  console.log('after record:', JSON.stringify(await page.evaluate(() => ({
    status: document.getElementById('status-text').textContent,
    takeSub: document.getElementById('take-stage-sub').textContent,
  }))));
  await page.screenshot({ path: 'screenshots/crop-7-recorded.png' });

  console.log('errors:', errs);
  await browser.close();
})();
