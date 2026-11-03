const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000}, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.evaluate(() => { document.cookie = 'mirrorPracticePrefs=; max-age=0; path=/'; });
  await page.reload();
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',2); set('trim-end',5); set('delay',1.0);
    set('border-size',12);
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(3000+800+2500+900);
  console.log('TAKE', await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent})));

  // Hook into export by observing the export stage videos
  await page.click('#btn-export-merged');
  const samples=[];
  for (let i=0;i<24;i++){
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => {
      const vids = Array.from(document.querySelectorAll('#export-stage video'));
      return vids.map(v => ({ct: Math.round(v.currentTime*100)/100, paused: v.paused, muted: v.muted}));
    });
    const overlayOn = await page.evaluate(()=>document.getElementById('export-overlay').classList.contains('is-on'));
    const status = await page.evaluate(()=>document.getElementById('export-status').textContent);
    samples.push({i, overlayOn, status, vids: s});
  }
  console.log(JSON.stringify(samples.slice(0,12),null,1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
