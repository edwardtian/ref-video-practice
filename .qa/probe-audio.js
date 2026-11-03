const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    const mimes = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4'];
    const results = [];
    for (const mime of mimes) {
      if (!MediaRecorder.isTypeSupported(mime)) { results.push({mime, skipped:true}); continue; }
      const chunks=[]; const rec = new MediaRecorder(stream, {mimeType: mime});
      rec.ondataavailable=e=>chunks.push(e.data);
      const stopped=new Promise(r=>rec.onstop=r);
      rec.start(250); await new Promise(r=>setTimeout(r,1500)); rec.stop(); await stopped;
      const blob = new Blob(chunks, {type: rec.mimeType});
      const buf = await blob.arrayBuffer();
      const ac = new AudioContext();
      let decodeErr = null, decoded = null;
      try { decoded = await ac.decodeAudioData(buf.slice(0)); } catch(e) { decodeErr = String(e && e.message || e); }
      results.push({mime: rec.mimeType, size: buf.byteLength, decoded: decoded ? {duration: decoded.duration, channels: decoded.numberOfChannels, sampleRate: decoded.sampleRate} : null, decodeErr});
      await ac.close();
    }
    return results;
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
