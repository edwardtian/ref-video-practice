const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1600,height:1000}, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',1); set('trim-end',4); set('delay',0.8);
  });
  await page.waitForTimeout(400);
  await page.click('#btn-record');
  await page.waitForTimeout(3600+800+2000);
  await page.waitForTimeout(900);
  const st = await page.evaluate(()=>({dur: document.getElementById('take-badge-time').textContent, src: !!document.getElementById('take-video').src, exportDisabled: document.getElementById('btn-export-merged').disabled}));
  console.log('BEFORE_EXPORT', JSON.stringify(st));
  await page.click('#btn-export-merged');
  await page.waitForTimeout(1200);
  const mid = await page.evaluate(()=>({on: document.getElementById('export-overlay').classList.contains('is-on'), status: document.getElementById('export-status').textContent, title: document.getElementById('export-title').textContent, toast: document.getElementById('toast').textContent}));
  console.log('MID', JSON.stringify(mid));
  await page.waitForTimeout(5000);
  const after = await page.evaluate(()=>({on: document.getElementById('export-overlay').classList.contains('is-on'), status: document.getElementById('export-status').textContent, toast: document.getElementById('toast').textContent, lastExport: !!window.__lastExport}));
  console.log('AFTER', JSON.stringify(after));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
