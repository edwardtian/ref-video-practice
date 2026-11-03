const { chromium } = require('/home/tianye/.nvm/versions/node/v24.15.0/lib/node_modules/@playwright/cli/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
           '--use-file-for-fake-video-capture=/media/data/Workspace/ref-pratice/.qa/cam.y4m',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['camera','microphone'], viewport:{width:1280,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8130/index.html');
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const refBlob = await fetch('/.qa/ref-audio.mp4').then(r=>r.blob());
    const url = URL.createObjectURL(refBlob);
    const v = document.createElement('video'); v.src=url; v.playsInline=true; v.preload='auto';
    await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(String(v.error&&v.error.message));setTimeout(()=>res(),4000)});
    const AC = new AudioContext();
    const dest = AC.createMediaStreamDestination();
    const src = AC.createMediaElementSource(v);
    src.connect(dest); // NOT connected to speakers
    const results = {};
    async function trial(muted) {
      v.muted = muted;
      const rec = new MediaRecorder(dest.stream, {mimeType:'audio/webm;codecs=opus'});
      const chunks=[]; rec.ondataavailable=e=>chunks.push(e.data);
      const stopped=new Promise(r=>rec.onstop=r);
      rec.start(200);
      v.currentTime = 0;
      await v.play().catch(()=>{});
      await AC.resume().catch(()=>{});
      await new Promise(r=>setTimeout(r,1500));
      rec.stop(); await stopped; v.pause();
      const blob = new Blob(chunks,{type:rec.mimeType});
      const buf = await blob.arrayBuffer();
      const ac2 = new AudioContext();
      let dec=null, err=null;
      try { dec = await ac2.decodeAudioData(buf.slice(0)); } catch(e){ err=String(e&&e.message||e); }
      let rms=0, peak=0;
      if (dec) { const d=dec.getChannelData(0); let sum=0; for(let j=0;j<d.length;j++){sum+=d[j]*d[j]; peak=Math.max(peak,Math.abs(d[j]));} rms=Math.sqrt(sum/d.length); }
      await ac2.close();
      return {muted, size: blob.size, duration: dec&&dec.duration, rms, peak, err};
    }
    results.muted = await trial(true);
    results.unmuted = await trial(false);
    await AC.close();
    return results;
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
