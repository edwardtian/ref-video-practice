const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(700);

  // YouTube
  await page.click('#tab-url');
  await page.fill('#url-input', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await page.click('#btn-load-url');
  await page.waitForTimeout(9000);
  const yt = await page.evaluate(() => ({
    ready: document.getElementById('ref-badge-label').textContent,
    time: document.getElementById('ref-badge-time').textContent,
    trimMax: document.getElementById('trim-start').max,
    trimLen: document.getElementById('trim-length').textContent,
    cropDisabled: document.getElementById('crop-left').disabled,
    cropHintHidden: document.getElementById('crop-hint').classList.contains('is-hidden'),
    downloadDisabled: document.getElementById('btn-download-ref').disabled,
    downloadHint: document.getElementById('ref-download-hint').textContent,
    iframePresent: !!document.querySelector('#ref-layer iframe'),
    emptyHidden: document.getElementById('ref-empty').classList.contains('is-hidden'),
  }));
  console.log('YOUTUBE', JSON.stringify(yt));
  await page.screenshot({path: '.qa/desk-10-youtube.png'});

  // Vimeo
  await page.click('#tab-url');
  await page.fill('#url-input', 'https://vimeo.com/76979871');
  await page.click('#btn-load-url');
  await page.waitForTimeout(9000);
  const vm = await page.evaluate(() => ({
    badge: document.getElementById('ref-badge-label').textContent,
    time: document.getElementById('ref-badge-time').textContent,
    trimMax: document.getElementById('trim-start').max,
    trimLen: document.getElementById('trim-length').textContent,
    iframePresent: !!document.querySelector('#ref-layer iframe'),
    emptyHidden: document.getElementById('ref-empty').classList.contains('is-hidden'),
    downloadHint: document.getElementById('ref-download-hint').textContent,
  }));
  console.log('VIMEO', JSON.stringify(vm));
  await page.screenshot({path: '.qa/desk-11-vimeo.png'});

  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
