/* Drishti - AI audio guide for the visually impaired
 * Object detection (COCO-SSD) + optional custom Teachable Machine model (currency notes). */
(function () {
  'use strict';

  /* =====================================================================
   * CONFIG - the only part you normally need to edit
   * ===================================================================== */
  var CONFIG = {
    // 1) Put the files exported from Teachable Machine (model.json, metadata.json, weights.bin)
    //    in a folder called "model" next to index.html. It loads automatically on every device.
    LOCAL_MODEL_DIR: './model/',

    // 2) Optional fallback: the shareable link from "Upload my model", for example
    //    'https://teachablemachine.withgoogle.com/models/XXXXXXX/'. Leave '' if you use the model folder.
    REMOTE_MODEL_URL: '',

    CUSTOM_THRESHOLD: 0.85,      // custom model must be at least this sure (0 to 1)
    CUSTOM_CONFIRMATIONS: 2,     // same answer this many checks in a row before it is spoken
    CUSTOM_COOLDOWN_MS: 6000,    // do not repeat the same label for this long
    IGNORE_LABELS: /background|none|nothing|other|empty/i,

    // What to speak for each class name from your model, if you want it different.
    // Example: { 'Ten': '10 rupee note', '500': '500 rupee note' }
    LABEL_SPEECH: {
      en: {},
      hi: {}
    },

    DETECT_INTERVAL_MS: 350,     // time between detections
    MIN_SCORE: 0.55,             // object detection confidence
    CONFIRM_FRAMES: 2,           // object must be seen this many cycles in a row before it is announced
    FOCAL_FACTOR: 0.866,         // focalPx = FOCAL_FACTOR * videoHeight (about 60 degree vertical view)
    DANGER_M: 1.3,               // closer than this straight ahead => urgent warning
    GUIDE_M: 1.8                 // object straight ahead closer than this => movement guidance
  };

  /* Approximate real heights in cm, used for the distance estimate */
  var REAL_HEIGHT_CM = {
    'person':165,'bicycle':100,'car':150,'motorcycle':110,'bus':300,'truck':300,'train':350,
    'traffic light':80,'fire hydrant':60,'stop sign':75,'bench':45,'bird':20,'cat':25,'dog':50,
    'horse':160,'sheep':80,'cow':140,'backpack':45,'umbrella':90,'handbag':30,'suitcase':60,
    'bottle':25,'cup':10,'bowl':8,'chair':90,'couch':85,'potted plant':40,'bed':55,
    'dining table':75,'toilet':40,'tv':50,'laptop':25,'cell phone':15,'book':22,'clock':30,
    'refrigerator':170,'sink':30,'oven':60,'microwave':30,'vase':25,'scissors':18,'keyboard':4,'mouse':4
  };

  var HI_NAMES = {
    'person':'व्यक्ति','bicycle':'साइकिल','car':'कार','motorcycle':'मोटरसाइकिल','bus':'बस','truck':'ट्रक',
    'traffic light':'ट्रैफिक लाइट','fire hydrant':'हाइड्रेंट','stop sign':'स्टॉप साइन','bench':'बेंच',
    'bird':'पक्षी','cat':'बिल्ली','dog':'कुत्ता','horse':'घोड़ा','sheep':'भेड़','cow':'गाय',
    'backpack':'बैग','umbrella':'छाता','handbag':'हैंडबैग','suitcase':'सूटकेस','bottle':'बोतल','cup':'कप',
    'bowl':'कटोरा','chair':'कुर्सी','couch':'सोफा','potted plant':'गमले का पौधा','bed':'बिस्तर',
    'dining table':'मेज़','toilet':'शौचालय','tv':'टीवी','laptop':'लैपटॉप','cell phone':'मोबाइल',
    'book':'किताब','clock':'घड़ी','refrigerator':'फ्रिज','sink':'सिंक','oven':'ओवन','microwave':'माइक्रोवेव',
    'vase':'फूलदान','scissors':'कैंची','keyboard':'कीबोर्ड','mouse':'माउस'
  };

  var LANGS = {
    en: {
      tts: 'en-IN', label: 'English',
      dir: { left: 'on your left', ahead: 'straight ahead', right: 'on your right' },
      dirShort: { left: 'left', ahead: 'ahead', right: 'right' },
      side: { left: 'left', right: 'right' },
      loading: 'Loading the vision model. Please wait.',
      started: 'Camera is on. I will tell you what is around you, in which direction and how far. Tap the camera view anytime to hear a full description.',
      clear: 'Path looks clear.',
      nothing: 'I cannot see any objects right now.',
      seeing: 'I can see: ',
      stopped: 'Camera stopped.',
      camError: 'I could not open the camera. Please allow camera permission and try again.',
      langSet: 'Language set to English.',
      veryClose: 'very close',
      about: function (m) { return 'about ' + m + (m === 1 ? ' meter' : ' meters'); },
      far: 'more than 8 meters away',
      stopMsg: function (n, d) { return 'Stop. ' + n + ' straight ahead, ' + d + '. Obstacles on both sides. Turn slowly.'; },
      moveMsg: function (n, d, s) { return 'Careful. ' + n + ' straight ahead, ' + d + '. Move slightly ' + s + '.'; },
      objMsg: function (n, dr, d) { return n + ' ' + dr + ', ' + d; },
      tmMsg: function (l) { return l; }
    },
    hi: {
      tts: 'hi-IN', label: 'हिन्दी',
      dir: { left: 'बाएँ तरफ', ahead: 'सामने', right: 'दाएँ तरफ' },
      dirShort: { left: 'बाएँ', ahead: 'सामने', right: 'दाएँ' },
      side: { left: 'बाएँ', right: 'दाएँ' },
      loading: 'मॉडल लोड हो रहा है। कृपया प्रतीक्षा करें।',
      started: 'कैमरा चालू है। मैं बताऊँगा कि आपके आसपास क्या है, किस दिशा में और कितनी दूर। पूरा विवरण सुनने के लिए कैमरा व्यू पर कहीं भी टैप करें।',
      clear: 'रास्ता साफ़ लग रहा है।',
      nothing: 'अभी मुझे कोई वस्तु नहीं दिख रही।',
      seeing: 'मुझे दिख रहा है: ',
      stopped: 'कैमरा बंद हो गया।',
      camError: 'कैमरा नहीं खुल सका। कृपया कैमरे की अनुमति दें और फिर कोशिश करें।',
      langSet: 'भाषा हिन्दी कर दी गई है।',
      veryClose: 'बहुत पास',
      about: function (m) { return 'लगभग ' + m + ' मीटर दूर'; },
      far: '8 मीटर से ज़्यादा दूर',
      stopMsg: function (n, d) { return 'रुकिए। ' + n + ' सामने, ' + d + '। दोनों तरफ रुकावट है। धीरे से मुड़िए।'; },
      moveMsg: function (n, d, s) { return 'सावधान। ' + n + ' सामने, ' + d + '। थोड़ा ' + s + ' हटिए।'; },
      objMsg: function (n, dr, d) { return n + ' ' + dr + ', ' + d; },
      tmMsg: function (l) { return l; }
    }
  };

  /* =====================================================================
   * Elements & state
   * ===================================================================== */
  var $ = function (id) { return document.getElementById(id); };
  var video = $('video'), overlay = $('overlay'), ctx = overlay.getContext('2d');
  var captionEl = $('caption'), statusEl = $('status'), placeholder = $('placeholder');
  var hud = $('hud'), hudObject = $('hudObject'), hudCustom = $('hudCustom'), logEl = $('log');
  var startBtn = $('startBtn'), stopBtn = $('stopBtn'), describeBtn = $('describeBtn'), langBtn = $('langBtn');

  var state = {
    running: false, starting: false, lang: 'en', stream: null, timer: null,
    visionPromise: null, vision: null,
    objs: [], last: {}, wakeLock: null, tick: 0,
    seen: {}, smooth: {},
    tm: null,                       // { model, labels }
    tmStreak: { label: '', count: 0 },
    settings: { rate: 1, boxes: true, custom: true, facing: 'environment' }
  };
  var T = function () { return LANGS[state.lang]; };

  /* ---------- small helpers ---------- */
  function setChip(id, text, cls) {
    var el = $(id);
    el.textContent = text;
    el.className = 'chip' + (cls ? ' ' + cls : '');
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function setStatus(t) { statusEl.textContent = t; }

  /* =====================================================================
   * Settings
   * ===================================================================== */
  function loadSettings() {
    try {
      var s = JSON.parse(lsGet('drishti.settings') || '{}');
      for (var k in s) if (k in state.settings) state.settings[k] = s[k];
    } catch (e) {}
    $('rate').value = state.settings.rate;
    $('rateOut').textContent = Number(state.settings.rate).toFixed(1) + 'x';
    $('facing').value = state.settings.facing;
    $('optBoxes').checked = !!state.settings.boxes;
    $('optCustom').checked = !!state.settings.custom;
  }
  function saveSettings() { lsSet('drishti.settings', JSON.stringify(state.settings)); }

  /* =====================================================================
   * Speech, captions, activity log
   * ===================================================================== */
  var voices = [];
  function loadVoices() { if ('speechSynthesis' in window) voices = window.speechSynthesis.getVoices() || []; }
  loadVoices();
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices;

  function pickVoice(lang) {
    var base = lang.split('-')[0].toLowerCase();
    var exact = voices.filter(function (v) { return v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase(); });
    if (exact.length) return exact[0];
    var partial = voices.filter(function (v) { return v.lang.toLowerCase().indexOf(base) === 0; });
    return partial.length ? partial[0] : null;
  }

  function showCaption(text, urgent) {
    captionEl.textContent = text;
    captionEl.classList.toggle('urgent', !!urgent);
  }

  function addLog(text, urgent) {
    var empty = logEl.querySelector('.log-empty');
    if (empty) empty.remove();
    var li = document.createElement('li');
    if (urgent) li.className = 'urgent';
    var time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    li.appendChild(time);
    li.appendChild(document.createTextNode(text));
    logEl.insertBefore(li, logEl.firstChild);
    while (logEl.children.length > 8) logEl.removeChild(logEl.lastChild);
  }

  /* Returns true if the message was shown/spoken. Non-urgent messages wait while speech is busy. */
  function say(text, urgent) {
    var synth = window.speechSynthesis;
    if (synth) {
      if (urgent) synth.cancel();
      else if (synth.speaking || synth.pending) return false;
    }
    showCaption(text, urgent);
    addLog(text, urgent);
    if (!synth) return true;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = T().tts;
    var v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.rate = Number(state.settings.rate) || 1;
    synth.speak(u);
    return true;
  }

  function due(key, ms) { var t = state.last[key]; return !t || (Date.now() - t) > ms; }
  function mark(key) { state.last[key] = Date.now(); }

  /* =====================================================================
   * Geometry and object logic
   * ===================================================================== */
  function nameOf(cls) { return state.lang === 'hi' ? (HI_NAMES[cls] || cls) : cls; }

  function distText(d) {
    var L = T();
    if (d < 0.8) return L.veryClose;
    if (d > 8) return L.far;
    var m = Math.max(0.5, Math.round(d * 2) / 2);
    return L.about(m);
  }

  function band(d) { return d < 1 ? 'very close' : d < 2.5 ? 'near' : 'far'; }

  function zoneOverlap(x1, x2, zl, zr) {
    return (Math.min(x2, zr) - Math.max(x1, zl)) / (zr - zl) > 0.25;
  }

  /* Turns raw detections into objects with direction, distance and a "stable" flag */
  function analyse(preds, vw, vh) {
    var focal = CONFIG.FOCAL_FACTOR * vh;
    var objs = preds.filter(function (p) { return p.score >= CONFIG.MIN_SCORE; }).map(function (p) {
      var x = p.bbox[0], y = p.bbox[1], w = p.bbox[2], h = p.bbox[3];
      var realH = REAL_HEIGHT_CM[p.class] || 50;
      var d = (realH * focal / Math.max(h, 1)) / 100;
      // An object cut off at the top or bottom looks shorter than it is, so it is closer than estimated.
      if (y <= 4 || (y + h) >= vh - 4) d *= 0.6;
      d = Math.max(0.3, d);
      var cx = (x + w / 2) / vw, x1 = x / vw, x2 = (x + w) / vw;
      return {
        cls: p.class, box: [x, y, w, h], dist: d,
        dir: cx < 0.33 ? 'left' : cx > 0.67 ? 'right' : 'ahead',
        zones: {
          L: zoneOverlap(x1, x2, 0, 0.33),
          C: zoneOverlap(x1, x2, 0.33, 0.67),
          R: zoneOverlap(x1, x2, 0.67, 1)
        }
      };
    });

    // Smooth distances and count consecutive sightings, so flickering detections are not announced.
    var nextSeen = {}, nextSmooth = {};
    objs.forEach(function (o) {
      var key = o.cls + '|' + o.dir;
      var prev = state.smooth[key];
      o.dist = prev ? prev * 0.6 + o.dist * 0.4 : o.dist;
      nextSmooth[key] = o.dist;
      nextSeen[key] = (state.seen[key] || 0) + 1;
      o.stable = nextSeen[key] >= CONFIG.CONFIRM_FRAMES;
    });
    state.seen = nextSeen;
    state.smooth = nextSmooth;

    objs.sort(function (a, b) { return a.dist - b.dist; });
    return objs;
  }

  function phrase(o) {
    var L = T();
    return L.objMsg(nameOf(o.cls), L.dir[o.dir], distText(o.dist));
  }

  /* Should the user stop, or step aside? Uses only stable objects. */
  function guidance(objs) {
    var ahead = objs.filter(function (o) { return o.zones.C && o.dist < CONFIG.GUIDE_M; });
    if (!ahead.length) return null;
    var front = ahead[0];
    function clearance(z) {
      var ds = objs.filter(function (o) { return o.zones[z]; }).map(function (o) { return o.dist; });
      return ds.length ? Math.min.apply(null, ds) : Infinity;
    }
    var left = clearance('L'), right = clearance('R');
    var bestSide = right >= left ? 'right' : 'left';
    if (Math.max(left, right) < 1.5) return { front: front, action: 'stop' };
    return { front: front, action: bestSide };
  }

  function guidanceText(g) {
    var L = T(), n = nameOf(g.front.cls), d = distText(g.front.dist);
    return g.action === 'stop' ? L.stopMsg(n, d) : L.moveMsg(n, d, L.side[g.action]);
  }

  function announce(stable) {
    var g = guidance(stable);
    if (g) {
      var key = 'g:' + g.front.cls + g.action;
      if (due(key, 4000) && say(guidanceText(g), g.front.dist < CONFIG.DANGER_M)) mark(key);
      return; // an obstacle ahead takes priority over everything else
    }
    var nearby = stable.filter(function (o) { return o.dist < 4; }).slice(0, 2);
    for (var i = 0; i < nearby.length; i++) {
      var o = nearby[i], k = 'o:' + o.cls + o.dir + band(o.dist);
      if (due(k, 9000)) { if (say(phrase(o), false)) mark(k); return; }
    }
    if (!nearby.length && due('clear', 12000)) {
      if (say(T().clear, false)) mark('clear');
    }
  }

  function describeNow() {
    var L = T(), stable = state.objs.filter(function (o) { return o.stable; });
    if (!stable.length) { say(L.nothing, true); return; }
    var text = L.seeing + stable.slice(0, 5).map(phrase).join('. ') + '.';
    var g = guidance(stable);
    if (g) text += ' ' + guidanceText(g);
    say(text, true);
  }

  /* =====================================================================
   * Drawing and HUD
   * ===================================================================== */
  function draw(objs, vw, vh) {
    if (overlay.width !== vw || overlay.height !== vh) { overlay.width = vw; overlay.height = vh; }
    ctx.clearRect(0, 0, vw, vh);
    if (!state.settings.boxes) return;
    var fontPx = Math.max(16, Math.round(vw / 28));
    ctx.lineWidth = Math.max(3, vw / 200);
    ctx.font = 'bold ' + fontPx + 'px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    objs.forEach(function (o) {
      var b = band(o.dist);
      var color = b === 'very close' ? '#ff5252' : b === 'near' ? '#ffd400' : '#3ddc84';
      ctx.strokeStyle = color;
      ctx.strokeRect(o.box[0], o.box[1], o.box[2], o.box[3]);
      var label = o.cls + ' ' + o.dist.toFixed(1) + 'm';
      var tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = color;
      ctx.fillRect(o.box[0], o.box[1], tw, fontPx + 8);
      ctx.fillStyle = '#000';
      ctx.fillText(label, o.box[0] + 5, o.box[1] + 4);
    });
  }

  function updateHud(stable) {
    hud.hidden = false;
    var n = stable[0];
    if (!n) { hudObject.textContent = ''; hudObject.className = 'hud-line'; return; }
    var cls = band(n.dist) === 'very close' ? 'vclose' : band(n.dist) === 'near' ? 'near' : 'far';
    hudObject.className = 'hud-line ' + cls;
    hudObject.textContent = nameOf(n.cls) + ' · ' + T().dirShort[n.dir] + ' · ' + n.dist.toFixed(1) + ' m';
  }

  /* =====================================================================
   * Custom model (Teachable Machine): currency notes etc.
   * ===================================================================== */
  async function loadCustomFrom(base) {
    if (base.charAt(base.length - 1) !== '/') base += '/';
    var metaRes = await fetch(base + 'metadata.json', { cache: 'no-cache' });
    if (!metaRes.ok) throw new Error('metadata.json not found at ' + base);
    var meta = await metaRes.json();
    var model = await tf.loadLayersModel(base + 'model.json');
    return { model: model, labels: meta.labels || [] };
  }

  async function autoLoadCustom() {
    setChip('chipCustom', 'Currency model: loading', 'warn');
    var sources = [CONFIG.LOCAL_MODEL_DIR, CONFIG.REMOTE_MODEL_URL];
    for (var i = 0; i < sources.length; i++) {
      if (!sources[i]) continue;
      try {
        state.tm = await loadCustomFrom(sources[i]);
        setChip('chipCustom', 'Currency model: ready', 'ok');
        console.log('Custom model loaded from', sources[i], state.tm.labels);
        return true;
      } catch (e) { console.warn('Custom model not available from', sources[i], e); }
    }
    state.tm = null;
    setChip('chipCustom', 'Currency model: not found', 'bad');
    return false;
  }

  function speakLabel(label) {
    var map = CONFIG.LABEL_SPEECH[state.lang] || {};
    return map[label] || label;
  }

  async function classifyCustom() {
    if (!state.tm || !state.settings.custom) { hudCustom.textContent = ''; return; }
    var out = tf.tidy(function () {
      var img = tf.browser.fromPixels(video);
      var h = img.shape[0], w = img.shape[1], s = Math.min(h, w);
      img = img.slice([Math.floor((h - s) / 2), Math.floor((w - s) / 2), 0], [s, s, 3]);
      img = tf.image.resizeBilinear(img, [224, 224]).toFloat().div(127.5).sub(1).expandDims(0);
      return state.tm.model.predict(img);
    });
    var data = await out.data();
    out.dispose();
    var best = 0;
    for (var i = 1; i < data.length; i++) if (data[i] > data[best]) best = i;
    var label = state.tm.labels[best], p = data[best];

    if (!label || CONFIG.IGNORE_LABELS.test(label) || p < 0.6) {
      hudCustom.textContent = '';
      state.tmStreak = { label: '', count: 0 };
      return;
    }
    hudCustom.textContent = speakLabel(label) + ' (' + Math.round(p * 100) + '%)';

    if (p < CONFIG.CUSTOM_THRESHOLD) { state.tmStreak = { label: '', count: 0 }; return; }
    state.tmStreak = (state.tmStreak.label === label)
      ? { label: label, count: state.tmStreak.count + 1 }
      : { label: label, count: 1 };

    if (state.tmStreak.count >= CONFIG.CUSTOM_CONFIRMATIONS) {
      var key = 'tm:' + label;
      if (due(key, CONFIG.CUSTOM_COOLDOWN_MS) && say(T().tmMsg(speakLabel(label)), false)) mark(key);
    }
  }

  /* =====================================================================
   * Vision model + main loop
   * ===================================================================== */
  function getVision() {
    if (!state.visionPromise) {
      setChip('chipVision', 'Vision: loading', 'warn');
      state.visionPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(function (m) {
        state.vision = m;
        setChip('chipVision', 'Vision: ready', 'ok');
        return m;
      }).catch(function (e) {
        state.visionPromise = null;
        setChip('chipVision', 'Vision: failed', 'bad');
        throw e;
      });
    }
    return state.visionPromise;
  }

  async function detectOnce() {
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    var preds = await state.vision.detect(video, 12);
    var objs = analyse(preds, vw, vh);
    state.objs = objs;
    var stable = objs.filter(function (o) { return o.stable; });
    draw(objs, vw, vh);
    updateHud(stable);
    announce(stable);
    state.tick++;
    if (state.tick % 3 === 0) await classifyCustom();
  }

  async function loop() {
    if (!state.running) return;
    var t0 = performance.now();
    try { await detectOnce(); } catch (e) { console.error(e); }
    var wait = Math.max(0, CONFIG.DETECT_INTERVAL_MS - (performance.now() - t0));
    state.timer = setTimeout(loop, wait);
  }

  /* =====================================================================
   * Start / stop
   * ===================================================================== */
  async function start() {
    if (state.running || state.starting) return;
    state.starting = true;
    startBtn.disabled = true;
    say(T().loading, true); // inside a tap, so this also unlocks speech on iOS
    setStatus('Starting camera...');
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: state.settings.facing }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
    } catch (err) {
      console.error(err);
      say(T().camError, true);
      setStatus('Camera unavailable. This page needs HTTPS and camera permission.');
      setChip('chipCam', 'Camera: blocked', 'bad');
      startBtn.disabled = false;
      state.starting = false;
      return;
    }
    video.srcObject = state.stream;
    try { await video.play(); } catch (e) {}
    placeholder.style.display = 'none';
    setChip('chipCam', 'Camera: on', 'ok');

    try { await getVision(); }
    catch (err) {
      console.error(err);
      setStatus('Could not load the vision model. Check your internet connection and try again.');
      state.starting = false;
      stop(true);
      return;
    }
    try { if ('wakeLock' in navigator) state.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}

    state.running = true;
    state.starting = false;
    state.last = {}; state.seen = {}; state.smooth = {};
    stopBtn.disabled = false;
    describeBtn.disabled = false;
    setStatus('Running. Tap the camera view or press Describe for a full description.');
    say(T().started, true);
    loop();
  }

  function stop(silent) {
    state.running = false;
    clearTimeout(state.timer);
    if (state.stream) { state.stream.getTracks().forEach(function (t) { t.stop(); }); state.stream = null; }
    if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} state.wakeLock = null; }
    video.srcObject = null;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    hud.hidden = true; hudObject.textContent = ''; hudCustom.textContent = '';
    placeholder.style.display = 'flex';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    describeBtn.disabled = true;
    setChip('chipCam', 'Camera: off', '');
    state.objs = [];
    if (!silent) { say(T().stopped, true); setStatus('Stopped.'); }
  }

  function toggleLang() {
    state.lang = state.lang === 'en' ? 'hi' : 'en';
    langBtn.textContent = T().label;
    document.documentElement.lang = state.lang;
    state.last = {};
    say(T().langSet, true);
  }

  /* =====================================================================
   * Wire up
   * ===================================================================== */
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', function () { stop(false); });
  describeBtn.addEventListener('click', describeNow);
  langBtn.addEventListener('click', toggleLang);
  $('stage').addEventListener('click', function () { if (state.running) describeNow(); });

  $('rate').addEventListener('input', function (e) {
    state.settings.rate = Number(e.target.value);
    $('rateOut').textContent = state.settings.rate.toFixed(1) + 'x';
    saveSettings();
  });
  $('optBoxes').addEventListener('change', function (e) { state.settings.boxes = e.target.checked; saveSettings(); });
  $('optCustom').addEventListener('change', function (e) {
    state.settings.custom = e.target.checked;
    if (!e.target.checked) hudCustom.textContent = '';
    saveSettings();
  });
  $('facing').addEventListener('change', async function (e) {
    state.settings.facing = e.target.value;
    saveSettings();
    if (state.running) { stop(true); await start(); }
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT') return;
    if ((e.key === 'd' || e.key === 'D') && state.running) describeNow();
    if (e.target && e.target.id === 'stage' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (state.running) describeNow();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.running) stop(true);
  });

  /* ---------- Boot: load models in the background so Start is fast ---------- */
  loadSettings();
  setStatus('Loading models in the background...');
  getVision().then(function () { setStatus('Ready. Press Start.'); })
             .catch(function () { setStatus('Could not load the vision model. Check your internet connection.'); });
  autoLoadCustom();
})();
