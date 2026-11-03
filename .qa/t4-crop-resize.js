const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);

  // draw 20..80 x, 10..70 y then turn draw mode OFF
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(150);
  const rect = await (await page.$('#ref-crop-overlay')).boundingBox();
  const x1 = rect.x + rect.width*0.20, y1 = rect.y + rect.height*0.10;
  const x2 = rect.x + rect.width*0.80, y2 = rect.y + rect.height*0.70;
  await page.mouse.move(x1,y1); await page.mouse.down();
  await page.mouse.move(x2,y2,{steps:8}); await page.mouse.up();
  await page.waitForTimeout(300);
  await page.click('#btn-crop-draw');
  await page.waitForTimeout(200);
  const base = await page.evaluate(() => ({
    left: document.getElementById('crop-left-label').textContent,
    top: document.getElementById('crop-top-label').textContent,
    width: document.getElementById('crop-width-label').textContent,
    height: document.getElementById('crop-height-label').textContent,
    active: document.getElementById('ref-crop-overlay').classList.contains('is-active'),
    hidden: document.getElementById('ref-crop-overlay').classList.contains('is-hidden'),
  }));
  console.log('BASE', JSON.stringify(base));
  await page.screenshot({path: '.qa/t4-crop-selected.png'});

  // resize with SE handle outward
  const seRect = await (await page.$('#ref-crop-box .crop-handle.se')).boundingBox();
  await page.mouse.move(seRect.x+seRect.width/2, seRect.y+seRect.height/2);
  await page.mouse.down();
  await page.mouse.move(seRect.x+seRect.width/2+40, seRect.y+seRect.height/2+20, {steps:6});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const resized = await page.evaluate(() => ({
    width: document.getElementById('crop-width-label').textContent,
    height: document.getElementById('crop-height-label').textContent,
    left: document.getElementById('crop-left-label').textContent,
    top: document.getElementById('crop-top-label').textContent,
    aspect: document.getElementById('ref-cell').style.aspectRatio,
    outH: document.getElementById('ref-out-height').textContent,
  }));
  console.log('RESIZED', JSON.stringify(resized));

  // move box interior
  const boxRect = await (await page.$('#ref-crop-box')).boundingBox();
  await page.mouse.move(boxRect.x+boxRect.width*0.5, boxRect.y+boxRect.height*0.5);
  await page.mouse.down();
  await page.mouse.move(boxRect.x+boxRect.width*0.5+30, boxRect.y+boxRect.height*0.5+15, {steps:6});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const moved = await page.evaluate(() => ({
    left: document.getElementById('crop-left-label').textContent,
    top: document.getElementById('crop-top-label').textContent,
    width: document.getElementById('crop-width-label').textContent,
    height: document.getElementById('crop-height-label').textContent,
    box: (()=>{const b=document.getElementById('ref-crop-box'); return {left:b.style.left,top:b.style.top,width:b.style.width,height:b.style.height};})(),
    shadeTopH: document.getElementById('ref-shade-top').style.height,
    shadeLeftW: document.getElementById('ref-shade-left').style.width,
  }));
  console.log('MOVED', JSON.stringify(moved));
  await page.screenshot({path: '.qa/t4-crop-moved.png'});
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
