(() => {
  'use strict';

  /* ═══════════════════ helpers ═══════════════════ */
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const fmtTrim = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const tenth = Math.floor((s * 10) % 10);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenth}`;
  };

  let toastTimer = 0;
  function toast(msg, ms = 2200) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
  }

  /* ═══════════════════ state ═══════════════════ */
  const state = {
    ref: null,
    refReady: false,
    refBlob: null,
    refTrim: { start: 0, end: 0 },
    refCrop: { x: 0, y: 0, w: 1, h: 1 },
    refOutW: 720,

    camStream: null,
    camDeviceId: null,
    mirrorPreview: false,
    camCrop: { x: 0, y: 0, w: 1, h: 1 },
    camOutW: 720,

    recording: false,
    takeBlob: null,
    takeUrl: null,
    takeDuration: 0,
    takeHasAudio: false,
    takeDecodable: true,
    takeContainer: null,

    playing: false,
    takePlaying: false,
    mode: 'idle',
    mutedRef: false,
    loopRef: false,
    refPreviewActive: false,

    borderSize: 8,
    borderColor: '#ffffff',

    refDelay: 0.5,
    countdownActive: false,
    countdownValue: 3,

    pendingTrim: null,
    resumeAt: 0,
    resumeFrom: 0,
  };

  const exportState = { active: false, cancel: false };
  /* ═══════════════════ preferences cookie ═══════════════════ */
  const PREFS_COOKIE = 'mirrorPracticePrefs';
  const PREFS_VERSION = 2;

  function readPrefs() {
    try {
      const all = document.cookie.split(';').map(c => c.trim());
      const hit = all.find(c => c.startsWith(PREFS_COOKIE + '='));
      if (!hit) return null;
      const raw = decodeURIComponent(hit.slice(PREFS_COOKIE.length + 1));
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch { return null; }
  }

  function writePrefs() {
    const payload = {
      v: PREFS_VERSION,
      refCrop: roundCrop(state.refCrop),
      camCrop: roundCrop(state.camCrop),
      refTrim: { start: round2(state.refTrim.start), end: round2(state.refTrim.end) },
      refOutW: Number(state.refOutW),
      camOutW: Number(state.camOutW),
      borderSize: Number(state.borderSize),
      borderColor: state.borderColor,
      refDelay: round2(state.refDelay),
      mutedRef: !!state.mutedRef,
      loopRef: !!state.loopRef,
      mirrorPreview: !!state.mirrorPreview,
    };
    const enc = encodeURIComponent(JSON.stringify(payload));
    document.cookie = `${PREFS_COOKIE}=${enc}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }

  const round2 = (v) => Math.round(v * 100) / 100;
  const roundCrop = (c) => ({
    x: round2(c.x), y: round2(c.y), w: round2(c.w), h: round2(c.h),
  });

  function clampCropObj(c) {
    let w = clamp(Number(c.w), 0.1, 1);
    let h = clamp(Number(c.h), 0.1, 1);
    let x = clamp(Number(c.x), 0, 1 - w);
    let y = clamp(Number(c.y), 0, 1 - h);
    return { x, y, w, h };
  }

  function applyPrefs(prefs) {
    if (!prefs) return false;
    let touched = false;

    if (prefs.refCrop) { state.refCrop = clampCropObj(prefs.refCrop); touched = true; }
    if (prefs.camCrop) { state.camCrop = clampCropObj(prefs.camCrop); touched = true; }
    if (Number.isFinite(Number(prefs.refOutW))) {
      state.refOutW = clamp(Math.round(Number(prefs.refOutW)), 240, 1920);
      refWidthEl.value = String(state.refOutW);
      touched = true;
    }
    if (Number.isFinite(Number(prefs.camOutW))) {
      state.camOutW = clamp(Math.round(Number(prefs.camOutW)), 240, 1920);
      takeWidthEl.value = String(state.camOutW);
      touched = true;
    }
    if (Number.isFinite(Number(prefs.borderSize))) {
      state.borderSize = clamp(Math.round(Number(prefs.borderSize)), 0, 40);
      borderSizeEl.value = String(state.borderSize);
      touched = true;
    }
    if (typeof prefs.borderColor === 'string' && /^#[0-9a-f]{6}$/i.test(prefs.borderColor)) {
      state.borderColor = prefs.borderColor.toLowerCase();
      borderColorEl.value = state.borderColor;
      touched = true;
    }
    if (Number.isFinite(Number(prefs.refDelay))) {
      state.refDelay = clamp(round2(Number(prefs.refDelay)), 0, 3);
      delayEl.value = String(state.refDelay);
      touched = true;
    }
    if (typeof prefs.mutedRef === 'boolean') { state.mutedRef = prefs.mutedRef; touched = true; }
    if (typeof prefs.loopRef === 'boolean') { state.loopRef = prefs.loopRef; touched = true; }
    if (typeof prefs.mirrorPreview === 'boolean') { state.mirrorPreview = prefs.mirrorPreview; touched = true; }

    // Trim is restored once a reference reports its duration (see finishReference).
    state.pendingTrim = prefs.refTrim && Number.isFinite(Number(prefs.refTrim.start)) && Number.isFinite(Number(prefs.refTrim.end))
      ? { start: Number(prefs.refTrim.start), end: Number(prefs.refTrim.end) }
      : null;

    writeCropInputs('crop', state.refCrop);
    writeCropInputs('tcrop', state.camCrop);
    return touched;
  }

  function restoreTrim(duration) {
    const pending = state.pendingTrim;
    state.pendingTrim = null;
    if (!pending || !(duration > 0)) return false;
    const start = clamp(pending.start, 0, Math.max(0, duration - 0.1));
    const end = clamp(pending.end, Math.min(start + 0.1, duration), duration);
    if (!(end - start > 0.05)) return false;
    state.refTrim = { start, end };
    return true;
  }

  function savePrefsDebounced() {
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(writePrefs, 260);
  }
  let prefsTimer = 0;


  /* ═══════════════════ DOM ═══════════════════ */
  const refCell = $('ref-cell');
  const refLayer = $('ref-layer');
  const refEmpty = $('ref-empty');
  const refBadgeLabel = $('ref-badge-label');
  const refBadgeTime = $('ref-badge-time');
  const refSourceLabel = $('ref-source-label');

  const trimStartEl = $('trim-start');
  const trimEndEl = $('trim-end');
  const trimStartLabel = $('trim-start-label');
  const trimEndLabel = $('trim-end-label');
  const trimLengthEl = $('trim-length');
  const btnTrimReset = $('btn-trim-reset');

  const refWidthEl = $('ref-out-width');
  const refWidthLabel = $('ref-width-label');
  const refOutHeightEl = $('ref-out-height');
  const btnRefPlay = $('btn-ref-play');
  const refProgress = $('ref-progress');
  const refProgressTime = $('ref-progress-time');
  const btnRefMute = $('btn-ref-mute');
  const btnRefLoop = $('btn-ref-loop');
  const btnDownloadRef = $('btn-download-ref');
  const refDownloadHint = $('ref-download-hint');
  const cropHint = $('crop-hint');
  const btnCropReset = $('btn-crop-reset');
  const divider = $('divider');

  const takeCell = $('take-cell');
  const camLayer = $('cam-layer');
  const takeLayer = $('take-layer');
  const camVideo = $('cam-video');
  const takeVideo = $('take-video');
  const camEmpty = $('cam-empty');
  const takeBadgeLabel = $('take-badge-label');
  const takeBadgeTime = $('take-badge-time');
  const takeSourceLabel = $('take-source-label');
  const recOverlay = $('rec-overlay');
  const recTimer = $('rec-timer');
  const recCap = $('rec-cap');
  const takePlayOverlay = $('take-play-overlay');
  const btnTakeCenter = $('btn-take-center');

  const btnCamEnable = $('btn-cam-enable');
  const btnEnableCam = $('btn-enable-cam');
  const camDeviceList = $('cam-device-list');
  const btnMirror = $('btn-mirror');
  const recLimitEl = $('rec-limit');
  const btnRecord = $('btn-record');
  const btnStop = $('btn-stop');
  const btnRetake = $('btn-retake');

  const takeWidthEl = $('take-out-width');
  const takeWidthLabel = $('take-width-label');
  const takeOutHeightEl = $('take-out-height');
  const btnTakePlay = $('btn-take-play');
  const takeProgress = $('take-progress');
  const takeProgressTime = $('take-progress-time');
  const btnDownloadTake = $('btn-download-take');

  const delayEl = $('delay');
  const delayLabel = $('delay-label');
  const delayHint = $('delay-hint');
  const btnDelayReset = $('btn-delay-reset');
  const refCropOverlay = $('ref-crop-overlay');
  const refCropBox = $('ref-crop-box');
  const refCropBoxLabel = $('ref-crop-box-label');
  const takeCropOverlay = $('take-crop-overlay');
  const takeCropBox = $('take-crop-box');
  const takeCropBoxLabel = $('take-crop-box-label');
  const btnCropDraw = $('btn-crop-draw');
  const btnTcropDraw = $('btn-tcrop-draw');
  const countdownOverlay = $('countdown-overlay');
  const countdownNumber = $('countdown-number');
  const countdownLabel = $('countdown-label');
  const borderSizeEl = $('border-size');
  const borderSizeLabel = $('border-size-label');
  const borderColorEl = $('border-color');
  const borderColorLabel = $('border-color-label');
  const dividerWrap = $('divider-wrap');
  const layoutSummary = $('layout-summary');
  const exportSummary = $('export-summary');
  const takeBadgeMini = $('take-badge-mini');
  const btnReview = $('btn-review');
  const reviewProgress = $('review-progress');
  const reviewTime = $('review-time');
  const reviewHint = $('review-hint');
  const btnExportMerged = $('btn-export-merged');

  const exportOverlay = $('export-overlay');
  const exportTitle = $('export-title');
  const exportFill = $('export-fill');
  const exportStatus = $('export-status');
  const btnExportCancel = $('btn-export-cancel');
  const exportStage = $('export-stage');

  const statusChip = $('status-chip');
  const statusText = $('status-text');
  const btnReset = $('btn-reset');

  const tabUpload = $('tab-upload');
  const tabUrl = $('tab-url');
  const paneUpload = $('pane-upload');
  const paneUrl = $('pane-url');
  const drop = $('drop');
  const fileInput = $('file-input');
  const urlInput = $('url-input');
  const btnLoadUrl = $('btn-load-url');
  const urlError = $('url-error');

  const discardModal = $('discard-modal');
  const btnDiscardCancel = $('btn-discard-cancel');
  const btnDiscardConfirm = $('btn-discard-confirm');

  /* ═══════════════════ provider bridges ═══════════════════ */
  const YT_ORIGIN = 'https://www.youtube.com';
  const VIMEO_ORIGIN = 'https://player.vimeo.com';

  const YT = {
    iframe: null, ready: false, duration: 0, current: 0, currentAt: 0,
    playing: false, pendingPlay: false, ticker: null, onReady: null,
  };
  const VIMEO = {
    iframe: null, ready: false, duration: 0, current: 0, currentAt: 0,
    playing: false, pendingPlay: false, poll: null, onReady: null,
  };

  function ytPost(obj) {
    if (!YT.iframe || !YT.iframe.contentWindow) return;
    YT.iframe.contentWindow.postMessage(JSON.stringify(obj), YT_ORIGIN);
  }
  function ytCmd(func, args = []) {
    ytPost({ event: 'command', func, args, id: 'mirror-yt', channel: 'mirror-yt' });
  }
  function ytListen() {
    ytPost({ event: 'listening', id: 'mirror-yt', channel: 'mirror-yt' });
  }
  function vimeoPost(obj) {
    if (!VIMEO.iframe || !VIMEO.iframe.contentWindow) return;
    VIMEO.iframe.contentWindow.postMessage(JSON.stringify(obj), '*');
  }
  function vimeoCmd(method, params = {}) {
    vimeoPost({ method, ...params });
  }

  window.addEventListener('message', (e) => {
    if (typeof e.data !== 'string' || e.data.charAt(0) !== '{') return;
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (e.origin === YT_ORIGIN) {
      if (msg.event === 'onReady') {
        YT.ready = true;
        ytListen();
        if (YT.onReady) YT.onReady();
      } else if (msg.event === 'infoDelivery' && msg.info) {
        const i = msg.info;
        if (typeof i.duration === 'number' && i.duration > 0) YT.duration = i.duration;
        if (typeof i.currentTime === 'number') { YT.current = i.currentTime; YT.currentAt = performance.now(); }
        if (typeof i.playerState === 'number') {
          const st = i.playerState;
          YT.playing = st === 1 || st === 2;
          if (st === 0 && state.mode === 'play') handleReviewEnded();
        }
      } else if (msg.event === 'initialDelivery' && msg.info) {
        const i = msg.info;
        if (typeof i.duration === 'number') YT.duration = i.duration;
        if (typeof i.currentTime === 'number') { YT.current = i.currentTime; YT.currentAt = performance.now(); }
      } else if (msg.event === 'onError') {
        toast('YouTube could not play this video (private, removed, or restricted).', 3600);
        clearReferenceMedia();
        resetRefState();
        refEmpty.classList.remove('is-hidden');
        setRefBadge('YouTube');
      }
    } else if (e.origin === VIMEO_ORIGIN) {
      if (msg.event === 'ready') {
        VIMEO.ready = true;
        if (VIMEO.onReady) VIMEO.onReady();
      } else if (msg.event === 'error') {
        const m = (msg.data && msg.data.message) || 'Vimeo playback error';
        if (!state.refReady) {
          toast('Vimeo could not play this video: ' + m, 3600);
          clearReferenceMedia();
          resetRefState();
          refEmpty.classList.remove('is-hidden');
          setRefBadge('Vimeo');
        }
      } else if (msg.event === 'ended') {
        VIMEO.playing = false;
        if (state.mode === 'play') handleReviewEnded();
      } else if (msg.method && 'value' in msg) {
        const v = msg.value;
        if (msg.method === 'getDuration' && typeof v === 'number') VIMEO.duration = v;
        if (msg.method === 'getCurrentTime' && typeof v === 'number') { VIMEO.current = v; VIMEO.currentAt = performance.now(); }
        if (msg.method === 'getPaused') VIMEO.playing = v === false;
      }
    }
  });

  /* ═══════════════════ native reference ═══════════════════ */
  let nativeVideo = null;

  function clearReferenceMedia() {
    if (nativeVideo) {
      nativeVideo.pause();
      nativeVideo.removeAttribute('src');
      nativeVideo.load();
      nativeVideo.remove();
      nativeVideo = null;
    }
    if (YT.iframe) { YT.iframe.remove(); YT.iframe = null; }
    if (VIMEO.iframe) { VIMEO.iframe.remove(); VIMEO.iframe = null; }
    YT.ready = false; YT.duration = 0; YT.current = 0; YT.currentAt = 0; YT.playing = false; YT.pendingPlay = false;
    VIMEO.ready = false; VIMEO.duration = 0; VIMEO.current = 0; VIMEO.currentAt = 0; VIMEO.playing = false; VIMEO.pendingPlay = false;
    if (YT.ticker) { clearInterval(YT.ticker); YT.ticker = null; }
    if (VIMEO.poll) { clearInterval(VIMEO.poll); VIMEO.poll = null; }
    refLayer.querySelectorAll('video,iframe').forEach(n => n.remove());
  }

  function resetRefState() {
    state.refReady = false;
    state.refBlob = null;
    state.refTrim = { start: 0, end: 0 };
    state.refCrop = { x: 0, y: 0, w: 1, h: 1 };
    refBadgeTime.textContent = '--';
    refSourceLabel.textContent = 'No clip loaded';
    clearTake();
    updateTrimUI();
    updateRefLayout();
    updateUI();
  }

  function clearTake() {
    state.takeBlob = null;
    state.takeDuration = 0;
    state.takeHasAudio = false;
    state.takeDecodable = true;
    state.takeContainer = null;
    state.resumeAt = 0;
    state.resumeFrom = 0;
    state.takePlaying = false;
    if (state.takeUrl) { URL.revokeObjectURL(state.takeUrl); state.takeUrl = null; }
    takeVideo.removeAttribute('src');
    takeVideo.load();
    takeProgress.value = '0';
    takeProgress.style.setProperty('--fill', '0%');
    takeProgressTime.textContent = '00:00';
  }

  function setRefBadge(label) {
    refBadgeLabel.textContent = label;
  }

  function finishReference(duration, label) {
    state.ref.duration = duration;
    state.refReady = true;
    state.refTrim = { start: 0, end: duration };
    const restored = restoreTrim(duration);
    refEmpty.classList.add('is-hidden');
    refBadgeTime.textContent = fmt(duration);
    refSourceLabel.textContent = label;
    updateTrimUI();
    updateRefLayout();
    updateUI();
    syncRefAudio();
    toast(restored
      ? `Reference ready — ${fmt(duration)}; restored trim ${fmtTrim(state.refTrim.start)} → ${fmtTrim(state.refTrim.end)}`
      : `Reference ready — ${fmt(duration)}`, 1800);
  }

  function loadNativeReference(url, label, blob) {
    resetRefState();
    state.refBlob = blob || null;
    const v = document.createElement('video');
    v.src = url;
    v.preload = 'metadata';
    v.playsInline = true;
    v.muted = state.mutedRef;
    v.loop = false;
    refLayer.appendChild(v);
    nativeVideo = v;

    const onMeta = () => {
      let d = v.duration;
      if (!Number.isFinite(d) || d === 0) {
        v.currentTime = 1e101;
        const fix = () => { d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0; v.currentTime = 0; };
        v.addEventListener('seeked', fix, { once: true });
        setTimeout(() => { if (!state.refReady) fix(); }, 900);
      }
      if (Number.isFinite(d) && d > 0) {
        finishReference(d, label);
      } else {
        toast('Could not read this video’s length. Try another file or link.', 3600);
      }
    };
    v.addEventListener('loadedmetadata', onMeta, { once: true });
    v.addEventListener('error', () => {
      clearReferenceMedia();
      state.ref = null;
      resetRefState();
      refEmpty.classList.remove('is-hidden');
      toast(blob ? 'That file could not be decoded. Try another video.' : 'That video URL could not be played (blocked, private, or unsupported).', 3600);
    }, { once: true });
    v.load();
    applyRefCrop();
  }

  function loadYouTube(id) {
    resetRefState();
    const origin = encodeURIComponent(location.origin || 'http://localhost');
    const src = `https://www.youtube.com/embed/${id}?enablejsapi=1&controls=0&rel=0&iv_load_policy=3&playsinline=1&origin=${origin}`;
    const f = document.createElement('iframe');
    f.src = src;
    f.title = 'YouTube reference';
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    refLayer.appendChild(f);
    YT.iframe = f;
    YT.ready = false;
    YT.pendingPlay = false;
    YT.duration = 0;

    let listenAttempts = 0;
    const listenTimer = setInterval(() => {
      if (!YT.iframe || YT.iframe !== f) { clearInterval(listenTimer); return; }
      if (YT.ready) { clearInterval(listenTimer); return; }
      ytListen();
      if (++listenAttempts > 12) clearInterval(listenTimer);
    }, 900);
    f.addEventListener('load', () => ytListen());

    YT.onReady = () => {
      if (state.mutedRef) ytCmd('mute'); else ytCmd('unMute');
      ytCmd('getDuration');
      clearInterval(YT.ticker);
      YT.ticker = setInterval(() => {
        if (YT.ready) ytCmd('getDuration');
        if (Number.isFinite(YT.duration) && YT.duration > 0) {
          clearInterval(YT.ticker); YT.ticker = null;
          finishReference(YT.duration, 'YouTube');
          ytCmd('seekTo', [0, false]);
        }
        if (YT.pendingPlay && Number.isFinite(YT.duration) && YT.duration > 0) {
          YT.pendingPlay = false;
          ytCmd('playVideo');
        }
      }, 700);
    };
    setRefBadge('YouTube');
    updateRefLayout();
    setTimeout(() => {
      if (!state.refReady && YT.iframe === f && !YT.ready) {
        toast('YouTube embed did not start. Check the link or try a different video.', 3600);
      }
    }, 9000);
  }

  function loadVimeo(id) {
    resetRefState();
    const src = `https://player.vimeo.com/video/${id}?api=1&dnt=1&controls=0&title=0&byline=0&portrait=0&playsinline=1&transparent=1&autoplay=0`;
    const f = document.createElement('iframe');
    f.src = src;
    f.title = 'Vimeo reference';
    f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    refLayer.appendChild(f);
    VIMEO.iframe = f;
    VIMEO.ready = false;
    VIMEO.pendingPlay = false;
    VIMEO.duration = 0;

    const poll = () => {
      if (!VIMEO.iframe) return;
      vimeoCmd('getDuration');
      vimeoCmd('getCurrentTime');
      vimeoCmd('getPaused');
      if (Number.isFinite(VIMEO.duration) && VIMEO.duration > 0) {
        if (!state.refReady) {
          finishReference(VIMEO.duration, 'Vimeo');
          vimeoCmd('setCurrentTime', { value: 0 });
        }
        if (VIMEO.pendingPlay) {
          VIMEO.pendingPlay = false;
          vimeoCmd('play');
        }
      }
    };
    clearInterval(VIMEO.poll);
    VIMEO.poll = setInterval(poll, 400);
    setTimeout(poll, 400);
    setTimeout(() => {
      if (!state.refReady && VIMEO.iframe === f) {
        toast('Vimeo embed did not start. Check the link or try a different video.', 3600);
      }
    }, 9000);
    setRefBadge('Vimeo');
    updateRefLayout();
  }

  function loadFileReference(file) {
    if (!file) return;
    const okType = file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|mkv|ogv|avi)$/i.test(file.name);
    if (!okType) { toast('Pick a video file (MP4, MOV, WebM…).', 2600); return; }
    if (state.ref && state.ref.objectUrl) URL.revokeObjectURL(state.ref.objectUrl);
    const url = URL.createObjectURL(file);
    state.ref = { kind: 'native', url, duration: 0, label: file.name, objectUrl: url };
    loadNativeReference(url, file.name || 'Video file', file);
    setRefBadge(file.name || 'Video file');
    updateRefLayout();
  }

  function parseUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    let url;
    try { url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`); } catch { return null; }
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id) return { kind: 'youtube', id };
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        if (id) return { kind: 'youtube', id };
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'v' || parts[0] === 'shorts' || parts[0] === 'live') {
        const id = parts[1];
        if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'youtube', id };
      }
      const id = url.searchParams.get('v');
      if (id) return { kind: 'youtube', id };
    }
    if (host === 'vimeo.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const numIdx = parts.findIndex(p => /^\d{3,}$/.test(p));
      if (numIdx >= 0) return { kind: 'vimeo', id: parts[numIdx] };
    }
    if (host === 'player.vimeo.com' && url.pathname.startsWith('/video/')) {
      const id = url.pathname.split('/').filter(Boolean)[1];
      if (id && /^\d+$/.test(id)) return { kind: 'vimeo', id };
    }
    if (host === 'dailymotion.com' || host === 'dai.ly') {
      return { kind: 'unsupported', reason: 'Dailymotion embedding is not supported here — use a direct video URL or upload the file.' };
    }
    return { kind: 'native', url: url.href };
  }

  function loadUrl(raw) {
    const parsed = parseUrl(raw);
    if (!parsed) {
      urlError.textContent = 'That doesn’t look like a valid link.';
      urlError.classList.add('is-visible');
      return;
    }
    urlError.classList.remove('is-visible');
    if (parsed.kind === 'unsupported') {
      urlError.textContent = parsed.reason;
      urlError.classList.add('is-visible');
      return;
    }
    if (state.ref && state.ref.objectUrl) URL.revokeObjectURL(state.ref.objectUrl);

    if (parsed.kind === 'native') {
      state.ref = { kind: 'native', url: parsed.url, duration: 0, label: parsed.url.split('/').pop() || 'Video URL' };
      setRefBadge('Video URL');
      loadNativeReference(parsed.url, 'Video URL', null);
      updateRefLayout();
      fetch(parsed.url).then((resp) => {
        if (!resp.ok) throw new Error('bad response');
        return resp.blob();
      }).then((b) => {
        state.refBlob = b;
        updateUI();
      }).catch(() => {
        state.refBlob = null;
        updateUI();
      });
      return;
    }

    state.ref = { kind: parsed.kind, url: raw.trim(), duration: 0, label: parsed.kind === 'youtube' ? 'YouTube' : 'Vimeo' };
    setRefBadge(parsed.kind === 'youtube' ? 'YouTube' : 'Vimeo');
    if (parsed.kind === 'youtube') loadYouTube(parsed.id);
    else loadVimeo(parsed.id);
    updateRefLayout();
  }

  /* ═══════════════════ trim ═══════════════════ */
  function trimDuration() {
    if (!state.refReady || !state.ref) return 0;
    return Math.max(0, state.refTrim.end - state.refTrim.start);
  }

  function updateTrimUI() {
    const dur = state.refReady && state.ref ? state.ref.duration : 0;
    const enabled = dur > 0;
    if (enabled) {
      trimStartEl.max = String(dur);
      trimEndEl.max = String(dur);
      const start = clamp(state.refTrim.start, 0, Math.max(0, dur - 0.1));
      const end = clamp(state.refTrim.end, Math.min(start + 0.1, dur), dur);
      state.refTrim.start = start;
      state.refTrim.end = end;
      trimStartEl.value = String(start);
      trimEndEl.value = String(end);
    } else {
      trimStartEl.max = '0';
      trimEndEl.max = '0';
      trimStartEl.value = '0';
      trimEndEl.value = '0';
    }
    trimStartLabel.textContent = fmtTrim(state.refTrim.start);
    trimEndLabel.textContent = fmtTrim(state.refTrim.end);
    trimLengthEl.textContent = enabled ? fmtTrim(trimDuration()) : '--';
    recLimitEl.textContent = enabled && trimDuration() > 0 ? fmtTrim(recordWindow()) : '--';
    refreshButtons();
    updateUI();
  }

  /* ═══════════════════ crop + resize ═══════════════════ */
  function srcDims(videoEl, fallbackW = 640, fallbackH = 360) {
    const w = videoEl && videoEl.videoWidth > 0 ? videoEl.videoWidth : fallbackW;
    const h = videoEl && videoEl.videoHeight > 0 ? videoEl.videoHeight : fallbackH;
    return { w, h };
  }

  function outDims(srcW, srcH, crop, outW) {
    const cropAspect = (crop.w * srcW) / (crop.h * srcH);
    let h = Math.round(outW / cropAspect);
    h = clamp(h, 30, 2160);
    return { w: Math.round(outW), h };
  }

  function applyCropStyle(el, crop, mirrored) {
    const effX = mirrored ? (1 - crop.x - crop.w) : crop.x;
    el.style.position = 'absolute';
    el.style.width = `${100 / crop.w}%`;
    el.style.height = `${100 / crop.h}%`;
    el.style.left = `${-(effX / crop.w) * 100}%`;
    el.style.top = `${-(crop.y / crop.h) * 100}%`;
    el.style.objectFit = 'fill';
    el.style.transform = mirrored ? 'scaleX(-1)' : '';
  }

  function applyRefCrop() {
    if (nativeVideo) applyCropStyle(nativeVideo, state.refCrop, false);
  }
  /* ═══════════════════ crop rectangle overlays ═══════════════════ */
  const cropDrawMode = { ref: false, take: false };

  function setCropShades(shades, crop, mirrored) {
    const [top, bottom, left, right] = shades;
    const effX = mirrored ? (1 - crop.x - crop.w) : crop.x;
    const px = effX * 100;
    const py = crop.y * 100;
    const pw = crop.w * 100;
    const ph = crop.h * 100;
    top.style.left = '0%'; top.style.width = '100%'; top.style.top = '0%'; top.style.height = `${py}%`;
    bottom.style.left = '0%'; bottom.style.width = '100%'; bottom.style.top = `${py + ph}%`; bottom.style.height = `${100 - py - ph}%`;
    left.style.left = '0%'; left.style.width = `${px}%`; left.style.top = `${py}%`; left.style.height = `${ph}%`;
    right.style.left = `${px + pw}%`; right.style.width = `${100 - px - pw}%`; right.style.top = `${py}%`; right.style.height = `${ph}%`;
    const hideTop = py < 0.05, hideBottom = 100 - py - ph < 0.05;
    const hideLeft = px < 0.05, hideRight = 100 - px - pw < 0.05;
    top.classList.toggle('is-hidden', hideTop);
    bottom.classList.toggle('is-hidden', hideBottom);
    left.classList.toggle('is-hidden', hideLeft);
    right.classList.toggle('is-hidden', hideRight);
  }

  function renderCropBox(box, labelEl, crop, mirrored, active) {
    const effX = mirrored ? (1 - crop.x - crop.w) : crop.x;
    box.style.left = `${effX * 100}%`;
    box.style.top = `${crop.y * 100}%`;
    box.style.width = `${crop.w * 100}%`;
    box.style.height = `${crop.h * 100}%`;
    box.classList.toggle('is-hidden', !active);
    labelEl.textContent = `${Math.round(crop.w * 100)}% × ${Math.round(crop.h * 100)}%`;
  }

  function cropOverlayVisible(which) {
    // Crop overlay is drawn when draw mode is on, or when the crop is actually
    // non-default (so the user keeps seeing what is cut away).
    const crop = which === 'ref' ? state.refCrop : state.camCrop;
    const nonDefault = crop.x > 0.001 || crop.y > 0.001 || crop.w < 0.999 || crop.h < 0.999;
    return cropDrawMode[which] || nonDefault;
  }

  function refreshCropOverlays() {
    const refMirror = false;
    const takeMirror = false; // take stage shows the recorded frame, never mirrored
    const refActive = cropOverlayVisible('ref');
    const takeActive = cropOverlayVisible('take');
    refCropOverlay.classList.toggle('is-hidden', !refActive);
    takeCropOverlay.classList.toggle('is-hidden', !takeActive);
    refCropOverlay.classList.toggle('is-active', cropDrawMode.ref);
    takeCropOverlay.classList.toggle('is-active', cropDrawMode.take);
    if (refActive) {
      setCropShades([$('ref-shade-top'), $('ref-shade-bottom'), $('ref-shade-left'), $('ref-shade-right')], state.refCrop, refMirror);
      renderCropBox(refCropBox, refCropBoxLabel, state.refCrop, refMirror, true);
    }
    if (takeActive) {
      setCropShades([$('take-shade-top'), $('take-shade-bottom'), $('take-shade-left'), $('take-shade-right')], state.camCrop, takeMirror);
      renderCropBox(takeCropBox, takeCropBoxLabel, state.camCrop, takeMirror, true);
    }
  }

  /* Pointer-driven crop rectangle: drag anywhere to select, then move/resize. */
  function installCropDragger(which, overlay, box, labelEl, updateFn) {
    const stateKey = which === 'ref' ? 'refCrop' : 'camCrop';
    const mirrored = false;
    let mode = null;      // 'draw' | 'move' | 'resize'
    let handle = null;
    let origin = null;    // pointer origin in overlay fractions
    let startCrop = null;
    let rect = overlay.getBoundingClientRect();

    function fracFromEvent(e) {
      const r = overlay.getBoundingClientRect();
      return {
        x: clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1),
        y: clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1),
      };
    }

    function commit(crop) {
      const c = clampCropObj(crop);
      state[stateKey] = c;
      writeCropInputs(which === 'ref' ? 'crop' : 'tcrop', c);
      updateFn();
      refreshCropOverlays();
      updateUI();
      savePrefsDebounced();
    }

    // Draw mode: dragging anywhere starts a new rectangle selection.
    // Outside draw mode: the box can be moved, and its corner handles resize it.
    overlay.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      overlay.setPointerCapture(e.pointerId);
      const target = e.target;
      const h = target.closest ? target.closest('.crop-handle') : null;

      if (cropDrawMode[which]) {
        mode = 'draw';
        origin = fracFromEvent(e);
        startCrop = null;
        commit({ x: clamp(origin.x, 0, 0.9), y: clamp(origin.y, 0, 0.9), w: 0.1, h: 0.1 });
        return;
      }

      if (h) {
        mode = 'resize';
        handle = h.dataset.handle;
        origin = fracFromEvent(e);
        startCrop = { ...state[stateKey] };
        return;
      }
      if (target === box || (target.closest && target.closest('.crop-box') === box)) {
        mode = 'move';
        origin = fracFromEvent(e);
        startCrop = { ...state[stateKey] };
        return;
      }
    });

    overlay.addEventListener('pointermove', (e) => {
      if (!mode) return;
      e.preventDefault();
      const p = fracFromEvent(e);
      if (mode === 'draw') {
        const x = Math.min(origin.x, p.x);
        const y = Math.min(origin.y, p.y);
        const w = Math.max(0.1, Math.abs(p.x - origin.x));
        const h = Math.max(0.1, Math.abs(p.y - origin.y));
        commit({ x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h });
        return;
      }
      if (mode === 'move') {
        const dx = p.x - origin.x;
        const dy = p.y - origin.y;
        const x = clamp(startCrop.x + dx, 0, 1 - startCrop.w);
        const y = clamp(startCrop.y + dy, 0, 1 - startCrop.h);
        commit({ x, y, w: startCrop.w, h: startCrop.h });
        return;
      }
      if (mode === 'resize') {
        const c = { ...startCrop };
        const left = c.x;
        const right = c.x + c.w;
        const top = c.y;
        const bottom = c.y + c.h;
        const dx = p.x - origin.x;
        const dy = p.y - origin.y;
        if (handle === 'nw') { c.x = clamp(left + dx, 0, right - 0.1); c.y = clamp(top + dy, 0, bottom - 0.1); c.w = right - c.x; c.h = bottom - c.y; }
        else if (handle === 'ne') { c.w = clamp(startCrop.w + dx, 0.1, 1 - left); c.y = clamp(top + dy, 0, bottom - 0.1); c.h = bottom - c.y; }
        else if (handle === 'sw') { c.x = clamp(left + dx, 0, right - 0.1); c.w = right - c.x; c.h = clamp(startCrop.h + dy, 0.1, 1 - top); }
        else if (handle === 'se') { c.w = clamp(startCrop.w + dx, 0.1, 1 - left); c.h = clamp(startCrop.h + dy, 0.1, 1 - top); }
        commit(c);
      }
    });

    const endDrag = (e) => {
      if (!mode) return;
      mode = null;
      handle = null;
      origin = null;
      startCrop = null;
      try { overlay.releasePointerCapture(e.pointerId); } catch {}
    };
    overlay.addEventListener('pointerup', endDrag);
    overlay.addEventListener('pointercancel', endDrag);
    overlay.addEventListener('pointerleave', (e) => { if (mode && e.pointerType !== 'mouse') endDrag(e); });
  }


  function updateRefLayout() {
    if (!state.refReady || !state.ref) {
      refCell.style.aspectRatio = '16 / 9';
      refWidthLabel.textContent = `${state.refOutW} px`;
      applyRefCrop();
      return;
    }
    if (state.ref.kind === 'youtube' || state.ref.kind === 'vimeo') {
      refCell.style.aspectRatio = '16 / 9';
      return;
    }
    const dims = srcDims(nativeVideo);
    const out = outDims(dims.w, dims.h, state.refCrop, state.refOutW);
    refCell.style.aspectRatio = `${out.w} / ${out.h}`;
    refOutHeightEl.textContent = `${out.h} px`;
    refWidthLabel.textContent = `${out.w} px`;
    applyRefCrop();
  }

  function updateTakeLayout() {
    const visibleVideo = (state.takeBlob) ? takeVideo : camVideo;
    const dims = srcDims(visibleVideo, 640, 480);
    const out = outDims(dims.w, dims.h, state.camCrop, state.camOutW);
    takeCell.style.aspectRatio = `${out.w} / ${out.h}`;
    takeOutHeightEl.textContent = `${out.h} px`;
    takeWidthLabel.textContent = `${out.w} px`;
    if (camVideo && camVideo.srcObject) applyCropStyle(camVideo, state.camCrop, state.mirrorPreview);
    if (takeVideo.src) applyCropStyle(takeVideo, state.camCrop, false);
  }

  /* ═══════════════════ camera ═══════════════════ */
  async function openCamera(quiet = false) {
    if (state.camStream && state.camStream.getVideoTracks().some(t => t.readyState === 'live')) return true;
    const base = state.camDeviceId ? { deviceId: { ideal: state.camDeviceId } } : { facingMode: { ideal: 'user' } };
    const sets = [
      { video: { ...base, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } },
      { video: base, audio: true },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false },
    ];
    for (const c of sets) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        state.camStream = s;
        camVideo.srcObject = s;
        camVideo.muted = true;
        await camVideo.play().catch(() => {});
        applyMirror();
        updateTakeLayout();
        updateUI();
        refreshButtons();
        return true;
      } catch { /* try next */ }
    }
    if (!quiet) toast('Camera permission denied. Allow camera access in your browser settings.', 3600);
    return false;
  }

  function stopCameraTracks() {
    if (state.camStream) {
      state.camStream.getTracks().forEach(t => t.stop());
      state.camStream = null;
    }
    camVideo.srcObject = null;
  }

  async function enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      renderDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch { renderDevices([]); }
  }

  function renderDevices(devices) {
    camDeviceList.innerHTML = '';
    if (!devices.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'No camera devices reported.';
      camDeviceList.appendChild(p);
      return;
    }
    devices.forEach((d, i) => {
      const b = document.createElement('button');
      b.className = 'device-btn' + (state.camDeviceId === d.deviceId ? ' is-active' : '');
      b.textContent = d.label || `Camera ${i + 1}`;
      b.addEventListener('click', async () => {
        state.camDeviceId = d.deviceId;
        stopCameraTracks();
        const ok = await openCamera();
        renderDevices(devices);
        updateUI();
        if (!ok) toast('That camera could not be opened.', 2600);
      });
      camDeviceList.appendChild(b);
    });
  }

  function applyMirror() {
    btnMirror.textContent = 'Mirror preview: ' + (state.mirrorPreview ? 'on' : 'off');
    if (camVideo.srcObject) applyCropStyle(camVideo, state.camCrop, state.mirrorPreview);
  }

  /* ═══════════════════ recording ═══════════════════ */
  function pickMime() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const t of candidates) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t; } catch {}
    }
    return '';
  }

  function probeDecodes(videoEl) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        try { videoEl.pause(); } catch {}
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), 3000);
      const step = (now, entry) => {
        clearTimeout(timer);
        done(entry && Number.isFinite(entry.mediaTime));
      };
      try {
        videoEl.addEventListener('error', () => done(false), { once: true });
        if (typeof videoEl.requestVideoFrameCallback === 'function') {
          videoEl.requestVideoFrameCallback(step);
          videoEl.muted = true;
          videoEl.play().catch(() => done(false));
        } else {
          const t = setTimeout(() => done(videoEl.readyState >= 2), 900);
          videoEl.addEventListener('loadeddata', () => { clearTimeout(t); done(true); }, { once: true });
        }
      } catch { done(false); }
    });
  }

  async function containerInfo(blob) {
    try {
      const buf = await blob.slice(0, 12).arrayBuffer();
      const bytes = new Uint8Array(buf);
      const ascii = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
      if (ascii.includes('ftyp')) return { container: 'mp4' };
      if (bytes[0] === 0x1a && bytes[1] === 0x45) return { container: 'webm' };
    } catch {}
    return { container: 'unknown' };
  }

  let recorder = null;
  let recChunks = [];
  let recStartTime = 0;
  let recTimerId = 0;
  let recTimeoutId = 0;
  let recLimit = 0;
  let recWindow = 0;
  let countdownTimer = 0;
  let refStartTimerId = 0;

  function muteReferenceForRecording() {
    if (state.ref.kind === 'native' && nativeVideo) nativeVideo.muted = true;
    if (state.ref.kind === 'youtube') ytCmd('mute');
    if (state.ref.kind === 'vimeo') vimeoCmd('setVolume', { value: 0 });
  }

  // Recording window = trimmed reference length + the reference start delay.
  // The delay does not shift the reference during recording (it starts together
  // with the take); the window is simply long enough that the delayed reference
  // still fits inside the take when played back.
  function recordWindow() {
    return trimDuration() + Math.max(0, state.refDelay);
  }

  function refStartOffset() {
    return Math.max(0, state.refDelay);
  }

  function startRecording() {
    if (!state.refReady || trimDuration() <= 0) { toast('Trim the reference to a positive length first.', 2600); return; }
    if (!state.camStream) { toast('Enable the camera first.', 2200); return; }
    const mime = pickMime();

    recLimit = trimDuration();
    recWindow = recordWindow();
    state.recording = true;
    state.mode = 'record';
    state.countdownActive = true;
    state.countdownValue = 3;

    // 3-2-1 countdown before the recorder and the reference start.
    let count = 3;
    countdownOverlay.classList.add('is-on');
    countdownLabel.textContent = 'Recording starts in…';
    showCountdown(count);
    updateUI();
    refreshButtons();

    const tick = () => {
      count -= 1;
      if (count > 0) {
        state.countdownValue = count;
        showCountdown(count);
        return;
      }
      clearInterval(countdownTimer);
      countdownTimer = 0;
      state.countdownActive = false;
      countdownOverlay.classList.remove('is-on');
      beginRecording(mime);
    };
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
  }

  function showCountdown(n) {
    countdownNumber.textContent = String(n);
    countdownNumber.classList.remove('pop');
    void countdownNumber.offsetWidth;
    countdownNumber.classList.add('pop');
    countdownLabel.textContent = n > 1 ? `Recording starts in ${n}…` : 'Recording starts now';
    updateUI();
  }

  function beginRecording(mime) {
    try {
      recorder = mime ? new MediaRecorder(state.camStream, { mimeType: mime, videoBitsPerSecond: 2500000 }) : new MediaRecorder(state.camStream);
    } catch {
      recorder = null;
      state.recording = false;
      state.mode = 'idle';
      updateUI();
      refreshButtons();
      toast('This browser cannot record video.', 2600);
      return;
    }
    recChunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    recorder.onerror = () => toast('Recording failed. Try again.', 2600);
    const stopPromise = new Promise((resolve) => { recorder.onstop = resolve; });

    recStartTime = performance.now();
    recorder.start(250);

    // During recording the reference starts together with the take (delay is
    // playback-only); the window already includes the delay.
    seekReference(state.refTrim.start);
    muteReferenceForRecording();

    clearTimeout(refStartTimerId);
    refStartTimerId = setTimeout(() => {
      if (state.recording) playReference();
    }, 180);

    clearInterval(recTimerId);
    recTimerId = setInterval(() => {
      const el = Math.max(0, Math.min(recWindow, (performance.now() - recStartTime) / 1000));
      recTimer.textContent = fmtTrim(el);
      recCap.textContent = 'of ' + fmtTrim(recWindow);
    }, 100);

    clearTimeout(recTimeoutId);
    recTimeoutId = setTimeout(() => stopRecording(), Math.max(0, recWindow * 1000));

    updateUI();
    refreshButtons();
    toast(`Recording — stops at ${fmtTrim(recWindow)} (trim ${fmtTrim(trimDuration())} + ${state.refDelay.toFixed(1)} s delay)`, 2600);

    stopPromise.then(async () => {
      clearInterval(recTimerId);
      clearTimeout(recTimeoutId);
      const elapsed = Math.min(recWindow, Math.max(0, (performance.now() - recStartTime) / 1000));
      const blob = new Blob(recChunks, { type: recorder.mimeType || mime || 'video/webm' });
      const mimeStr = String(recorder && recorder.mimeType || '');
      state.takeHasAudio = /opus|mp4a|aac/i.test(mimeStr);
      state.takeBlob = blob.size > 0 ? blob : null;
      state.takeDuration = elapsed;
      if (state.takeUrl) URL.revokeObjectURL(state.takeUrl);
      state.takeUrl = URL.createObjectURL(blob);
      state.recording = false;
      recorder = null;
      takeVideo.src = state.takeUrl;
      takeVideo.muted = true;
      takeVideo.currentTime = 0;
      takeVideo.preload = 'auto';
      takeProgress.value = '0';
      takeProgress.style.setProperty('--fill', '0%');
      takeProgressTime.textContent = '00:00';
      syncRefAudio();
      updateUI();
      refreshButtons();
      toast(`Take saved — ${fmt(state.takeDuration)}`, 1600);

      probeDecodes(takeVideo).then(async (ok) => {
        state.takeDecodable = ok;
        const info = await containerInfo(blob);
        state.takeContainer = info.container;
        updateUI();
        if (!ok) toast('This browser could not decode the recording — record again if playback fails.', 3600);
      });
    });
  }

  function stopRecording() {
    if (!state.recording) return;
    clearInterval(countdownTimer);
    countdownTimer = 0;
    clearTimeout(refStartTimerId);
    refStartTimerId = 0;
    state.countdownActive = false;
    countdownOverlay.classList.remove('is-on');
    if (!recorder) {
      // Cancelled during the countdown: nothing was captured, so reset cleanly.
      state.recording = false;
      state.mode = 'idle';
      state.countdownValue = 3;
      updateUI();
      refreshButtons();
      toast('Recording cancelled.', 1600);
      return;
    }
    pauseReference();
    btnStop.disabled = true;
    btnRecord.disabled = true;
    try { recorder.stop(); } catch {
      state.recording = false;
      updateUI();
    }
  }

  /* ═══════════════════ reference playback ═══════════════════ */
  function refIsPlaying() {
    if (!state.ref) return false;
    if (state.ref.kind === 'native' && nativeVideo) return !nativeVideo.paused && !nativeVideo.ended;
    if (state.ref.kind === 'youtube') return YT.playing;
    if (state.ref.kind === 'vimeo') return VIMEO.playing;
    return false;
  }

  function refCurrentTime() {
    if (!state.ref) return 0;
    const dur = state.ref.duration || 0;
    if (state.ref.kind === 'native' && nativeVideo) return nativeVideo.currentTime;
    if (state.ref.kind === 'youtube') {
      let t = YT.current;
      if (YT.playing && YT.currentAt) t += (performance.now() - YT.currentAt) / 1000;
      return clamp(t, 0, Math.max(0, dur));
    }
    if (state.ref.kind === 'vimeo') {
      let t = VIMEO.current;
      if (VIMEO.playing && VIMEO.currentAt) t += (performance.now() - VIMEO.currentAt) / 1000;
      return clamp(t, 0, Math.max(0, dur));
    }
    return 0;
  }

  function refDuration() {
    if (!state.ref) return 0;
    return state.ref.duration || 0;
  }

  function playReference() {
    if (!state.refReady || !state.ref) return;
    state.refPreviewActive = true;
    if (state.ref.kind === 'native' && nativeVideo) {
      nativeVideo.muted = state.mutedRef;
      nativeVideo.play().catch(() => toast('Press Preview once more to start playback.', 2000));
    } else if (state.ref.kind === 'youtube') {
      if (!YT.ready) YT.pendingPlay = true;
      else ytCmd('playVideo');
    } else if (state.ref.kind === 'vimeo') {
      if (!VIMEO.ready) VIMEO.pendingPlay = true;
      else vimeoCmd('play');
    }
  }

  function pauseReference() {
    state.refPreviewActive = false;
    if (!state.ref) return;
    if (state.ref.kind === 'native' && nativeVideo) nativeVideo.pause();
    if (state.ref.kind === 'youtube') { ytCmd('pauseVideo'); YT.playing = false; }
    if (state.ref.kind === 'vimeo') { vimeoCmd('pause'); VIMEO.playing = false; }
    updateRefPlayLabel();
  }

  function seekReference(seconds) {
    if (!state.ref) return;
    const dur = Math.max(0, refDuration());
    const t = clamp(seconds, 0, Math.max(0, dur));
    if (state.ref.kind === 'native' && nativeVideo) {
      try { nativeVideo.currentTime = t; } catch {}
    } else if (state.ref.kind === 'youtube') {
      ytCmd('seekTo', [t, true]);
      YT.current = t;
      YT.currentAt = performance.now();
    } else if (state.ref.kind === 'vimeo') {
      vimeoCmd('seekTo', { value: Math.min(t, Math.max(0, dur - 0.05)) });
      VIMEO.current = t;
      VIMEO.currentAt = performance.now();
    }
  }

  function syncRefAudio() {
    if (nativeVideo) nativeVideo.muted = state.mutedRef;
    if (state.ref && state.ref.kind === 'youtube' && YT.ready) {
      if (state.mutedRef) ytCmd('mute'); else ytCmd('unMute');
    }
    if (state.ref && state.ref.kind === 'vimeo' && VIMEO.ready) {
      vimeoCmd('setVolume', { value: state.mutedRef ? 0 : 1 });
    }
    updateMuteButton();
  }

  function updateMuteButton() {
    btnRefMute.innerHTML = state.mutedRef
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 8l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4zm12.5 3A4.5 4.5 0 0 0 14 8v2.2c.3.5.5 1.1.5 1.8s-.2 1.3-.5 1.8V16a4.5 4.5 0 0 0 2.5-4z"/></svg>';
    btnRefMute.title = state.mutedRef ? 'Unmute reference' : 'Mute reference';
    btnRefMute.setAttribute('aria-label', btnRefMute.title);
  }

  function updateRefPlayLabel() {
    btnRefPlay.innerHTML = state.mode === 'play' ? 'Stop review' : (state.refPreviewActive ? 'Pause' : 'Preview');
    btnReview.innerHTML = state.playing ? 'Stop review' : 'Play both';
    btnTakePlay.innerHTML = state.takePlaying ? 'Stop take' : 'Play take';
  }

  function toggleRefPreview() {
    if (!state.refReady) return;
    if (state.mode === 'play') { stopReview(); return; }
    if (state.refPreviewActive) {
      pauseReference();
    } else {
      const dur = refDuration();
      const t = refCurrentTime();
      if (t >= dur - 0.1 || t < state.refTrim.start - 0.05 || t > state.refTrim.end + 0.05) {
        seekReference(state.refTrim.start);
      }
      syncRefAudio();
      playReference();
    }
    updateRefPlayLabel();
    refreshButtons();
  }

  setInterval(() => {
    if (!state.refPreviewActive) return;
    if (state.mode === 'play' || state.mode === 'record' || exportState.active) return;
    const t = refCurrentTime();
    if (t >= state.refTrim.end - 0.05) {
      if (state.loopRef) {
        seekReference(state.refTrim.start);
        syncRefAudio();
        playReference();
      } else {
        pauseReference();
        refreshButtons();
      }
    }
    const frac = trimDuration() > 0 ? clamp((t - state.refTrim.start) / trimDuration(), 0, 1) : 0;
    refProgress.value = String(Math.round(frac * 1000));
    refProgress.style.setProperty('--fill', `${frac * 100}%`);
    refProgressTime.textContent = fmt(t);
    updateRefPlayLabel();
  }, 180);

  /* ═══════════════════ take playback alone ═══════════════════ */
  function startTakePlay() {
    if (!state.takeBlob || state.takeDecodable === false) {
      if (state.takeDecodable === false) toast('The recorded clip cannot be decoded by this browser.', 3000);
      return;
    }
    stopCameraTracks();
    takeVideo.currentTime = 0;
    takeVideo.muted = false;
    takeVideo.playbackRate = 1;
    state.takePlaying = true;
    state.mode = 'takeplay';
    updateUI();
    refreshButtons();
    takeVideo.play().catch(() => toast('Press Play take again.', 2000));
    toast('Playing your take alone.', 1400);
  }

  function stopTakePlay() {
    try { takeVideo.pause(); } catch {}
    state.takePlaying = false;
    state.mode = 'idle';
    updateUI();
    refreshButtons();
    reopenCameraAfterPlayback();
  }

  function toggleTakePlay() {
    if (!state.takeBlob) return;
    if (state.takePlaying) stopTakePlay();
    else startTakePlay();
  }

  setInterval(() => {
    if (!state.takePlaying) return;
    const t = takeVideo.currentTime;
    const dur = Math.max(0, state.takeDuration);
    const frac = dur > 0 ? clamp(t / dur, 0, 1) : 0;
    takeProgress.value = String(Math.round(frac * 1000));
    takeProgress.style.setProperty('--fill', `${frac * 100}%`);
    takeProgressTime.textContent = fmt(t);
    if (takeVideo.ended || t >= dur - 0.05) stopTakePlay();
  }, 180);

  /* ═══════════════════ synchronized review ═══════════════════ */
  let reviewTickId = 0;
  let seekHoldUntil = 0;
  let reviewWatchId = 0;

  // Review window: the take runs from 0 and the reference joins refDelay later.
  // The window never exceeds the take length.
  function reviewWindow() {
    const refLen = trimDuration();
    const takeLen = Math.max(0, state.takeDuration);
    const delay = refStartOffset();
    if (takeLen <= 0) return refLen + delay;
    return Math.min(takeLen, delay + refLen);
  }

  function refSpanInReview() {
    return Math.max(0, Math.min(trimDuration(), Math.max(0, state.takeDuration) - refStartOffset()));
  }

  function muteAllReferenceAudio() {
    if (state.ref.kind === 'native' && nativeVideo) nativeVideo.muted = true;
    if (state.ref.kind === 'youtube') ytCmd('mute');
    if (state.ref.kind === 'vimeo') vimeoCmd('setVolume', { value: 0 });
  }

  function unmuteReferenceAudio() {
    if (state.ref.kind === 'native' && nativeVideo) nativeVideo.muted = false;
    if (state.ref.kind === 'youtube') ytCmd('unMute');
    if (state.ref.kind === 'vimeo') vimeoCmd('setVolume', { value: 1 });
    updateMuteButton();
  }

  function startReview() {
    if (!state.refReady || trimDuration() <= 0 || !state.takeBlob || state.takeDecodable === false) {
      if (state.takeDecodable === false) toast('The recorded clip cannot be decoded by this browser.', 3000);
      return;
    }
    const dur = reviewWindow();
    const resumeFrom = state.resumeAt;
    const startAt = (resumeFrom > 0.05 && resumeFrom < dur - 0.1) ? resumeFrom : 0;
    state.resumeAt = 0;
    state.resumeFrom = startAt;
    state.playing = true;
    state.mode = 'play';
    state.refPreviewActive = true;

    stopCameraTracks();

    // Reference position: at resume point, but shifted by the delay.
    const delay = refStartOffset();
    const refOffset = Math.max(0, startAt - delay);   // reference clock relative to trim start
    const refAt = state.refTrim.start + Math.min(refOffset, trimDuration());
    const takeAt = clamp(startAt, 0, Math.max(0, state.takeDuration));

    seekReference(refAt);
    takeVideo.currentTime = takeAt;
    takeVideo.playbackRate = 1;
    takeVideo.loop = false;

    const wantRefAudio = !state.mutedRef;
    const wantTakeAudio = state.takeHasAudio;
    takeVideo.muted = true;
    muteAllReferenceAudio();

    seekHoldUntil = performance.now() + 1200;
    setTimeout(() => {
      // Take starts immediately; reference joins after the delay.
      const p = takeVideo.play();
      if (p && p.catch) p.catch(() => toast('Press Play both again to start playback.', 2200));
      const refWait = Math.max(0, delay - startAt) * 1000;
      setTimeout(() => {
        if (!state.playing) return;
        playReference();
        setTimeout(() => {
          if (!state.playing) return;
          if (wantRefAudio) unmuteReferenceAudio();
          if (wantTakeAudio) takeVideo.muted = false;
          reviewWatch();
        }, 500);
      }, refWait);
    }, 220);

    clearInterval(reviewTickId);
    reviewTickId = setInterval(() => {
      if (!state.playing) return;
      const delay = refStartOffset();
      const tt = takeVideo.currentTime;
      const dur = reviewWindow();
      const takeDur = Math.max(0, state.takeDuration);
      const holding = performance.now() < seekHoldUntil;
      const active = !takeVideo.paused && !takeVideo.ended;
      const refT = refCurrentTime() - state.refTrim.start;      // reference clock within trim
      const refInReview = refT + delay;                        // reference position on the review timeline
      if (!holding && active && Number.isFinite(refT) && Number.isFinite(tt)) {
        const drift = tt - refInReview;
        if (Math.abs(drift) > 0.45 && tt > 0.5 && tt < takeDur - 0.05) {
          try { takeVideo.currentTime = clamp(refInReview, 0, takeDur); } catch {}
        }
      }
      const frac = dur > 0 ? clamp(tt / dur, 0, 1) : 0;
      reviewProgress.value = String(Math.round(frac * 1000));
      reviewProgress.style.setProperty('--fill', `${frac * 100}%`);
      reviewTime.textContent = fmt(tt);
      if (takeVideo.ended || (!holding && active && tt >= dur - 0.05)) handleReviewEnded();
    }, 120);

    updateUI();
    refreshButtons();
    toast(startAt > 0.05 ? 'Resuming both clips together' : 'Playing both clips together', 1600);
  }

  function reviewWatch() {
    clearInterval(reviewWatchId);
    let stalls = 0;
    let frozen = 0;
    let lastTakeTime = takeVideo.currentTime;
    let frameSeen = false;
    if (typeof takeVideo.requestVideoFrameCallback === 'function') {
      const step = () => { frameSeen = true; if (takeVideo.isConnected) takeVideo.requestVideoFrameCallback(step); };
      try { takeVideo.requestVideoFrameCallback(step); } catch {}
    }
    reviewWatchId = setInterval(() => {
      if (!state.playing) { clearInterval(reviewWatchId); return; }
      const refMoved = refCurrentTime() - state.refTrim.start > 0.3;
      const pausedUnexpectedly = takeVideo.paused && !takeVideo.ended && refMoved;
      if (pausedUnexpectedly) {
        stalls++;
        takeVideo.muted = true;
        const p = takeVideo.play();
        if (p && p.catch) p.catch(() => {});
        if (stalls > 4) {
          clearInterval(reviewWatchId);
          stopReview('This browser blocks simultaneous playback. Showing your take alone.');
          return;
        }
      } else {
        stalls = 0;
      }
      const advanced = takeVideo.currentTime - lastTakeTime;
      lastTakeTime = takeVideo.currentTime;
      if (!pausedUnexpectedly && advanced > 0.05 && !frameSeen) {
        frozen++;
        if (frozen > 8) {
          clearInterval(reviewWatchId);
          stopReview('This browser could not decode the recorded clip in sync mode. Showing it alone.');
        }
      }
    }, 600);
  }

  function handleReviewEnded() {
    if (!state.playing) return;
    state.resumeAt = Math.max(0, takeVideo.currentTime);
    state.resumeFrom = 0;
    pauseReference();
    try { takeVideo.pause(); } catch {}
    state.playing = false;
    state.mode = 'idle';
    clearInterval(reviewTickId);
    clearInterval(reviewWatchId);
    reviewTickId = 0;
    reviewWatchId = 0;
    updateUI();
    refreshButtons();
    reopenCameraAfterPlayback();
    toast('Review finished.', 1600);
  }

  function stopReview(reason) {
    if (!state.playing) return;
    state.resumeAt = Math.max(0, takeVideo.currentTime);
    state.resumeFrom = 0;
    pauseReference();
    try { takeVideo.pause(); } catch {}
    state.playing = false;
    state.mode = 'idle';
    clearInterval(reviewTickId);
    clearInterval(reviewWatchId);
    reviewTickId = 0;
    reviewWatchId = 0;
    updateUI();
    refreshButtons();
    reopenCameraAfterPlayback();
    if (reason) toast(reason, 3600);
  }

  function toggleReview() {
    if (state.playing) stopReview();
    else startReview();
  }

  function seekReview(frac) {
    const dur = reviewWindow();
    const seconds = clamp(frac * dur, 0, Math.max(0, dur));
    seekHoldUntil = performance.now() + 900;
    const delay = refStartOffset();
    const refT = clamp(Math.max(0, seconds - delay), 0, Math.max(0, trimDuration()));
    seekReference(state.refTrim.start + refT);
    try { takeVideo.currentTime = clamp(seconds, 0, Math.max(0, state.takeDuration)); } catch {}
    reviewTime.textContent = fmt(seconds);
    reviewProgress.style.setProperty('--fill', `${frac * 100}%`);
    if (state.playing) {
      setTimeout(() => {
        if (!state.playing) return;
        if (takeVideo.paused) takeVideo.play().catch(() => {});
        if (!refIsPlaying()) playReference();
      }, 260);
    }
  }

  function reopenCameraAfterPlayback() {
    if (state.camStream) return;
    openCamera(true).then(() => updateUI()).catch(() => {});
  }

  /* ═══════════════════ border ═══════════════════ */
  function updateDivider() {
    divider.style.height = `${state.borderSize}px`;
    divider.style.backgroundColor = state.borderColor;
    divider.style.display = state.borderSize > 0 ? 'block' : 'none';
    dividerWrap.style.display = state.borderSize > 0 ? 'flex' : 'none';
    borderSizeLabel.textContent = `${state.borderSize} px`;
    borderColorLabel.textContent = state.borderColor;
  }

  function updateSummaries() {
    const refW = state.refReady && state.ref ? (state.ref.kind === 'native' ? Number(state.refOutW) : 0) : 0;
    const takeW = Number(state.camOutW);
    const refPart = refW > 0 ? `reference ${refW} px wide` : 'reference not sized';
    const takePart = state.takeBlob ? `take ${takeW} px wide` : `take ${takeW} px wide`;
    layoutSummary.textContent = `${refPart} above, ${takePart} below. Border ${state.borderSize} px ${state.borderColor}.`;
    if (state.refReady && state.takeBlob) {
      const refOut = state.ref.kind === 'native'
        ? outDims(srcDims(nativeVideo, 1280, 720).w, srcDims(nativeVideo, 1280, 720).h, state.refCrop, state.refOutW)
        : null;
      const takeOut = outDims(srcDims(takeVideo, 640, 480).w, srcDims(takeVideo, 640, 480).h, state.camCrop, state.camOutW);
      const w = Math.max(Number(state.refOutW), Number(state.camOutW));
      const refH = refOut ? Math.max(30, Math.round(w / ((state.refCrop.w * srcDims(nativeVideo, 1280, 720).w) / (state.refCrop.h * srcDims(nativeVideo, 1280, 720).h)))) : 0;
      const takeSrc = srcDims(takeVideo, 640, 480);
      const takeH = Math.max(30, Math.round(w / ((state.camCrop.w * takeSrc.w) / (state.camCrop.h * takeSrc.h))));
      const h = refH + state.borderSize + takeH;
      const takeLen = Math.max(0, state.takeDuration);
      const mergedDur = Math.min(takeLen, refStartOffset() + trimDuration());
      const delayTooLong = refStartOffset() > takeLen - 0.05;
      exportSummary.textContent = delayTooLong
        ? `Merged output ≈ ${w}×${h} px — delay ${state.refDelay.toFixed(1)} s is longer than the ${fmtTrim(takeLen)} take; record again to include the reference.`
        : `Merged output ≈ ${w}×${h} px, ${fmtTrim(mergedDur)} long.`;
    } else {
      exportSummary.textContent = 'Merged size appears once both clips are ready.';
    }
  }

  /* ═══════════════════ UI state ═══════════════════ */
  function isProviderRef() {
    return !!(state.ref && (state.ref.kind === 'youtube' || state.ref.kind === 'vimeo'));
  }

  function updateUI() {
    const idle = !state.recording && !state.playing && !state.takePlaying && !exportState.active;

    const hasRefMedia = !!(nativeVideo || YT.iframe || VIMEO.iframe);
    if (!state.refReady && !hasRefMedia) refEmpty.classList.remove('is-hidden');
    else refEmpty.classList.add('is-hidden');

    if (state.refReady && state.ref) {
      refBadgeLabel.textContent = state.ref.label || 'Reference';
      refBadgeTime.textContent = fmt(trimDuration());
    } else {
      refBadgeTime.textContent = '--';
    }

    if (state.countdownActive) {
      takeBadgeLabel.textContent = 'Starting';
      takeBadgeTime.textContent = String(state.countdownValue);
    } else if (state.recording) {
      takeBadgeLabel.textContent = 'Recording';
      takeBadgeTime.textContent = fmtTrim(recWindow);
    } else if (state.takeBlob) {
      takeBadgeLabel.textContent = 'Take';
      takeBadgeTime.textContent = fmtTrim(state.takeDuration);
    } else if (state.camStream) {
      takeBadgeLabel.textContent = 'Camera preview';
      takeBadgeTime.textContent = trimDuration() > 0 ? '≤ ' + fmtTrim(recordWindow()) : '--';
    } else {
      takeBadgeLabel.textContent = 'Camera';
      takeBadgeTime.textContent = '--';
    }

    const showCam = state.recording || (!state.takeBlob && !state.takePlaying && !state.playing);
    const showTake = !!state.takeBlob && !state.recording && (state.takePlaying || state.playing || idle);
    camLayer.style.display = showCam && (state.camStream || state.recording) ? 'block' : 'none';
    takeLayer.style.display = showTake ? 'block' : 'none';

    if (!state.camStream && !state.takeBlob && !state.recording) camEmpty.classList.remove('is-hidden');
    else camEmpty.classList.add('is-hidden');

    recOverlay.classList.toggle('is-on', state.recording && !state.countdownActive);
    countdownOverlay.classList.toggle('is-on', state.countdownActive);
    takePlayOverlay.classList.toggle('is-on', !!state.takeBlob && idle && !state.takePlaying && !state.playing);

    $('ref-badge').classList.toggle('is-live', state.refPreviewActive && state.mode !== 'play');
    $('take-badge').classList.toggle('is-live', state.recording || state.countdownActive);

    takeBadgeMini.textContent = state.countdownActive
      ? `starting ${state.countdownValue}`
      : state.recording
        ? `rec ${fmtTrim(recWindow)}`
        : state.takeBlob ? `take ${fmtTrim(state.takeDuration)}` : trimDuration() > 0 ? `limit ${fmtTrim(recordWindow())}` : '--';
    btnCamEnable.textContent = state.camStream ? 'Reload camera' : 'Enable camera';
    btnEnableCam.textContent = state.camStream ? 'Reload camera' : 'Enable camera';
    btnMirror.textContent = 'Mirror preview: ' + (state.mirrorPreview ? 'on' : 'off');

    if (state.camStream) takeSourceLabel.textContent = 'Camera live';
    else if (state.takeBlob) takeSourceLabel.textContent = 'Take recorded';
    else takeSourceLabel.textContent = 'Camera idle';

    if (state.takeBlob && state.refReady) {
      const d = state.refDelay.toFixed(1);
      if (state.refDelay > 0) {
        reviewHint.textContent = state.playing
          ? `Take playing; reference joins after ${d} s.`
          : `Window ${fmtTrim(reviewWindow())} — take first, reference +${d} s.`;
      } else {
        reviewHint.textContent = state.playing
          ? 'Take and reference playing together.'
          : `Window ${fmtTrim(reviewWindow())} — take and reference together.`;
      }
    } else if (!state.refReady) {
      reviewHint.textContent = 'Load a reference clip first.';
    } else {
      reviewHint.textContent = 'Record a take first.';
    }

    let status = 'Ready';
    let chipClass = '';
    if (exportState.active) { status = 'Exporting'; chipClass = 'is-active'; }
    else if (state.countdownActive) { status = `Starting in ${state.countdownValue}`; chipClass = 'is-active'; }
    else if (state.recording) { status = 'Recording'; chipClass = 'is-active'; }
    else if (state.playing) { status = 'Reviewing'; chipClass = 'is-active'; }
    else if (state.takePlaying) { status = 'Playing take'; chipClass = 'is-active'; }
    else if (state.refPreviewActive) { status = 'Previewing reference'; chipClass = 'is-active'; }
    else if (state.refReady && state.takeBlob) { status = 'Ready to review'; chipClass = 'is-ready'; }
    else if (state.refReady) { status = 'Reference ready'; chipClass = 'is-ready'; }
    statusText.textContent = status;
    statusChip.classList.remove('is-active', 'is-ready');
    if (chipClass) statusChip.classList.add(chipClass);

    if (isProviderRef()) {
      refDownloadHint.textContent = 'Embedded YouTube/Vimeo players cannot be downloaded.';
    } else if (state.refReady && !state.refBlob) {
      refDownloadHint.textContent = 'Direct URL blocked by CORS — upload the file to download it.';
    } else {
      refDownloadHint.textContent = 'Applies trim, crop, and resize.';
    }

    const cropAllowed = state.refReady && !isProviderRef();
    ['crop-left', 'crop-top', 'crop-width', 'crop-height'].forEach(id => { $(id).disabled = !cropAllowed || !idle; });
    btnCropReset.disabled = !cropAllowed || !idle;
    btnCropDraw.disabled = !(state.refReady && !isProviderRef()) || state.recording || exportState.active;
    btnTcropDraw.disabled = state.recording || exportState.active;
    cropHint.classList.toggle('is-hidden', !isProviderRef());
    refWidthEl.disabled = !state.refReady || isProviderRef() || !idle;

    delayLabel.textContent = `${state.refDelay.toFixed(1)} s`;
    delayHint.textContent = state.refDelay > 0
      ? `Take plays first; reference joins ${state.refDelay.toFixed(1)} s later in Play both and merged download. Recording starts them together and allows ${state.refDelay.toFixed(1)} s extra time.`
      : 'Reference starts together with the take.';
    btnDelayReset.disabled = exportState.active || state.recording || state.playing;

    updateDivider();
    updateRefLayout();
    updateTakeLayout();
    updateSummaries();
    refreshCropOverlays();
    updateRefPlayLabel();
  }

  function refreshButtons() {
    const idle = !state.recording && !state.playing && !state.takePlaying && !exportState.active;
    const refPlayable = state.refReady && trimDuration() > 0;
    btnRecord.disabled = !(refPlayable && !!state.camStream && idle);
    btnStop.disabled = !state.recording;
    btnRetake.disabled = !(!!state.takeBlob && idle);
    btnRefPlay.disabled = !(refPlayable && !state.recording && !state.takePlaying && !exportState.active);
    // Transport buttons must stay usable while playing so playback can be stopped.
    btnTakePlay.disabled = !(!!state.takeBlob) || state.recording || exportState.active;
    btnReview.disabled = !(refPlayable && !!state.takeBlob) || state.recording || exportState.active;
    btnDownloadRef.disabled = !(refPlayable && !!state.refBlob && idle);
    btnDownloadTake.disabled = !(!!state.takeBlob && idle);
    btnExportMerged.disabled = !(refPlayable && !!state.refBlob && !!state.takeBlob && idle);

    refProgress.disabled = !refPlayable || state.recording || exportState.active;
    takeProgress.disabled = !state.takeBlob || state.recording || exportState.active;
    reviewProgress.disabled = !(refPlayable && !!state.takeBlob) || state.recording || exportState.active;
    btnRefMute.disabled = !refPlayable;
    btnRefLoop.disabled = !refPlayable;

    trimStartEl.disabled = trimEndEl.disabled = !refPlayable || !idle;
    btnTrimReset.disabled = !refPlayable || !idle;

    updateRefPlayLabel();
    updateMuteButton();
  }

  /* ═══════════════════ export ═══════════════════ */
  function pickExportMime() {
    const cands = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (const c of cands) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c; } catch {}
    }
    return '';
  }

  async function makeVideo(blob) {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    exportStage.appendChild(v);
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      v.onloadedmetadata = finish;
      v.onerror = finish;
      setTimeout(finish, 5000);
      v.load();
    });
    if (!Number.isFinite(v.duration) || v.duration === 0) {
      try {
        v.currentTime = 1e101;
        await new Promise((r) => { v.onseeked = r; setTimeout(r, 1500); });
        v.currentTime = 0;
      } catch {}
    }
    if (!v.videoWidth) {
      try {
        v.muted = true;
        await v.play();
        await new Promise((r) => setTimeout(r, 250));
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
    return { v, url };
  }

  function drawClip(ctx, video, crop, out, dx, dy) {
    const sw = video.videoWidth || 640;
    const sh = video.videoHeight || 360;
    const sx = crop.x * sw;
    const sy = crop.y * sh;
    const scw = Math.max(1, crop.w * sw);
    const sch = Math.max(1, crop.h * sh);
    try { ctx.drawImage(video, sx, sy, scw, sch, dx, dy, out.w, out.h); } catch {}
  }

  function showExport(title) {
    exportTitle.textContent = title;
    exportFill.style.width = '0%';
    exportStatus.textContent = 'Preparing clips…';
    exportOverlay.classList.add('is-on');
  }

  function hideExport() {
    exportOverlay.classList.remove('is-on');
  }

  function setExportProgress(frac, text) {
    exportFill.style.width = `${Math.round(clamp(frac, 0, 1) * 100)}%`;
    if (text) exportStatus.textContent = text;
  }

  async function exportVideo(kind) {
    if (exportState.active) return;
    const idle = !state.recording && !state.playing && !state.takePlaying;
    if (!idle) { toast('Stop recording or playback before exporting.', 2600); return; }

    const refBlob = state.refBlob;
    const takeBlob = state.takeBlob;
    if ((kind === 'ref' || kind === 'merged') && !refBlob) {
      toast(isProviderRef() ? 'Embedded players cannot be downloaded — upload the file or use a direct URL.' : 'Reference download needs a local file or a fetchable URL.', 3400);
      return;
    }
    if ((kind === 'take' || kind === 'merged') && !takeBlob) { toast('Record a take first.', 2400); return; }

    exportState.active = true;
    exportState.cancel = false;
    const title = kind === 'ref' ? 'Exporting reference clip…' : kind === 'take' ? 'Exporting take clip…' : 'Exporting merged video…';
    showExport(title);
    updateUI();
    refreshButtons();

    let refObj = null;
    let takeObj = null;
    let ac = null;
    let recorderOut = null;

    try {
      if (kind === 'ref' || kind === 'merged') refObj = await makeVideo(refBlob);
      if (kind === 'take' || kind === 'merged') takeObj = await makeVideo(takeBlob);

      const trimStart = state.refTrim.start;
      const trimLen = trimDuration();
      const takeLen = Math.max(0, state.takeDuration);
      const delay = refStartOffset();

      let canvasW = 0, canvasH = 0;
      let refOut = null, takeOut = null;
      let dur = 0;

      if (kind === 'ref') {
        refOut = outDims(refObj.v.videoWidth || 640, refObj.v.videoHeight || 360, state.refCrop, state.refOutW);
        canvasW = refOut.w; canvasH = refOut.h;
        dur = trimLen;
      } else if (kind === 'take') {
        takeOut = outDims(takeObj.v.videoWidth || 640, takeObj.v.videoHeight || 360, state.camCrop, state.camOutW);
        canvasW = takeOut.w; canvasH = takeOut.h;
        dur = takeLen;
      } else {
        // Merged: both clips share one canvas width so the stack has no side gaps.
        const refSrc = { w: refObj.v.videoWidth || 640, h: refObj.v.videoHeight || 360 };
        const takeSrc = { w: takeObj.v.videoWidth || 640, h: takeObj.v.videoHeight || 360 };
        const refAspect = (state.refCrop.w * refSrc.w) / (state.refCrop.h * refSrc.h);
        const takeAspect = (state.camCrop.w * takeSrc.w) / (state.camCrop.h * takeSrc.h);
        canvasW = Math.max(state.refOutW, state.camOutW);
        refOut = { w: canvasW, h: Math.max(30, Math.round(canvasW / refAspect)) };
        takeOut = { w: canvasW, h: Math.max(30, Math.round(canvasW / takeAspect)) };
        canvasH = refOut.h + state.borderSize + takeOut.h;
        // Merged playback: take from 0, reference joins refDelay seconds later.
        dur = Math.min(takeLen, delay + trimLen);
      }

      if (dur <= 0) throw new Error('Nothing to export — check the trim and take length.');

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      const streamOut = canvas.captureStream(30);
      ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      const attach = (videoObj) => {
        try {
          const src = ac.createMediaElementSource(videoObj.v);
          src.connect(dest);
        } catch {}
        videoObj.v.muted = false;
      };
      if (refObj) attach(refObj);
      if (takeObj) attach(takeObj);

      const combined = new MediaStream([...streamOut.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const mime = pickExportMime();
      recorderOut = new MediaRecorder(combined, mime ? { mimeType: mime, videoBitsPerSecond: 4000000 } : { videoBitsPerSecond: 4000000 });
      const chunks = [];
      recorderOut.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((resolve) => { recorderOut.onstop = resolve; });
      recorderOut.start(250);

      await ac.resume().catch(() => {});

      if (refObj) { try { refObj.v.currentTime = trimStart; } catch {} }
      if (takeObj) { try { takeObj.v.currentTime = 0; } catch {} }

      const dxRef = refOut ? Math.floor((canvasW - refOut.w) / 2) : 0;
      const dxTake = takeOut ? Math.floor((canvasW - takeOut.w) / 2) : 0;

      const drawFrame = () => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasW, canvasH);
        if (kind === 'ref') {
          drawClip(ctx, refObj.v, state.refCrop, refOut, 0, 0);
        } else if (kind === 'take') {
          drawClip(ctx, takeObj.v, state.camCrop, takeOut, 0, 0);
        } else {
          drawClip(ctx, refObj.v, state.refCrop, refOut, dxRef, 0);
          if (state.borderSize > 0) {
            ctx.fillStyle = state.borderColor;
            ctx.fillRect(0, refOut.h, canvasW, state.borderSize);
          }
          drawClip(ctx, takeObj.v, state.camCrop, takeOut, dxTake, refOut.h + state.borderSize);
        }
      };

      stopCameraTracks();

      // Take starts immediately. In the merged export the reference joins
      // refDelay seconds later; single-clip exports are unaffected.
      const playAll = async () => {
        if (takeObj) { try { await takeObj.v.play(); } catch {} }
        if (refObj) {
          const refWait = kind === 'merged' ? Math.max(0, delay) : 0;
          setTimeout(() => {
            if (exportState.cancel) return;
            refObj.v.play().catch(() => {});
          }, refWait * 1000);
        }
      };
      await playAll();

      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          if (exportState.cancel) { resolve(); return; }
          const elapsed = (performance.now() - t0) / 1000;
          drawFrame();
          const frac = clamp(elapsed / dur, 0, 1);
          setExportProgress(frac, `${Math.round(frac * 100)}% — ${fmt(Math.min(elapsed, dur))} of ${fmt(dur)}`);
          if (elapsed >= dur) { resolve(); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      if (refObj) { try { refObj.v.pause(); } catch {} }
      if (takeObj) { try { takeObj.v.pause(); } catch {} }
      try { recorderOut.stop(); } catch {}
      await stopped;

      if (exportState.cancel) {
        toast('Export cancelled.', 2200);
        return;
      }

      const blob = new Blob(chunks, { type: recorderOut.mimeType || mime || 'video/webm' });
      window.__lastExport = { blob, kind, w: canvasW, h: canvasH, dur };
      const ext = (recorderOut.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const name = kind === 'merged' ? `merged-${stamp}.${ext}` : kind === 'ref' ? `reference-${stamp}.${ext}` : `take-${stamp}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Saved ${name} — ${canvasW}×${canvasH}, ${fmt(dur)}`, 3200);
    } catch (e) {
      toast('Export failed: ' + (e && e.message ? e.message : e), 4000);
    } finally {
      exportState.active = false;
      hideExport();
      if (refObj) { URL.revokeObjectURL(refObj.url); refObj.v.remove(); }
      if (takeObj) { URL.revokeObjectURL(takeObj.url); takeObj.v.remove(); }
      if (ac) { try { await ac.close(); } catch {} }
      updateUI();
      refreshButtons();
      reopenCameraAfterPlayback();
    }
  }

  /* ═══════════════════ init / wiring ═══════════════════ */
  function selectTab(which) {
    tabUpload.setAttribute('aria-selected', which === 'upload');
    tabUrl.setAttribute('aria-selected', which === 'url');
    paneUpload.classList.toggle('is-active', which === 'upload');
    paneUrl.classList.toggle('is-active', which === 'url');
    if (which === 'url') setTimeout(() => urlInput.focus(), 30);
  }

  // Crop inputs are interdependent. Rather than silently clamping a slider the
  // user just moved, adjust the dependent value so the intent is preserved:
  // moving Left shrinks Width (right edge stays put); widening Width pulls Left back.
  function cropFromInputs(prefix, prev) {
    const rawX = Number($(`${prefix}-left`).value) / 100;
    const rawY = Number($(`${prefix}-top`).value) / 100;
    const rawW = Number($(`${prefix}-width`).value) / 100;
    const rawH = Number($(`${prefix}-height`).value) / 100;

    let x = prev.x, y = prev.y, w = prev.w, h = prev.h;

    // determine which slider changed by comparing raw values with previous
    const changedLeft = Math.abs(rawX - prev.x) > 1e-6;
    const changedTop = Math.abs(rawY - prev.y) > 1e-6;
    const changedW = Math.abs(rawW - prev.w) > 1e-6;
    const changedH = Math.abs(rawH - prev.h) > 1e-6;

    if (changedLeft || changedW) {
      x = clamp(rawX, 0, 1);
      w = clamp(rawW, 0.1, 1);
      if (changedLeft) w = Math.min(w, 1 - x);   // shrinking width keeps the crop inside
      else x = Math.min(x, 1 - w);              // widening pulls left back
    }
    if (changedTop || changedH) {
      y = clamp(rawY, 0, 1);
      h = clamp(rawH, 0.1, 1);
      if (changedTop) h = Math.min(h, 1 - y);
      else y = Math.min(y, 1 - h);
    }
    w = clamp(w, 0.1, 1);
    h = clamp(h, 0.1, 1);
    x = clamp(x, 0, 1 - w);
    y = clamp(y, 0, 1 - h);
    return { x, y, w, h };
  }

  function writeCropInputs(prefix, crop) {
    $(`${prefix}-left`).value = String(Math.round(crop.x * 100));
    $(`${prefix}-top`).value = String(Math.round(crop.y * 100));
    $(`${prefix}-width`).value = String(Math.round(crop.w * 100));
    $(`${prefix}-height`).value = String(Math.round(crop.h * 100));
    $(`${prefix}-left-label`).textContent = `${Math.round(crop.x * 100)}%`;
    $(`${prefix}-top-label`).textContent = `${Math.round(crop.y * 100)}%`;
    $(`${prefix}-width-label`).textContent = `${Math.round(crop.w * 100)}%`;
    $(`${prefix}-height-label`).textContent = `${Math.round(crop.h * 100)}%`;
  }

  function bindCrop(prefix, key, updateFn) {
    [`${prefix}-left`, `${prefix}-top`, `${prefix}-width`, `${prefix}-height`].forEach(id => {
      $(id).addEventListener('input', () => {
        const crop = cropFromInputs(prefix, state[key]);
        state[key] = crop;
        writeCropInputs(prefix, crop);
        updateFn();
        updateUI();
        savePrefsDebounced();
      });
    });
    const resetId = prefix === 'crop' ? 'btn-crop-reset' : 'btn-tcrop-reset';
    $(resetId).addEventListener('click', () => {
      const full = { x: 0, y: 0, w: 1, h: 1 };
      state[key] = full;
      writeCropInputs(prefix, full);
      updateFn();
      updateUI();
      savePrefsDebounced();
    });
  }

  function init() {
    tabUpload.addEventListener('click', () => selectTab('upload'));
    tabUrl.addEventListener('click', () => selectTab('url'));
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener('change', () => { const f = fileInput.files && fileInput.files[0]; if (f) loadFileReference(f); });

    [refCell, refLayer].forEach(el => {
      ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
      ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
      el.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) loadFileReference(f);
      });
    });

    btnLoadUrl.addEventListener('click', () => loadUrl(urlInput.value));
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadUrl(urlInput.value); } });

    trimStartEl.addEventListener('input', () => {
      const dur = state.refReady ? state.ref.duration : 0;
      const end = clamp(state.refTrim.end, 0, dur);
      const start = clamp(Number(trimStartEl.value), 0, Math.max(0, end - 0.1));
      state.refTrim.start = start;
      trimStartEl.value = String(start);
      stopAllPlayback();
      updateTrimUI();
      savePrefsDebounced();
    });
    trimEndEl.addEventListener('input', () => {
      const dur = state.refReady ? state.ref.duration : 0;
      const start = clamp(state.refTrim.start, 0, dur);
      const end = clamp(Number(trimEndEl.value), Math.min(start + 0.1, dur), dur);
      state.refTrim.end = end;
      trimEndEl.value = String(end);
      stopAllPlayback();
      updateTrimUI();
      savePrefsDebounced();
    });
    btnTrimReset.addEventListener('click', () => {
      if (!state.refReady) return;
      state.refTrim = { start: 0, end: state.ref.duration };
      trimStartEl.value = '0';
      trimEndEl.value = String(state.ref.duration);
      stopAllPlayback();
      updateTrimUI();
      savePrefsDebounced();
    });

    bindCrop('crop', 'refCrop', updateRefLayout);
    bindCrop('tcrop', 'camCrop', updateTakeLayout);

    // crop rectangle drawing on the stages
    installCropDragger('ref', refCropOverlay, refCropBox, refCropBoxLabel, updateRefLayout);
    installCropDragger('take', takeCropOverlay, takeCropBox, takeCropBoxLabel, updateTakeLayout);

    btnCropDraw.addEventListener('click', () => {
      cropDrawMode.ref = !cropDrawMode.ref;
      btnCropDraw.textContent = cropDrawMode.ref ? 'Stop drawing' : 'Draw crop';
      btnCropDraw.classList.toggle('primary', cropDrawMode.ref);
      refreshCropOverlays();
      updateUI();
      toast(cropDrawMode.ref ? 'Drag on the reference to select the crop rectangle.' : 'Crop drawing off.', 2000);
    });
    btnTcropDraw.addEventListener('click', () => {
      cropDrawMode.take = !cropDrawMode.take;
      btnTcropDraw.textContent = cropDrawMode.take ? 'Stop drawing' : 'Draw crop';
      btnTcropDraw.classList.toggle('primary', cropDrawMode.take);
      refreshCropOverlays();
      updateUI();
      toast(cropDrawMode.take ? 'Drag on the take to select the crop rectangle.' : 'Crop drawing off.', 2000);
    });

    refWidthEl.addEventListener('input', () => {
      state.refOutW = Number(refWidthEl.value);
      refWidthLabel.textContent = `${state.refOutW} px`;
      updateRefLayout();
      updateUI();
      savePrefsDebounced();
    });
    takeWidthEl.addEventListener('input', () => {
      state.camOutW = Number(takeWidthEl.value);
      takeWidthLabel.textContent = `${state.camOutW} px`;
      updateTakeLayout();
      updateUI();
      savePrefsDebounced();
    });

    btnRefPlay.addEventListener('click', toggleRefPreview);
    refProgress.addEventListener('input', () => {
      const frac = Number(refProgress.value) / 1000;
      const dur = trimDuration();
      const t = state.refTrim.start + frac * dur;
      seekReference(t);
      refProgress.style.setProperty('--fill', `${frac * 100}%`);
      refProgressTime.textContent = fmt(t);
    });
    btnRefMute.addEventListener('click', () => {
      state.mutedRef = !state.mutedRef;
      syncRefAudio();
      savePrefsDebounced();
    });
    btnRefLoop.addEventListener('click', () => {
      state.loopRef = !state.loopRef;
      btnRefLoop.classList.toggle('primary', state.loopRef);
      toast(state.loopRef ? 'Reference will loop' : 'Loop off', 1400);
      savePrefsDebounced();
    });

    btnCamEnable.addEventListener('click', async () => {
      const ok = await openCamera();
      updateUI();
      refreshButtons();
      if (!ok) toast('Camera unavailable.', 2400);
    });
    btnEnableCam.addEventListener('click', async () => {
      const ok = await openCamera();
      updateUI();
      refreshButtons();
      if (!ok) toast('Camera unavailable.', 2400);
    });
    btnMirror.addEventListener('click', () => {
      state.mirrorPreview = !state.mirrorPreview;
      applyMirror();
      updateTakeLayout();
      updateUI();
      savePrefsDebounced();
    });

    btnRecord.addEventListener('click', async () => {
      if (!state.refReady) { toast('Load a reference clip first.', 2400); return; }
      if (!state.camStream) {
        const ok = await openCamera();
        if (!ok) { toast('Enable the camera first.', 2400); return; }
      }
      if (state.takeBlob) {
        clearTake();
        updateUI();
      }
      startRecording();
    });
    btnStop.addEventListener('click', stopRecording);
    btnRetake.addEventListener('click', () => discardModal.classList.add('is-on'));
    btnDiscardCancel.addEventListener('click', () => discardModal.classList.remove('is-on'));
    btnDiscardConfirm.addEventListener('click', () => {
      discardModal.classList.remove('is-on');
      clearTake();
      updateUI();
      refreshButtons();
      toast('Ready for a new take.', 1600);
    });
    discardModal.addEventListener('click', (e) => { if (e.target === discardModal) discardModal.classList.remove('is-on'); });

    btnTakePlay.addEventListener('click', toggleTakePlay);
    btnTakeCenter.addEventListener('click', () => { if (state.takeBlob) toggleTakePlay(); });
    takeProgress.addEventListener('input', () => {
      if (!state.takeBlob) return;
      const frac = Number(takeProgress.value) / 1000;
      const dur = Math.max(0, state.takeDuration);
      const t = frac * dur;
      try { takeVideo.currentTime = t; } catch {}
      takeProgress.style.setProperty('--fill', `${frac * 100}%`);
      takeProgressTime.textContent = fmt(t);
    });

    btnReview.addEventListener('click', toggleReview);
    reviewProgress.addEventListener('input', () => {
      seekReview(Number(reviewProgress.value) / 1000);
    });

    borderSizeEl.addEventListener('input', () => {
      state.borderSize = Number(borderSizeEl.value);
      borderSizeLabel.textContent = `${state.borderSize} px`;
      updateDivider();
      updateUI();
      savePrefsDebounced();
    });
    borderColorEl.addEventListener('input', () => {
      state.borderColor = borderColorEl.value;
      updateDivider();
      savePrefsDebounced();
    });

    delayEl.addEventListener('input', () => {
      state.refDelay = clamp(Math.round(Number(delayEl.value) * 10) / 10, 0, 3);
      delayEl.value = String(state.refDelay);
      delayLabel.textContent = `${state.refDelay.toFixed(1)} s`;
      updateTrimUI();
      updateUI();
      savePrefsDebounced();
    });
    btnDelayReset.addEventListener('click', () => {
      state.refDelay = 0.5;
      delayEl.value = '0.5';
      delayLabel.textContent = '0.5 s';
      updateTrimUI();
      updateUI();
      savePrefsDebounced();
      toast('Reference delay reset to 0.5 s.', 1600);
    });

    btnDownloadRef.addEventListener('click', () => exportVideo('ref'));
    btnDownloadTake.addEventListener('click', () => exportVideo('take'));
    btnExportMerged.addEventListener('click', () => exportVideo('merged'));
    btnExportCancel.addEventListener('click', () => { exportState.cancel = true; });

    btnReset.addEventListener('click', () => {
      stopAllPlayback();
      clearReferenceMedia();
      state.ref = null;
      resetRefState();
      state.refTrim = { start: 0, end: 0 };
      state.refCrop = { x: 0, y: 0, w: 1, h: 1 };
      state.camCrop = { x: 0, y: 0, w: 1, h: 1 };
      state.refOutW = 720;
      state.camOutW = 720;
      state.borderSize = 8;
      state.borderColor = '#ffffff';
      borderSizeEl.value = '8';
      borderColorEl.value = '#ffffff';
      refWidthEl.value = '720';
      takeWidthEl.value = '720';
      refWidthLabel.textContent = '720 px';
      takeWidthLabel.textContent = '720 px';
      refOutHeightEl.textContent = '405 px';
      takeOutHeightEl.textContent = '540 px';
      state.refDelay = 0.5;
      delayEl.value = '0.5';
      delayLabel.textContent = '0.5 s';
      writeCropInputs('crop', state.refCrop);
      writeCropInputs('tcrop', state.camCrop);
      cropDrawMode.ref = false;
      cropDrawMode.take = false;
      btnCropDraw.textContent = 'Draw crop';
      btnTcropDraw.textContent = 'Draw crop';
      btnCropDraw.classList.remove('primary');
      btnTcropDraw.classList.remove('primary');
      updateTrimUI();
      updateDivider();
      updateUI();
      refreshButtons();
      savePrefsDebounced();
      toast('Session reset.', 1600);
    });

    // Restore saved preferences before the first paint.
    const saved = readPrefs();
    if (saved) {
      applyPrefs(saved);
      btnRefLoop.classList.toggle('primary', !!state.loopRef);
      delayLabel.textContent = `${state.refDelay.toFixed(1)} s`;
      borderSizeLabel.textContent = `${state.borderSize} px`;
      borderColorLabel.textContent = state.borderColor;
      toast('Restored your saved settings.', 2000);
    } else {
      delayLabel.textContent = `${state.refDelay.toFixed(1)} s`;
    }

    updateTrimUI();
    updateDivider();
    updateUI();
    refreshButtons();
    applyMirror();
    updateRefLayout();
    updateTakeLayout();
    refreshCropOverlays();
    enumerateCameras();
    openCamera(true).then(() => updateUI()).catch(() => {});
    updateMuteButton();
    updateRefPlayLabel();
  }

  function stopAllPlayback() {
    pauseReference();
    if (state.takePlaying) stopTakePlay();
    if (state.playing) stopReview();
    state.takePlaying = false;
    state.playing = false;
    state.mode = 'idle';
    updateUI();
    refreshButtons();
  }

  init();
})();
