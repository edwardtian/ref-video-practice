const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900}, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(800);
  await page.click('#tab-url');
  await page.fill('#url-input','http://127.0.0.1:8130/.qa/ref-audio.mp4');
  await page.click('#btn-load-url');
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => ({
    badge: document.getElementById('ref-badge-label').textContent,
    time: document.getElementById('ref-badge-time').textContent,
    trimLen: document.getElementById('trim-length').textContent,
    downloadDisabled: document.getElementById('btn-download-ref').disabled,
    hint: document.getElementById('ref-download-hint').textContent,
    cropDisabled: document.getElementById('crop-left').disabled,
    aspect: document.getElementById('ref-cell').style.aspectRatio,
    blobCached: !!(window.__lastExport),
  }));
  console.log('URL_NATIVE', JSON.stringify(st));
  await page.screenshot({path: '.qa/url-native.png'});
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
