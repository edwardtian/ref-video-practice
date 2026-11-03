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
  await page.waitForTimeout(800);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5);
  });
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => {
    const v = document.querySelector('#ref-layer video');
    return {ct: v.currentTime, paused: v.paused};
  });
  console.log('BEFORE_PREVIEW', JSON.stringify(before));

  await page.click('#btn-ref-play');
  await page.waitForTimeout(500);
  const during = await page.evaluate(() => {
    const v = document.querySelector('#ref-layer video');
    return {ct: v.currentTime, paused: v.paused, label: document.getElementById('btn-ref-play').textContent.trim()};
  });
  console.log('DURING', JSON.stringify(during));
  await page.waitForTimeout(3200); // trimmed window is 3s
  const after = await page.evaluate(() => {
    const v = document.querySelector('#ref-layer video');
    return {ct: v.currentTime, paused: v.paused, label: document.getElementById('btn-ref-play').textContent.trim(), progress: document.getElementById('ref-progress-time').textContent};
  });
  console.log('AFTER_TRIM_END', JSON.stringify(after));

  // preview again should restart at trim start
  await page.click('#btn-ref-play');
  await page.waitForTimeout(500);
  const restart = await page.evaluate(() => {
    const v = document.querySelector('#ref-layer video');
    return {ct: v.currentTime, paused: v.paused};
  });
  console.log('RESTART', JSON.stringify(restart));

  // responsive narrow
  await page.setViewportSize({width: 820, height: 900});
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const r = document.getElementById('ref-cell').getBoundingClientRect();
    const p = document.getElementById('ref-panel').getBoundingClientRect();
    return {refW: Math.round(r.width), panelX: Math.round(p.x), refX: Math.round(r.x), stacked: p.y > r.y};
  });
  console.log('NARROW', JSON.stringify(narrow));
  await page.screenshot({path: '.qa/desk-9-narrow.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
