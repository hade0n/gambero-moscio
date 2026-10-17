/**
 * Sintetizzatore audio leggero Web Audio API per "Il Banco del Gambero".
 * - Nessun file audio esterno o proprietario.
 * - Non riproduce alcun suono prima di un gesto esplicito dell'utente.
 * - Supporta il controllo Muto persistito per sessione.
 */

let audioCtx = null;
let unlockedByGesture = false;
let muted = false;

try {
  muted = sessionStorage.getItem('gm_game_muted') === '1';
} catch {
  muted = false;
}

export function isGameMuted() {
  return muted;
}

export function setGameMuted(nextMuted) {
  muted = Boolean(nextMuted);
  try {
    sessionStorage.setItem('gm_game_muted', muted ? '1' : '0');
  } catch {
    // ignore
  }
  return muted;
}

export function unlockAudioOnGesture() {
  unlockedByGesture = true;
  if (muted || typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playTone({ freq = 440, type = 'sine', duration = 0.12, gain = 0.08, slideTo = null, delay = 0 }) {
  if (muted || !unlockedByGesture || typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return;
    }
  }
  if (!audioCtx || audioCtx.state !== 'running') return;

  try {
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // ignore audio errors
  }
}

export function playGameSound(kind) {
  if (muted || !unlockedByGesture) return;
  switch (kind) {
    case 'cook_start':
      playTone({ freq: 260, slideTo: 340, type: 'triangle', duration: 0.11, gain: 0.06 });
      break;
    case 'cook_ready':
      playTone({ freq: 587.33, type: 'sine', duration: 0.12, gain: 0.07 });
      playTone({ freq: 880, type: 'sine', duration: 0.16, gain: 0.07, delay: 0.09 });
      break;
    case 'ingredient_add':
      playTone({ freq: 420, slideTo: 520, type: 'sine', duration: 0.08, gain: 0.05 });
      break;
    case 'ingredient_remove':
      playTone({ freq: 360, slideTo: 240, type: 'sine', duration: 0.09, gain: 0.05 });
      break;
    case 'serve_ok':
      playTone({ freq: 523.25, type: 'triangle', duration: 0.11, gain: 0.08 });
      playTone({ freq: 659.25, type: 'triangle', duration: 0.11, gain: 0.08, delay: 0.09 });
      playTone({ freq: 783.99, type: 'triangle', duration: 0.2, gain: 0.09, delay: 0.18 });
      break;
    case 'penalty':
      playTone({ freq: 220, slideTo: 145, type: 'sawtooth', duration: 0.2, gain: 0.06 });
      break;
    default:
      playTone({ freq: 440, type: 'sine', duration: 0.06, gain: 0.04 });
      break;
  }
}
