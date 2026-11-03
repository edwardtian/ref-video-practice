const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(700);
  const fi = await page.$('#file-input');
  await fi.setInputFiles('.qa/ref-audio.mp4');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const set=(id,v)=>{const el=document.getElementById(id); el.value=String(v); el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('crop-left',20);
    const afterLeft = {leftLabel: document.getElementById('crop-left-label').textContent, widthLabel: document.getElementById('crop-width-label').textContent, style: (()=>{const v=document.querySelector('#ref-layer video'); return {w:v.style.width,l:v.style.left};})()};
    set('crop-width',60);
    const afterWidth = {leftLabel: document.getElementById('crop-left-label').textContent, widthLabel: document.getElementById('crop-width-label').textContent, style: (()=>{const v=document.querySelector('#ref-layer video'); return {w:v.style.width,l:v.style.left};})()};
    set('crop-top',10);
    set('crop-height',70);
    const afterAll = {leftLabel: document.getElementById('crop-left-label').textContent, topLabel: document.getElementById('crop-top-label').textContent, widthLabel: document.getElementById('crop-width-label').textContent, heightLabel: document.getElementById('crop-height-label').textContent, style: (()=>{const v=document.querySelector('#ref-layer video'); return {w:v.style.width,h:v.style.height,l:v.style.left,t:v.style.top};})()};
    return {afterLeft, afterWidth, afterAll};
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
