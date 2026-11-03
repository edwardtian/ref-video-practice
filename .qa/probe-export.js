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
    // Build two native video elements: one from ref.mp4 fetch, one recorded from camera
    const refBlob = await fetch('/.qa/ref.mp4').then(r=>r.blob());
    const refUrl = URL.createObjectURL(refBlob);
    const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    const chunks=[]; const rec = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp9,opus'});
    rec.ondataavailable=e=>chunks.push(e.data);
    const stopped=new Promise(r=>rec.onstop=r);
    rec.start(250); await new Promise(r=>setTimeout(r,3000)); rec.stop(); await stopped;
    const takeBlob = new Blob(chunks,{type:'video/webm;codecs=vp9,opus'});
    const takeUrl = URL.createObjectURL(takeBlob);

    const mkVideo = async (url) => {
      const v = document.createElement('video');
      v.src = url; v.muted = true; v.playsInline = true; v.preload='auto';
      await new Promise((res,rej)=>{ v.onloadedmetadata=res; v.onerror=()=>rej(v.error && v.error.message); setTimeout(()=>res(),4000); });
      return v;
    };
    const ref = await mkVideo(refUrl);
    const take = await mkVideo(takeUrl);

    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360 + 6 + 360;
    const ctx2d = canvas.getContext('2d');
    const streamOut = canvas.captureStream(30);
    const AC = new AudioContext();
    const dest = AC.createMediaStreamDestination();
    const refSrc = AC.createMediaElementSource(ref);
    const takeSrc = AC.createMediaElementSource(take);
    refSrc.connect(dest); takeSrc.connect(dest);
    const combined = new MediaStream([...streamOut.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const supported = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4'].filter(m=>MediaRecorder.isTypeSupported(m));
    const outRec = new MediaRecorder(combined, {mimeType: supported[0]});
    const outChunks=[]; outRec.ondataavailable=e=>outChunks.push(e.data);
    const outStopped=new Promise(r=>outRec.onstop=r);
    outRec.start(250);
    let frames=0;
    const t0=performance.now();
    const draw=()=>{ ctx2d.fillStyle='#222'; ctx2d.fillRect(0,0,canvas.width,canvas.height);
      ctx2d.drawImage(ref,0,0,640,360); ctx2d.drawImage(take,0,360+6,640,360); frames++; };
    const iv = setInterval(draw, 33);
    await ref.play().catch(()=>{}); await take.play().catch(()=>{});
    await AC.resume().catch(()=>{});
    await new Promise(r=>setTimeout(r,3000));
    clearInterval(iv);
    ref.pause(); take.pause();
    outRec.stop(); await outStopped;
    const blob = new Blob(outChunks,{type:outRec.mimeType});
    const buf = await blob.arrayBuffer();
    const head = Array.from(new Uint8Array(buf.slice(0,8))).map(b=>b.toString(16).padStart(2,'0')).join(' ');
    // verify decodability
    const v2 = document.createElement('video'); const u2=URL.createObjectURL(blob); v2.src=u2; v2.muted=true;
    const meta = await new Promise(res=>{v2.onloadedmetadata=()=>res({dur:v2.duration}); v2.onerror=()=>res({err:String(v2.error&&v2.error.message)}); setTimeout(()=>res({timeout:1}),4000);});
    const ac2 = new AudioContext(); let dec=null, err=null;
    try { dec = await ac2.decodeAudioData(buf.slice(0)); } catch(e){ err=String(e&&e.message||e); }
    const info = {supported, frames, wall:(performance.now()-t0)/1000, blobSize: blob.size, head, meta, audioDecoded: dec ? {duration:dec.duration, channels:dec.numberOfChannels} : null, audioErr: err, mime: outRec.mimeType};
    await AC.close(); await ac2.close();
    return info;
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
