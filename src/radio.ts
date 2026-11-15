import * as THREE from 'three';

const AUDIO_URL = `${import.meta.env.BASE_URL}assets/audio/soft_lounge_elevator_music.mp3`;
const STORAGE_KEY = 'wayword.radio.enabled';
const MAX_VOLUME = 0.24;
const LOOP_CROSSFADE_SECONDS = 2.5;
const FADE_SECONDS = 0.65;

export type RadioState = 'loading' | 'on' | 'off' | 'unavailable';

function savedPreference(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
  catch { return true; }
}

function seamlessLoop(context: AudioContext, source: AudioBuffer, seconds: number): AudioBuffer {
  const overlap = Math.min(Math.floor(seconds * source.sampleRate), Math.floor(source.length / 4));
  if (overlap < 2) return source;
  // Play the body, blend the original tail into its opening, then loop back to
  // the sample immediately after the blended opening.
  const output = context.createBuffer(source.numberOfChannels, source.length - overlap, source.sampleRate);
  const bodyLength = source.length - overlap * 2;
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const result = output.getChannelData(channel);
    result.set(input.subarray(overlap, source.length - overlap), 0);
    for (let i = 0; i < overlap; i++) {
      const mix = i / (overlap - 1);
      const fadeOut = Math.cos(mix * Math.PI / 2);
      const fadeIn = Math.sin(mix * Math.PI / 2);
      result[bodyLength + i] = input[source.length - overlap + i] * fadeOut + input[i] * fadeIn;
    }
  }
  return output;
}

export class RadioController {
  enabled = savedPreference();
  inside = false;
  state: RadioState = 'loading';
  listener?: THREE.AudioListener;
  sound?: THREE.Audio<GainNode> | THREE.PositionalAudio;
  private loaded = false;
  private hidden = document.hidden;
  private disposed = false;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private duckCount = 0;
  private subscribers = new Set<(state: RadioState) => void>();

  constructor(camera?: THREE.Camera, anchor?: THREE.Object3D) {
    try {
      this.listener = new THREE.AudioListener();
      camera?.add(this.listener);
      const sound = anchor
        ? new THREE.PositionalAudio(this.listener)
          .setRefDistance(0.8)
          .setRolloffFactor(1)
          .setDistanceModel('linear')
          .setMaxDistance(7)
        : new THREE.Audio(this.listener);
      this.sound = sound;
      anchor?.add(sound);
      sound.setLoop(true);
      sound.gain.gain.value = 0;
      this.load();
      this.addUnlockListeners();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    } catch (error) {
      console.warn('Radio audio is unavailable.', error);
      this.state = 'unavailable';
    }
  }

  subscribe(callback: (state: RadioState) => void) {
    this.subscribers.add(callback);
    callback(this.currentState());
    return () => this.subscribers.delete(callback);
  }

  setInside(inside: boolean) {
    if (this.inside === inside) return;
    this.inside = inside;
    if (inside) void this.attemptPlayback();
    else this.fadeOut(true);
    this.notify();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* Audio still works without storage. */ }
    if (enabled) void this.attemptPlayback();
    else this.fadeOut(true);
    this.notify();
  }

  toggle() {
    this.setEnabled(!this.enabled);
  }

  /** Quiet the radio while a short pronunciation clip plays; nestable. */
  duck(volume = MAX_VOLUME * 0.22) {
    if (this.disposed || this.state === 'unavailable') return;
    this.duckCount++;
    if (this.duckCount === 1 && this.shouldPlay() && this.sound?.isPlaying) this.fadeTo(volume, 0.18);
  }

  restoreDuck() {
    if (this.disposed || this.duckCount === 0) return;
    this.duckCount--;
    if (this.duckCount === 0 && this.shouldPlay() && this.sound?.isPlaying) this.fadeTo(MAX_VOLUME, 0.35);
  }

  private currentState(): RadioState {
    if (this.state === 'unavailable') return 'unavailable';
    if (!this.enabled) return 'off';
    return this.loaded ? 'on' : 'loading';
  }

  private notify() {
    const state = this.currentState();
    this.state = state;
    this.subscribers.forEach(callback => callback(state));
  }

  private async load() {
    try {
      const response = await fetch(AUDIO_URL);
      if (!response.ok) throw new Error(`Audio request failed with ${response.status}`);
      const context = this.listener!.context;
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      if (this.disposed) return;
      this.sound!.setBuffer(seamlessLoop(context, decoded, LOOP_CROSSFADE_SECONDS));
      this.loaded = true;
      this.notify();
      await this.attemptPlayback();
    } catch (error) {
      if (this.disposed) return;
      console.warn('The radio track could not be loaded. The lesson will continue without it.', error);
      this.state = 'unavailable';
      this.loaded = false;
      this.notify();
    }
  }

  private shouldPlay() {
    return this.loaded && this.enabled && this.inside && !this.hidden && !this.disposed;
  }

  private async attemptPlayback() {
    if (!this.shouldPlay() || !this.sound || !this.listener) return;
    clearTimeout(this.stopTimer);
    const context = this.listener.context;
    try {
      await context.resume();
      if (!this.sound.isPlaying) {
        this.sound.gain.gain.value = 0;
        this.sound.play();
      }
      if (context.state === 'running') {
        this.fadeTo(MAX_VOLUME, FADE_SECONDS);
        this.removeUnlockListeners();
      } else {
        this.addUnlockListeners();
      }
    } catch {
      this.addUnlockListeners();
    }
  }

  private fadeTo(volume: number, seconds: number) {
    if (!this.sound || !this.listener) return;
    const gain = this.sound.gain.gain;
    const now = this.listener.context.currentTime;
    const current = Math.min(gain.value, MAX_VOLUME);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(current, now);
    gain.linearRampToValueAtTime(volume, now + seconds);
  }

  private fadeOut(reset: boolean) {
    if (!this.sound?.isPlaying) return;
    clearTimeout(this.stopTimer);
    this.duckCount = 0;
    this.fadeTo(0, this.hidden ? 0 : FADE_SECONDS);
    if (this.hidden) {
      this.sound.pause();
      return;
    }
    this.stopTimer = setTimeout(() => {
      if (!this.sound?.isPlaying || this.shouldPlay()) return;
      if (reset) this.sound.stop();
      else this.sound.pause();
    }, FADE_SECONDS * 1000 + 30);
  }

  private unlock = () => {
    if (this.shouldPlay()) void this.attemptPlayback();
  };

  private addUnlockListeners() {
    window.addEventListener('pointerdown', this.unlock, { capture: true, passive: true });
    window.addEventListener('touchend', this.unlock, { capture: true, passive: true });
    window.addEventListener('keydown', this.unlock, { capture: true });
  }

  private removeUnlockListeners() {
    window.removeEventListener('pointerdown', this.unlock, true);
    window.removeEventListener('touchend', this.unlock, true);
    window.removeEventListener('keydown', this.unlock, true);
  }

  private onVisibilityChange = () => {
    this.hidden = document.hidden;
    if (this.hidden) this.fadeOut(false);
    else void this.attemptPlayback();
  };

  dispose() {
    this.disposed = true;
    clearTimeout(this.stopTimer);
    this.removeUnlockListeners();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.sound?.isPlaying) this.sound.stop();
    this.sound?.parent?.remove(this.sound);
    this.listener?.parent?.remove(this.listener);
    this.sound?.gain.disconnect();
    this.listener?.gain.disconnect();
    this.subscribers.clear();
  }
}
