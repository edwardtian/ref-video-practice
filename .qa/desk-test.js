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
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });

  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(1000);
  await page.screenshot({path: '.qa/desk-0-empty.png'});

  const layout = await page.evaluate(() => {
    const refCell = document.getElementById('ref-cell').getBoundingClientRect();
    const refPanel = document.getElementById('ref-panel').getBoundingClientRect();
    const takeCell = document.getElementById('take-cell').getBoundingClientRect();
    const takePanel = document.getElementById('take-panel').getBoundingClientRect();
    return {
      refCell: {x: Math.round(refCell.x), y: Math.round(refCell.y), w: Math.round(refCell.width), h: Math.round(refCell.height)},
      refPanel: {x: Math.round(refPanel.x), y: Math.round(refPanel.y), w: Math.round(refPanel.width)},
      takeCell: {x: Math.round(takeCell.x), y: Math.round(takeCell.y), w: Math.round(takeCell.width), h: Math.round(takeCell.height)},
      takePanel: {x: Math.round(takePanel.x), y: Math.round(takePanel.y)},
      camLive: !!document.getElementById('cam-video').srcObject,
    };
  });
  console.log('LAYOUT', JSON.stringify(layout));

  // load reference with audio
  const fi = await page.$('#file-input');
  await fi.setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(2200);
  const refInfo = await page.evaluate(() => ({
    trimMax: document.getElementById('trim-start').max,
    trimLen: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    downloadRefDisabled: document.getElementById('btn-download-ref').disabled,
    recordDisabled: document.getElementById('btn-record').disabled,
    badge: document.getElementById('ref-badge-label').textContent,
    aspect: document.getElementById('ref-cell').style.aspectRatio,
  }));
  console.log('REF', JSON.stringify(refInfo));
  await page.screenshot({path: '.qa/desk-1-ready.png'});

  // trim start to 2.0, end to 7.0
  await page.evaluate(() => {
    const s = document.getElementById('trim-start'); s.value='2'; s.dispatchEvent(new Event('input',{bubbles:true}));
    const e = document.getElementById('trim-end'); e.value='7'; e.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(400);
  const trimmed = await page.evaluate(() => ({
    startLabel: document.getElementById('trim-start-label').textContent,
    endLabel: document.getElementById('trim-end-label').textContent,
    len: document.getElementById('trim-length').textContent,
    recLimit: document.getElementById('rec-limit').textContent,
    badgeTime: document.getElementById('ref-badge-time').textContent,
  }));
  console.log('TRIM', JSON.stringify(trimmed));
  await page.screenshot({path: '.qa/desk-2-trimmed.png'});

  // record 5s (auto-stop at trimmed 5s)
  await page.click('#btn-record');
  await page.waitForTimeout(1200);
  const recState = await page.evaluate(() => ({
    timer: document.getElementById('rec-timer').textContent,
    cap: document.getElementById('rec-cap').textContent,
    badge: document.getElementById('take-badge-label').textContent,
    overlayOn: document.getElementById('rec-overlay').classList.contains('is-on'),
  }));
  console.log('REC', JSON.stringify(recState));
  await page.screenshot({path: '.qa/desk-3-recording.png'});
  await page.waitForTimeout(4300);
  await page.waitForTimeout(600);
  const take = await page.evaluate(() => ({
    dur: document.getElementById('take-badge-time').textContent,
    takeSrc: !!document.getElementById('take-video').src,
    downloadTakeDisabled: document.getElementById('btn-download-take').disabled,
    reviewDisabled: document.getElementById('btn-review').disabled,
  }));
  console.log('TAKE', JSON.stringify(take));
  await page.screenshot({path: '.qa/desk-4-take.png'});

  // crop reference 20% left, 10% top, 60% width, 70% height; width 480
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('crop-left',20); set('crop-top',10); set('crop-width',60); set('crop-height',70);
    set('ref-out-width',480);
  });
  await page.waitForTimeout(400);
  const cropRef = await page.evaluate(() => ({
    aspect: document.getElementById('ref-cell').style.aspectRatio,
    heightLabel: document.getElementById('ref-out-height').textContent,
    widthLabel: document.getElementById('ref-width-label').textContent,
    cropLeftLabel: document.getElementById('crop-left-label').textContent,
    videoStyle: (()=>{const v=document.querySelector('#ref-layer video'); return {w:v.style.width,h:v.style.height,l:v.style.left,t:v.style.top,of:v.style.objectFit};})(),
  }));
  console.log('CROP_REF', JSON.stringify(cropRef));
  await page.screenshot({path: '.qa/desk-5-cropped.png'});

  // take crop + resize
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('tcrop-left',0); set('tcrop-top',10); set('tcrop-width',100); set('tcrop-height',80);
    set('take-out-width',540);
  });
  await page.waitForTimeout(400);
  const cropTake = await page.evaluate(() => ({
    aspect: document.getElementById('take-cell').style.aspectRatio,
    heightLabel: document.getElementById('take-out-height').textContent,
  }));
  console.log('CROP_TAKE', JSON.stringify(cropTake));

  // border
  await page.evaluate(() => {
    const s=document.getElementById('border-size'); s.value='14'; s.dispatchEvent(new Event('input',{bubbles:true}));
    const c=document.getElementById('border-color'); c.value='#ffcc00'; c.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(300);
  const border = await page.evaluate(() => {
    const d=document.getElementById('divider');
    return {height: d.style.height, color: d.style.backgroundColor, display: d.style.display, label: document.getElementById('border-size-label').textContent};
  });
  console.log('BORDER', JSON.stringify(border));
  await page.screenshot({path: '.qa/desk-6-border.png'});

  // review both
  await page.click('#btn-review');
  await page.waitForTimeout(1800);
  const review = await page.evaluate(() => ({
    takePaused: document.getElementById('take-video').paused,
    refPaused: document.querySelector('#ref-media video')?.paused,
    takeMuted: document.getElementById('take-video').muted,
    refMuted: document.querySelector('#ref-media video')?.muted,
    progress: document.getElementById('review-time').textContent,
    btnLabel: document.getElementById('btn-review').textContent.trim(),
    refLabel: document.getElementById('btn-ref-play').textContent.trim(),
    hint: document.getElementById('review-hint').textContent,
  }));
  console.log('REVIEW', JSON.stringify(review));
  await page.screenshot({path: '.qa/desk-7-review.png'});

  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
