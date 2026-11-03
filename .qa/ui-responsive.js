const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  for (const [w,h,name] of [[1100,900,'tablet'],[430,900,'phone']]) {
    const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:w,height:h} });
    const page = await ctx.newPage();
    const errs=[]; page.on('pageerror', e=>errs.push(String(e)));
    await page.goto('http://127.0.0.1:8130/index.html');
    await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
    await page.reload(); await page.waitForTimeout(900);
    await page.screenshot({ path: `screenshots/ui-${name}-empty.png` });
    const overflow = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth, winW: window.innerWidth,
      wide: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0,6).map(el => el.id || el.className),
    }));
    console.log(name, JSON.stringify(overflow), 'errors:', errs);
    await ctx.close();
  }
  await browser.close();
})();
