const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  const st0 = await page.evaluate(() => ({
    camLayer: document.getElementById('cam-layer').style.display,
    camLive: !!document.getElementById('cam-video').srcObject,
    empty: !document.getElementById('cam-empty').classList.contains('is-hidden'),
    badge: document.getElementById('take-badge-label').textContent,
  }));
  console.log('IDLE', JSON.stringify(st0));
  await page.screenshot({path: '.qa/cam-idle.png'});
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
