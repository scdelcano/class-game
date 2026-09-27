// Step 1 test screen: verifies listening, talking and sounds on the real tablet.
import '../styles/base.css';
import './mic-test.css';
import { SpeechInput, isSpeechInputSupported } from '../voice/speech-input.js';
import { VOICE_PRESETS, englishVoices, isSpeechOutputSupported, speak, stopSpeaking } from '../voice/speech-output.js';
import { sfx } from '../audio/sfx.js';
import { isInstalledApp, registerServiceWorker } from '../pwa.js';

registerServiceWorker();

const $ = (id) => document.getElementById(id);
const micButton = $('mic');
const micLabel = $('mic-label');
const heard = $('heard');
const message = $('message');
const alternativesList = $('alternatives');
const sayBack = $('say-back');

// ---------------------------------------------------------------- event log
function log(text) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString([], { hour12: false });
  li.textContent = `${time}  ${text}`;
  $('log').prepend(li);
}

// ---------------------------------------------------------------- checklist
const checks = new Map();

/** @param {'ok'|'warn'|'bad'|'wait'} state */
function setCheck(key, state, label, detail = '') {
  const icon = { ok: '✅', warn: '⚠️', bad: '❌', wait: '⏳' }[state];
  let li = checks.get(key);
  if (!li) {
    li = document.createElement('li');
    checks.set(key, li);
    $('checks').append(li);
  }
  li.innerHTML = '';
  const iconEl = document.createElement('span');
  iconEl.textContent = icon;
  const labelEl = document.createElement('strong');
  labelEl.textContent = label;
  li.append(iconEl, labelEl);
  if (detail) {
    const d = document.createElement('span');
    d.className = 'detail';
    d.textContent = detail;
    li.append(d);
  }
}

function runChecks() {
  setCheck('https', window.isSecureContext ? 'ok' : 'bad', 'Safe connection (https)',
    window.isSecureContext ? location.origin : 'The microphone only works on https:// or localhost.');

  setCheck('listen', isSpeechInputSupported() ? 'ok' : 'bad', 'Listening is supported',
    isSpeechInputSupported() ? '' : 'Speech recognition is missing. Use Chrome.');

  setCheck('online', navigator.onLine ? 'ok' : 'warn', navigator.onLine ? 'Internet is on' : 'Internet is off',
    'Chrome sends speech to Google to turn it into words.');

  const installed = isInstalledApp();
  setCheck('installed', installed ? 'ok' : 'warn',
    installed ? 'Opened from the home screen' : 'Opened in a browser tab',
    installed ? '' : 'Also test after “Add to Home screen”.');

  checkMicPermission();
  checkVoices();
}

async function checkMicPermission() {
  if (!navigator.permissions?.query) {
    setCheck('perm', 'warn', 'Microphone permission: unknown');
    return;
  }
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    const show = () => {
      const map = {
        granted: ['ok', 'Microphone allowed'],
        prompt: ['wait', 'Microphone: will ask the first time'],
        denied: ['bad', 'Microphone blocked', 'Tap the lock icon by the address bar → Permissions → Microphone → Allow. For the home-screen app: long-press icon → App info → Permissions.'],
      };
      const [state, label, detail] = map[status.state] ?? ['warn', `Microphone: ${status.state}`];
      setCheck('perm', state, label, detail);
    };
    show();
    status.onchange = () => {
      log(`microphone permission → ${status.state}`);
      show();
    };
  } catch {
    setCheck('perm', 'warn', 'Microphone permission: unknown');
  }
}

async function checkVoices() {
  if (!isSpeechOutputSupported()) {
    setCheck('voices', 'bad', 'Talking is not supported');
    return;
  }
  setCheck('voices', 'wait', 'Looking for talking voices…');
  const voices = await englishVoices();
  setCheck('voices', voices.length ? 'ok' : 'warn', `${voices.length} English talking voices`,
    voices[0] ? `Default: ${voices[0].name}` : 'Install “Speech Services by Google” from the Play Store.');
  $('voice-count').textContent = String(voices.length);
  $('voice-list').replaceChildren(...voices.map((v) => {
    const li = document.createElement('li');
    li.textContent = `${v.name} (${v.lang})${v.localService ? '' : ' · online'}`;
    return li;
  }));
}

window.addEventListener('online', runChecks);
window.addEventListener('offline', runChecks);

// ---------------------------------------------------------------- listening
const speech = new SpeechInput();
const HINT = 'Try saying: “Okay class, time to take attendance!”';
let lastHeard = '';
let heardThisTurn = false;

function showMessage(text) {
  message.hidden = !text;
  message.textContent = text ?? '';
}

function setHeard(text, kind = '') {
  heard.textContent = text;
  heard.className = `heard ${kind}`;
}

speech.on('start', () => {
  log('listening started');
  micButton.classList.add('listening');
  micLabel.textContent = "I'm listening…";
});

speech.on('speech', () => {
  log('speech detected');
  micButton.classList.add('hearing');
});

speech.on('interim', ({ text }) => setHeard(text, 'interim'));

speech.on('result', ({ text, alternatives }) => {
  log(`heard: "${text}"`);
  lastHeard = text;
  heardThisTurn = true;
  setHeard(`“${text}”`);
  sayBack.disabled = false;
  alternativesList.replaceChildren(...alternatives.map((alt) => {
    const li = document.createElement('li');
    const pct = alt.confidence ? ` — ${Math.round(alt.confidence * 100)}%` : '';
    li.textContent = `${alt.text}${pct}`;
    return li;
  }));
  sfx.chime();
});

speech.on('error', ({ code, message: friendly, detail }) => {
  log(`error: ${code}${detail ? ` (${detail})` : ''}`);
  if (friendly) showMessage(friendly);
  if (code === 'not-allowed' || code === 'service-not-allowed') checkMicPermission();
});

speech.on('end', () => {
  log('listening ended');
  micButton.classList.remove('listening', 'hearing');
  micLabel.textContent = 'Tap to talk';
  if (!heardThisTurn) setHeard(HINT, 'hint');
});

micButton.addEventListener('click', () => {
  sfx.unlock();
  if (speech.listening) {
    speech.stop(); // second tap = "I'm done talking"
    return;
  }
  stopSpeaking(); // don't let the tablet hear its own voice
  showMessage(null);
  alternativesList.replaceChildren();
  heardThisTurn = false;
  setHeard('…', 'interim');
  speech.start();
});

sayBack.addEventListener('click', () => {
  sfx.unlock();
  if (lastHeard) speak(lastHeard, VOICE_PRESETS.kid);
});

// ---------------------------------------------------------------- voices
const SAMPLES = {
  kid: { line: 'Here, teacher!', sound: null },
  plush: { line: 'Present! Hee hee!', sound: 'squeak' },
  truck: { line: 'Here, teacher!', sound: 'honk' },
  tank: { line: 'Present and ready!', sound: 'clank' },
};

document.querySelectorAll('[data-voice]').forEach((button) => {
  button.addEventListener('click', async () => {
    sfx.unlock();
    const kind = button.dataset.voice;
    if (kind === 'bell') {
      sfx.bell();
      log('bell');
      return;
    }
    const { line, sound } = SAMPLES[kind];
    stopSpeaking();
    if (sound) {
      sfx[sound]();
      await new Promise((r) => setTimeout(r, 450));
    }
    log(`voice: ${kind}`);
    speak(line, VOICE_PRESETS[kind]);
  });
});

// ---------------------------------------------------------------- start
setHeard(HINT, 'hint');
runChecks();
log(`page loaded (${isInstalledApp() ? 'home-screen app' : 'browser tab'})`);
