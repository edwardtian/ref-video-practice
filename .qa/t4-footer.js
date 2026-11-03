const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5); set('delay',0.5);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  const cols = await page.evaluate(() => {
    const f = document.getElementById('footer');
    return {
      cols: Array.from(f.querySelectorAll('.footer-col')).map(c => ({
        title: c.querySelector('h3').textContent,
        rect: (()=>{const r=c.getBoundingClientRect(); return {w:Math.round(r.width),x:Math.round(r.x)}})(),
      })),
      footerRect: (()=>{const r=f.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height)}})(),
    };
  });
  console.log('FOOTER', JSON.stringify(cols,null,1));
  await page.screenshot({path: '.qa/t4-footer.png'});
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
