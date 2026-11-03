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
  // crop draw
  await page.click('#btn-crop-draw'); await page.waitForTimeout(200);
  const rect = await (await page.$('#ref-crop-overlay')).boundingBox();
  await page.mouse.move(rect.x + rect.width*0.2, rect.y + rect.height*0.15);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width*0.8, rect.y + rect.height*0.85, {steps: 8});
  await page.mouse.up(); await page.waitForTimeout(300);
  await page.click('#btn-crop-draw'); await page.waitForTimeout(300);
  console.log('crop:', JSON.stringify(await page.evaluate(() => ({
    l: document.getElementById('crop-left-label').textContent,
    t: document.getElementById('crop-top-label').textContent,
    w: document.getElementById('crop-width-label').textContent,
    h: document.getElementById('crop-height-label').textContent,
    outH: document.getElementById('ref-out-height').textContent,
  }))));
  // Escape cancels draw mode
  await page.click('#btn-crop-draw'); await page.waitForTimeout(200);
  const onBefore = await page.evaluate(() => document.getElementById('btn-crop-draw').textContent);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const onAfter = await page.evaluate(() => document.getElementById('btn-crop-draw').textContent);
  console.log('escape draw mode:', onBefore, '->', onAfter);
  // typing in URL field must not trigger shortcuts
  await page.click('#tab-url');
  await page.fill('#url-input', 'rrr eee');
  await page.waitForTimeout(200);
  console.log('url value kept:', await page.inputValue('#url-input'));
  await page.screenshot({ path: 'screenshots/ui-after-crop.png' });
  console.log('errors:', errs);
  await browser.close();
})();
