const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+e.message));
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(900);
  await (await page.$('#file-input')).setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('trim-start',0); set('trim-end',3);
  });
  await page.waitForTimeout(400);
  console.log('MUTE_INIT', await page.evaluate(()=>({muted: document.querySelector('#ref-layer video').muted, title: document.getElementById('btn-ref-mute').title})));
  await page.click('#btn-ref-mute');
  await page.waitForTimeout(200);
  console.log('MUTE_ON', await page.evaluate(()=>({muted: document.querySelector('#ref-layer video').muted, title: document.getElementById('btn-ref-mute').title})));
  await page.click('#btn-ref-mute');
  await page.waitForTimeout(200);
  console.log('MUTE_OFF', await page.evaluate(()=>({muted: document.querySelector('#ref-layer video').muted, title: document.getElementById('btn-ref-mute').title})));

  await page.click('#btn-ref-loop');
  await page.waitForTimeout(200);
  console.log('LOOP_ON', await page.evaluate(()=>({primary: document.getElementById('btn-ref-loop').classList.contains('primary'), toast: document.getElementById('toast').textContent})));
  // preview with loop should keep playing past trim end
  await page.click('#btn-ref-play');
  await page.waitForTimeout(3600);
  const lp = await page.evaluate(()=>({ct: Math.round(document.querySelector('#ref-layer video').currentTime*100)/100, paused: document.querySelector('#ref-layer video').paused, label: document.getElementById('btn-ref-play').textContent.trim()}));
  console.log('LOOP_PLAY', JSON.stringify(lp));
  await page.click('#btn-ref-play');
  await page.waitForTimeout(300);
  console.log('LOOP_STOP', await page.evaluate(()=>({paused: document.querySelector('#ref-layer video').paused, label: document.getElementById('btn-ref-play').textContent.trim()})));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
