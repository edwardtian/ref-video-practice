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
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);

  await page.click('#btn-crop-draw');
  await page.waitForTimeout(200);
  const mode = await page.evaluate(() => ({
    btn: document.getElementById('btn-crop-draw').textContent,
    active: document.getElementById('ref-crop-overlay').classList.contains('is-active'),
    hidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    boxHidden: document.getElementById('ref-crop-box').classList.contains('is-hidden'),
    label: document.getElementById('ref-crop-box-label').textContent,
  }));
  console.log('MODE_ON', JSON.stringify(mode));

  const ov = await page.$('#ref-crop-overlay');
  const rect = await ov.boundingBox();
  console.log('OVERLAY_RECT', JSON.stringify(rect));

  // drag from 20%..80% x, 10%..70% y
  const x1 = rect.x + rect.width*0.20, y1 = rect.y + rect.height*0.10;
  const x2 = rect.x + rect.width*0.80, y2 = rect.y + rect.height*0.70;
  await page.mouse.move(x1,y1);
  await page.mouse.down();
  await page.mouse.move((x1+x2)/2, (y1+y2)/2, {steps:4});
  await page.mouse.move(x2,y2,{steps:4});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const drawn = await page.evaluate(() => ({
    left: document.getElementById('crop-left-label').textContent,
    top: document.getElementById('crop-top-label').textContent,
    width: document.getElementById('crop-width-label').textContent,
    height: document.getElementById('crop-height-label').textContent,
    sliderLeft: document.getElementById('crop-left').value,
    sliderWidth: document.getElementById('crop-width').value,
    boxLabel: document.getElementById('ref-crop-box-label').textContent,
    aspect: document.getElementById('ref-cell').style.aspectRatio,
    heightOut: document.getElementById('ref-out-height').textContent,
    cookieHas: document.cookie.includes('mirrorPracticePrefs'),
  }));
  console.log('DRAWN', JSON.stringify(drawn));
  await page.screenshot({path: '.qa/t4-crop-drawn.png'});

  // resize via SE handle: drag it outward
  const boxRect = await (await page.$('#ref-crop-box')).boundingBox();
  const se = await page.$('#ref-crop-box .crop-handle.se');
  const seRect = await se.boundingBox();
  await page.mouse.move(seRect.x+seRect.width/2, seRect.y+seRect.height/2);
  await page.mouse.down();
  await page.mouse.move(seRect.x+seRect.width/2+60, seRect.y+seRect.height/2+30, {steps:5});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const resized = await page.evaluate(() => ({
    width: document.getElementById('crop-width-label').textContent,
    height: document.getElementById('crop-height-label').textContent,
    left: document.getElementById('crop-left-label').textContent,
    top: document.getElementById('crop-top-label').textContent,
  }));
  console.log('RESIZED', JSON.stringify(resized));

  // move the box
  const boxRect2 = await (await page.$('#ref-crop-box')).boundingBox();
  await page.mouse.move(boxRect2.x+boxRect2.width/2, boxRect2.y+boxRect2.height/2);
  await page.mouse.down();
  await page.mouse.move(boxRect2.x+boxRect2.width/2+40, boxRect2.y+boxRect2.height/2+20, {steps:5});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const moved = await page.evaluate(() => ({
    left: document.getElementById('crop-left-label').textContent,
    top: document.getElementById('crop-top-label').textContent,
    width: document.getElementById('crop-width-label').textContent,
    height: document.getElementById('crop-height-label').textContent,
  }));
  console.log('MOVED', JSON.stringify(moved));

  // turning draw mode off should keep the crop overlay visible (non-default crop)
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => ({
    active: document.getElementById('ref-crop-overlay').classList.contains('is-active'),
    hidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
    btn: document.getElementById('btn-crop-draw').textContent,
  }));
  console.log('MODE_OFF', JSON.stringify(off));
  await page.screenshot({path: '.qa/t4-crop-off.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
