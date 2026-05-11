// State
let apiKey = localStorage.getItem('or_key') || '';
let imgB64 = null;
let imgMode = 'frame';
let style = 'none';
let hist = JSON.parse(localStorage.getItem('sd_hist') || '[]');
let pollTimer = null;

const STYLES = {
  none: { hint: '', sfx: '' },
  sp:   { hint: '🏔️ South Park mode — crude 2D paper-cutout cartoon style added to prompt', sfx: '. Style: South Park animated show, crude paper cutout 2D animation, flat bold colors, simple geometric shapes, Comedy Central aesthetic, thick black outlines, intentionally low-budget cartoon look.' },
  anime:{ hint: '⛩️ Anime mode active', sfx: '. Style: Japanese anime, cel-shaded, vibrant colors, Studio Ghibli or Makoto Shinkai inspired, dynamic motion.' },
  film: { hint: '🎥 Cinematic mode active', sfx: '. Style: cinematic film, anamorphic lens flare, shallow depth of field, dramatic lighting, IMAX movie quality.' },
  pixar:{ hint: '🎈 Pixar 3D mode active', sfx: '. Style: Pixar CGI animation, warm soft lighting, expressive 3D characters, Disney Pixar movie quality.' }
};

// Init
if (apiKey) hide('modal');
renderHist();

// Audio toggle UI
document.getElementById('audio-toggle').addEventListener('change', function() {
  const knob = document.getElementById('audio-knob');
  const track = this.nextElementSibling;
  if (this.checked) {
    knob.style.transform = 'translateX(16px)';
    knob.style.backgroundColor = 'var(--ok)';
    track.style.borderColor = 'var(--ok)';
    toast('Audio enabled (Expect higher failure rate)', '');
  } else {
    knob.style.transform = 'translateX(0)';
    knob.style.backgroundColor = 'var(--mu)';
    track.style.borderColor = 'var(--bd)';
  }
});

// Key
function saveKey() {
  const v = val('ki').trim();
  if (!v) { toast('Enter your API key', 'err'); return; }
  apiKey = v;
  localStorage.setItem('or_key', v);
  hide('modal');
  toast('Connected!', 'ok');
}
function changeKey() {
  document.getElementById('ki').value = apiKey;
  show('modal');
}
document.getElementById('ki').addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });

// Style
function setStyle(k) {
  style = k;
  document.querySelectorAll('#sc .chip').forEach(c => {
    c.classList.remove('on', 'sp');
    if (c.dataset.s === k) c.classList.add(k === 'sp' ? 'sp' : 'on');
  });
  const h = document.getElementById('sh');
  const s = STYLES[k];
  if (s && s.hint) { h.textContent = s.hint; h.classList.add('show'); }
  else { h.classList.remove('show'); }
}

// Image mode
function setMode(m) {
  imgMode = m;
  document.getElementById('m-frame').classList.toggle('on', m === 'frame');
  document.getElementById('m-ref').classList.toggle('on', m === 'ref');
  document.getElementById('mhint').textContent = m === 'frame'
    ? 'Video starts from this exact image as the first frame.'
    : 'Image used as character/style reference for consistency.';
  const t = document.getElementById('itag');
  if (t) t.textContent = m === 'frame' ? '🎬 First Frame' : '👤 Char Ref';
}

// Image upload
function dz(e, t) {
  e.preventDefault();
  const z = document.getElementById('uz');
  if (t === 'on') z.classList.add('over');
  else if (t === 'off') z.classList.remove('over');
  else {
    z.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadImg(f);
    else toast('Drop an image file', 'err');
  }
}
function onFile(e) { const f = e.target.files[0]; if (f) loadImg(f); }
function loadImg(f) {
  const r = new FileReader();
  r.onload = e => {
    imgB64 = e.target.result;
    document.getElementById('ip').src = imgB64;
    document.getElementById('iw').style.display = 'block';
    document.getElementById('uz').style.display = 'none';
    toast('Image loaded', 'ok');
  };
  r.readAsDataURL(f);
}
function clrImg() {
  imgB64 = null;
  document.getElementById('ip').src = '';
  document.getElementById('iw').style.display = 'none';
  document.getElementById('uz').style.display = 'block';
  document.getElementById('ifile').value = '';
}

// Generate
async function gen() {
  if (!apiKey) { changeKey(); return; }
  const raw = val('prompt').trim();
  if (!raw) { toast('Enter a prompt', 'err'); return; }

  const prompt = raw + (STYLES[style]?.sfx || '');
  setBusy(true);
  setBadge('b1', 'Generating...');
  showProg('Submitting to OpenRouter...');

  const body = {
    model: val('model'),
    prompt,
    aspect_ratio: val('aspect'),
    resolution: val('res'),
    duration: parseInt(val('dur')),
    generate_audio: document.getElementById('audio-toggle').checked
  };

  if (imgB64) {
    if (imgMode === 'frame') {
      // First frame: object needs type: 'image_url', the image_url object, AND frame_type
      body.frame_images = [{ type: 'image_url', image_url: { url: imgB64 }, frame_type: 'first_frame' }];
    } else {
      // Character reference: type must be "image_url", image in image_url.url
      body.input_references = [{ type: 'image_url', image_url: { url: imgB64 } }];
    }
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'Seedance Studio'
      },
      body: JSON.stringify(body)
    });
    const txt = await r.text();
    console.log('Submit:', txt);
    let d;
    try { d = JSON.parse(txt); } catch(_) { throw new Error('Non-JSON response: ' + txt.slice(0, 120)); }
    if (!r.ok) throw new Error(d?.error?.message || d?.message || 'HTTP ' + r.status);
    const jobId = d.id || d.job_id;
    const statusUrl = d.status_url || null;
    if (!jobId) throw new Error('No job ID returned. Response: ' + JSON.stringify(d));
    toast('Job submitted!', 'ok');
    startPoll(jobId, statusUrl, raw);
  } catch(e) {
    setBusy(false); setBadge('b3', 'Error'); showErr(e.message); toast(e.message, 'err');
  }
}

// Poll
function startPoll(jobId, statusUrl, prompt) {
  let elapsed = 0;
  const ETA = 90;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    elapsed += 5;
    updProg(Math.min(90, 5 + (elapsed / ETA) * 85), `~${Math.max(0, ETA - elapsed)}s left`);
    try {
      const url = statusUrl || `https://openrouter.ai/api/v1/videos/${jobId}`;
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      const txt = await r.text();
      console.log('Poll:', txt);
      let d;
      try { d = JSON.parse(txt); } catch(_) { return; }
      const st = (d.status || '').toLowerCase();
      if (st === 'completed' || st === 'succeeded' || st === 'success') {
        clearInterval(pollTimer);
        const vurl = (d.unsigned_urls && d.unsigned_urls[0])
          || d.video_url || d.url
          || d.data?.[0]?.url || d.output?.url
          || `https://openrouter.ai/api/v1/videos/${jobId}/content`;
        updProg(100, 'Done!');
        setTimeout(() => showVideo(vurl, jobId, prompt), 400);
      } else if (st === 'failed' || st === 'error' || st === 'cancelled') {
        clearInterval(pollTimer);
        setBusy(false); setBadge('b3', 'Failed');
        showErr(d.error || d.message || 'Generation failed');
        toast('Failed', 'err');
      }
    } catch(e) { console.warn('Poll err:', e); }
  }, 5000);
}

// Display
async function showVideo(url, jobId, prompt) {
  setBusy(false); setBadge('b2', 'Complete');
  const pb = document.getElementById('pb');
  pb.innerHTML = '<div class="pw"><div class="spin"></div><div class="pl">Loading video...</div></div>';

  let playUrl = url;
  if (url.includes('/content')) {
    try {
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (r.ok) playUrl = URL.createObjectURL(await r.blob());
    } catch(e) { console.warn('Blob err:', e); }
  }

  pb.innerHTML = `
    <video controls autoplay loop style="width:100%;height:100%;object-fit:contain;border-radius:8px;background:#000">
      <source src="${playUrl}" type="video/mp4"/>
    </video>
    <div class="brow">
      <a class="bdl" href="${playUrl}" download="seedance.mp4" target="_blank">⬇ Download</a>
      <button class="btb" onclick="window.open('${url}','_blank')">↗ Open Tab</button>
    </div>`;

  const entry = { url, prompt, t: Date.now() };
  hist.unshift(entry);
  if (hist.length > 20) hist.pop();
  localStorage.setItem('sd_hist', JSON.stringify(hist));
  renderHist();
  toast('Video ready! 🎬', 'ok');
}

function showProg(lbl) {
  document.getElementById('pb').innerHTML = `
    <div class="pw">
      <div class="spin"></div>
      <div class="pl" id="pl">${lbl}</div>
      <div class="pb"><div class="pbi" id="pbi" style="width:5%"></div></div>
      <div class="pe" id="pe">Hang tight...</div>
    </div>`;
}
function updProg(pct, eta) {
  const b = document.getElementById('pbi'); if (b) b.style.width = pct + '%';
  const e = document.getElementById('pe'); if (e) e.textContent = eta;
  const l = document.getElementById('pl'); if (l) l.textContent = 'Generating your video...';
}
function showErr(msg) {
  document.getElementById('pb').innerHTML = `
    <div class="empty">
      <div class="ei">⚠️</div>
      <div class="et" style="color:var(--er)">Failed</div>
      <div class="es">${msg}</div>
    </div>`;
}

// History
function renderHist() {
  const el = document.getElementById('hl');
  if (!hist.length) { el.innerHTML = '<div class="he">No videos yet</div>'; return; }
  el.innerHTML = hist.map((h, i) => `
    <div class="hi" onclick="replayH(${i})">
      <div class="hp">${h.prompt}</div>
      <div class="ht">${new Date(h.t).toLocaleTimeString()}</div>
      <a class="hdl" href="${h.url}" download target="_blank" onclick="event.stopPropagation()">↓</a>
    </div>`).join('');
}
function replayH(i) {
  const h = hist[i];
  showVideo(h.url, '', h.prompt);
}

// Helpers
function val(id) { return document.getElementById(id).value; }
function show(id) { document.getElementById(id).classList.remove('h'); }
function hide(id) { document.getElementById(id).classList.add('h'); }
function setBusy(on) {
  const b = document.getElementById('gb');
  b.disabled = on;
  b.textContent = on ? '⏳ Generating...' : '▶ Generate Video';
}
function setBadge(cls, lbl) {
  const b = document.getElementById('bdg');
  b.className = 'bdg ' + cls;
  b.textContent = lbl;
}
let tt;
function toast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(tt); tt = setTimeout(() => t.className = '', 3000);
}
