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
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);

  const snap = () => page.evaluate(() => {
    const box = document.getElementById('ref-crop-box');
    const ov = document.getElementById('ref-crop-overlay');
    const cs = getComputedStyle(box);
    return {
      btn: document.getElementById('btn-crop-draw').textContent,
      cancelVisible: !document.getElementById('btn-crop-cancel').classList.contains('is-hidden'),
      overlayHidden: ov.classList.contains('is-hidden'),
      overlayActive: ov.classList.contains('is-active'),
      boxHidden: box.classList.contains('is-hidden'),
      box: { l: cs.left, t: cs.top, w: cs.width, h: cs.height },
      aspect: document.getElementById('ref-cell').style.aspectRatio,
      crop: document.getElementById('crop-left-label').textContent + ',' +
            document.getElementById('crop-top-label').textContent + ',' +
            document.getElementById('crop-width-label').textContent + ',' +
            document.getElementById('crop-height-label').textContent,
      hint: !!document.querySelector('#ref-crop-overlay .crop-edit-hint'),
    };
  });

  console.log('1. initial          ', JSON.stringify(await snap()));

  // ---- requirement 1: no crop yet -> open editor, no rectangle
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(300);
  console.log('2. editor opened    ', JSON.stringify(await snap()));
  await page.screenshot({ path: 'screenshots/crop-1-editor-empty.png' });

  // draw a rectangle - should NOT crop the video yet
  const ov = await (await page.$('#ref-crop-overlay')).boundingBox();
  await page.mouse.move(ov.x + ov.width * 0.20, ov.y + ov.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(ov.x + ov.width * 0.80, ov.y + ov.height * 0.85, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('3. rect drawn       ', JSON.stringify(await snap()));
  await page.screenshot({ path: 'screenshots/crop-2-drawn.png' });

  // Enter applies
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('4. after Enter      ', JSON.stringify(await snap()));
  await page.screenshot({ path: 'screenshots/crop-3-applied.png' });

  // ---- requirement 2: existing crop -> editor shows full frame + rect
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(300);
  console.log('5. reopen (full)    ', JSON.stringify(await snap()));
  await page.screenshot({ path: 'screenshots/crop-4-reopen-full.png' });

  // resize via SE handle
  const box = await (await page.$('#ref-crop-box')).boundingBox();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 40, box.y + box.height - 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('6. resized          ', JSON.stringify(await snap()));

  // move by dragging inside
  const box2 = await (await page.$('#ref-crop-box')).boundingBox();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width / 2 - 60, box2.y + box2.height / 2 - 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('7. moved            ', JSON.stringify(await snap()));

  // Esc cancels -> previous crop preserved
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log('8. after Esc        ', JSON.stringify(await snap()));

  // apply via button this time
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(300);
  await page.click('#btn-crop-draw');   // now reads "Apply"
  await page.waitForTimeout(400);
  console.log('9. applied via btn  ', JSON.stringify(await snap()));

  // reset crop button
  await page.click('#btn-crop-reset');
  await page.waitForTimeout(400);
  console.log('10. crop reset      ', JSON.stringify(await snap()));
  await page.screenshot({ path: 'screenshots/crop-5-reset.png' });

  console.log('errors:', errs);
  await browser.close();
})();
