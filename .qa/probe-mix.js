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
    const refBlob = await fetch('/.qa/ref.mp4').then(r=>r.blob());
    const refUrl = URL.createObjectURL(refBlob);
    const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    const chunks=[]; const rec = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp9,opus'});
    rec.ondataavailable=e=>chunks.push(e.data);
    const stopped=new Promise(r=>rec.onstop=r);
    rec.start(250); await new Promise(r=>setTimeout(r,3000)); rec.stop(); await stopped;
    const takeBlob = new Blob(chunks,{type:'video/webm;codecs=vp9,opus'});
    const takeUrl = URL.createObjectURL(takeBlob);

    const mk = async (url) => { const v=document.createElement('video'); v.src=url; v.muted=false; v.playsInline=true; v.preload='auto';
      await new Promise((res,rej)=>{v.onloadedmetadata=res; v.onerror=()=>rej(String(v.error&&v.error.message)); setTimeout(()=>res(),4000)}); return v; };
    const ref = await mk(refUrl); const take = await mk(takeUrl);
    const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=360+8+360;
    const c=canvas.getContext('2d');
    const streamOut=canvas.captureStream(30);
    const AC=new AudioContext(); const dest=AC.createMediaStreamDestination();
    const rs=AC.createMediaElementSource(ref); const ts=AC.createMediaElementSource(take);
    const gr=AC.createGain(); gr.gain.value=1; const gt=AC.createGain(); gt.gain.value=1;
    rs.connect(gr); gr.connect(dest); ts.connect(gt); gt.connect(dest);
    const combined=new MediaStream([...streamOut.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const outRec=new MediaRecorder(combined,{mimeType:'video/webm;codecs=vp9,opus'});
    const oc=[]; outRec.ondataavailable=e=>oc.push(e.data);
    const os=new Promise(r=>outRec.onstop=r); outRec.start(250);
    const draw=()=>{c.fillStyle='#222';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(ref,0,0,640,360);c.drawImage(take,0,368,640,360);};
    const iv=setInterval(draw,33);
    await AC.resume(); await ref.play().catch(()=>{}); await take.play().catch(()=>{});
    await new Promise(r=>setTimeout(r,3000));
    clearInterval(iv); ref.pause(); take.pause(); outRec.stop(); await os;
    const blob=new Blob(oc,{type:outRec.mimeType}); const buf=await blob.arrayBuffer();
    const ac2=new AudioContext(); const decoded=await ac2.decodeAudioData(buf.slice(0));
    // RMS per channel
    const ch=[]; for(let i=0;i<decoded.numberOfChannels;i++){const d=decoded.getChannelData(i);let sum=0;for(let j=0;j<d.length;j++)sum+=d[j]*d[j];ch.push(Math.sqrt(sum/d.length));}
    const peak=[]; for(let i=0;i<decoded.numberOfChannels;i++){const d=decoded.getChannelData(i);let m=0;for(let j=0;j<d.length;j++)m=Math.max(m,Math.abs(d[j]));peak.push(m);}
    await AC.close(); await ac2.close();
    return {size: blob.size, audioDuration: decoded.duration, channels: decoded.numberOfChannels, rms: ch, peak};
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
