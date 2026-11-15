import * as THREE from 'three';

const AMBIENCE_URL = `${import.meta.env.BASE_URL}assets/audio/market_ambience.mp3`;
const SNIFFLE_URLS = [
  `${import.meta.env.BASE_URL}assets/audio/child_sniffle_a.mp3`,
  `${import.meta.env.BASE_URL}assets/audio/child_sniffle_b.mp3`,
] as const;
const GIGGLE_URL = `${import.meta.env.BASE_URL}assets/audio/child_giggle.mp3`;
const BICYCLE_ROLL_URL = `${import.meta.env.BASE_URL}assets/audio/bicycle_roll.mp3`;
const BICYCLE_BELL_URL = `${import.meta.env.BASE_URL}assets/audio/bicycle_bell.wav`;

const AMBIENCE_VOLUME = 0.28;
const AMBIENCE_DUCKED = 0.085;
const FADE_SECONDS = 0.9;
const LOOP_CROSSFADE_SECONDS = 2.2;
const SNIFFLE_VOLUME = 0.14;
const GIGGLE_VOLUME = 0.13;
const BICYCLE_ROLL_VOLUME = 0.14;
const BICYCLE_ROLL_SPEECH = 0.04;
const BICYCLE_BELL_VOLUME = 0.48;
/** Soften the ding only while real voice playback is active — never mute it. */
const BICYCLE_BELL_SPEECH = 0.32;
/**
 * Ring once while approaching, slightly before the closest pass
 * (player↔bike world distance). One ding-ding clip per pass.
 */
const BICYCLE_BELL_APPROACH = 8.5;
/** Rearm a new bell sequence only after the bike has clearly moved away. */
const BICYCLE_BELL_AWAY = 16;
/** Ignore proximity when the bicycle teleports/loops (world units between frames). */
const BICYCLE_TELEPORT_JUMP = 10;
/** Five 3.6–4.5 s sniffles evenly spaced inside each 32 s cycle. */
const SNIFFLE_CYCLE_MS = 32000;
const SNIFFLES_PER_CYCLE = 5;
const SNIFFLE_INTERVAL_MS = SNIFFLE_CYCLE_MS / SNIFFLES_PER_CYCLE;

/** Soft excerpts so we never play a long continuous cry. */
const SNIFFLE_WINDOWS = [
  { source: 0, offset: 0.3, duration: 4.2 },
  { source: 0, offset: 4.8, duration: 4.5 },
  { source: 0, offset: 10.0, duration: 4.0 },
  { source: 1, offset: 0.15, duration: 3.8 },
  { source: 1, offset: 3.0, duration: 4.0 },
  { source: 1, offset: 5.5, duration: 3.6 },
] as const;

function seamlessLoop(context: AudioContext, source: AudioBuffer, seconds: number): AudioBuffer {
  const overlap = Math.min(Math.floor(seconds * source.sampleRate), Math.floor(source.length / 4));
  if (overlap < 2) return source;
  const output = context.createBuffer(source.numberOfChannels, source.length - overlap, source.sampleRate);
  const bodyLength = source.length - overlap * 2;
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const result = output.getChannelData(channel);
    result.set(input.subarray(overlap, source.length - overlap), 0);
    for (let i = 0; i < overlap; i++) {
      const mix = i / (overlap - 1);
      result[bodyLength + i] = input[source.length - overlap + i] * Math.cos(mix * Math.PI / 2) + input[i] * Math.sin(mix * Math.PI / 2);
    }
  }
  return output;
}

function sliceBuffer(context: AudioContext, source: AudioBuffer, offset: number, duration: number): AudioBuffer {
  const start = Math.min(Math.floor(offset * source.sampleRate), source.length - 1);
  const length = Math.max(1, Math.min(Math.floor(duration * source.sampleRate), source.length - start));
  const output = context.createBuffer(source.numberOfChannels, length, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    output.copyToChannel(source.getChannelData(channel).subarray(start, start + length), channel);
  }
  return output;
}

type MarketAudioHooks = {
  isSpeechBusy?: () => boolean;
};

/**
 * Quiet street ambience plus occasional positional child reactions for the
 * Morning Market finale. Independent of the shop Radio on/off control.
 */
export class MarketAudioController {
  private ambience?: THREE.Audio;
  private childVoice?: THREE.PositionalAudio;
  private ambienceBuffer?: AudioBuffer;
  private sniffleClips: AudioBuffer[] = [];
  private giggleClip?: AudioBuffer;
  private bicycleRollBuffer?: AudioBuffer;
  private bicycleBellClip?: AudioBuffer;
  private bicycleRoll?: THREE.PositionalAudio;
  private bicycleBell?: THREE.PositionalAudio;
  private bicycleRiding = false;
  /** True until the ding-ding fires this pass; re-arms only after AWAY. */
  private bicycleBellArmed = true;
  private bicycleHadSample = false;
  private bicycleLastDistance = Infinity;
  private readonly bicycleLastWorld = new THREE.Vector3();
  private readonly bicycleWorld = new THREE.Vector3();
  private readonly listenerWorld = new THREE.Vector3();
  private active = false;
  private toyMissing = false;
  private dialogueBusy = false;
  private duckCount = 0;
  private hidden = document.hidden;
  private disposed = false;
  private generation = 0;
  private sniffleVariant = 0;
  private pendingGiggle = false;
  private sniffleTimer?: ReturnType<typeof setTimeout>;
  private stopTimer?: ReturnType<typeof setTimeout>;

  constructor(private listener?: THREE.AudioListener, private hooks: MarketAudioHooks = {}) {
    if (!listener) return;
    this.ambience = new THREE.Audio(listener);
    this.ambience.setLoop(true);
    this.ambience.gain.gain.value = 0;
    listener.add(this.ambience);
    void this.load();
    this.addUnlockListeners();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Fade the street bed in or out. Safe to call repeatedly; never stacks loops. */
  setActive(active: boolean) {
    if (this.disposed) return;
    if (this.active === active) {
      if (active) void this.attemptAmbience();
      return;
    }
    this.active = active;
    this.generation++;
    if (active) void this.attemptAmbience();
    else {
      this.pendingGiggle = false;
      this.clearSniffleSchedule();
      this.stopChildVoice();
      this.stopBicycle(true);
      this.fadeAmbienceOut(true);
    }
  }

  /** Attach positional bike sounds to the delivery bicycle. */
  attachBicycle(anchor?: THREE.Object3D) {
    if (this.disposed || !this.listener) return;
    this.stopBicycle(true);
    this.bicycleRoll?.parent?.remove(this.bicycleRoll);
    this.bicycleBell?.parent?.remove(this.bicycleBell);
    if (!anchor) {
      this.bicycleRoll = this.bicycleBell = undefined;
      return;
    }
    const place = (ref: number, max: number) => new THREE.PositionalAudio(this.listener!)
      .setRefDistance(ref)
      .setRolloffFactor(1.05)
      .setDistanceModel('linear')
      .setMaxDistance(max);
    this.bicycleRoll = place(2.4, 22);
    // Wide ref distance so the ding stays clear as the bike approaches.
    this.bicycleBell = place(6.5, 28);
    this.bicycleRoll.setLoop(true);
    this.bicycleRoll.setVolume(this.rollVolume());
    this.bicycleBell.setVolume(this.bellVolume());
    if (this.bicycleRollBuffer) this.bicycleRoll.setBuffer(this.bicycleRollBuffer);
    if (this.bicycleBellClip) this.bicycleBell.setBuffer(this.bicycleBellClip);
    anchor.add(this.bicycleRoll, this.bicycleBell);
  }

  /**
   * Drive bike audio from the street animation. `progress` is kept for the
   * market hook signature; bells and level use listener↔bike proximity.
   */
  noteBicycle(riding: boolean, _progress?: number) {
    if (this.disposed || !this.active || this.hidden) {
      if (this.bicycleRiding) this.stopBicycle(false);
      return;
    }
    if (!riding) {
      if (this.bicycleRiding) {
        this.stopBicycle(false);
        // Ride ended away down the street — allow the next loop’s approach to ring.
        this.bicycleBellArmed = true;
      }
      return;
    }
    if (!this.bicycleRiding) {
      this.bicycleRiding = true;
      this.bicycleHadSample = false;
      this.startBicycleRoll();
    }
    this.syncBicycleRollVolume();
    if (!this.bicycleRoll?.parent || !this.listener) return;

    this.bicycleRoll.parent.getWorldPosition(this.bicycleWorld);
    this.listener.getWorldPosition(this.listenerWorld);
    const distance = this.bicycleWorld.distanceTo(this.listenerWorld);

    if (this.bicycleHadSample && this.bicycleWorld.distanceTo(this.bicycleLastWorld) > BICYCLE_TELEPORT_JUMP) {
      // Loop/teleport back to the start — silence the jump and do not bell.
      this.bicycleLastWorld.copy(this.bicycleWorld);
      this.bicycleLastDistance = distance;
      this.bicycleBellArmed = distance > BICYCLE_BELL_AWAY;
      if (this.bicycleRoll.isPlaying) this.bicycleRoll.stop();
      this.startBicycleRoll();
      return;
    }

    if (!this.bicycleHadSample) {
      this.bicycleHadSample = true;
      this.bicycleLastWorld.copy(this.bicycleWorld);
      this.bicycleLastDistance = distance;
      return;
    }

    const approaching = distance < this.bicycleLastDistance - 0.04;
    if (distance > BICYCLE_BELL_AWAY) {
      this.bicycleBellArmed = true;
    } else if (this.bicycleBellArmed && approaching && distance <= BICYCLE_BELL_APPROACH) {
      // One ding-ding just before the closest point; stay disarmed until AWAY.
      this.bicycleBellArmed = false;
      this.ringBicycleBell();
    }

    this.bicycleLastWorld.copy(this.bicycleWorld);
    this.bicycleLastDistance = distance;
  }

  /** Attach reactions to the market child mesh (positional). */
  attachChild(anchor?: THREE.Object3D) {
    if (this.disposed || !this.listener) return;
    if (this.childVoice?.parent === anchor) return;
    this.stopChildVoice();
    this.childVoice?.parent?.remove(this.childVoice);
    if (!anchor) {
      this.childVoice = undefined;
      return;
    }
    this.childVoice = new THREE.PositionalAudio(this.listener)
      .setRefDistance(2.2)
      .setRolloffFactor(1.15)
      .setDistanceModel('linear')
      .setMaxDistance(16);
    this.childVoice.gain.gain.value = SNIFFLE_VOLUME;
    anchor.add(this.childVoice);
  }

  /**
   * While true, schedule occasional soft sniffles. Turning false after true
   * stops upset sounds immediately and plays one relieved giggle.
   */
  setToyMissing(missing: boolean) {
    if (this.disposed) return;
    const wasMissing = this.toyMissing;
    this.toyMissing = missing;
    if (!missing) {
      this.clearSniffleSchedule();
      this.stopChildVoice();
      if (wasMissing && this.active) {
        // Wait for dialogue/pronunciation to finish rather than overlapping.
        if (this.speechBlocksChild()) this.pendingGiggle = true;
        else this.playGiggle();
      } else {
        this.pendingGiggle = false;
      }
      return;
    }
    this.pendingGiggle = false;
    if (this.active) this.scheduleSniffle(1800 + Math.random() * 2200);
  }

  /** Skip child reactions while a conversation or pronunciation clip is active. */
  setDialogueBusy(busy: boolean) {
    if (this.dialogueBusy === busy) {
      if (!busy) this.flushPendingGiggle();
      return;
    }
    this.dialogueBusy = busy;
    this.syncBicycleRollVolume();
    if (busy) {
      this.stopChildVoice();
      this.duck();
      return;
    }
    this.restoreDuck();
    this.flushPendingGiggle();
  }

  /** Call when pronunciation finishes so a deferred relief giggle can play. */
  flushPendingGiggle() {
    if (!this.pendingGiggle || !this.active || this.toyMissing || this.speechBlocksChild() || this.hidden) return;
    this.pendingGiggle = false;
    this.playGiggle();
  }

  /** Nestable duck for speech/learning cues; does not touch the Radio control. */
  duck(volume = AMBIENCE_DUCKED) {
    if (this.disposed || !this.ambience) return;
    this.duckCount++;
    if (this.duckCount === 1 && this.shouldPlayAmbience() && this.ambience.isPlaying) this.fadeAmbienceTo(volume, 0.2);
    this.syncBicycleRollVolume();
  }

  restoreDuck() {
    if (this.disposed || this.duckCount === 0) return;
    this.duckCount--;
    if (this.duckCount === 0 && this.shouldPlayAmbience() && this.ambience?.isPlaying) {
      this.fadeAmbienceTo(AMBIENCE_VOLUME, 0.4);
    }
    this.syncBicycleRollVolume();
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.active = false;
    this.clearSniffleSchedule();
    clearTimeout(this.stopTimer);
    this.stopChildVoice();
    this.stopBicycle(true);
    this.removeUnlockListeners();
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.ambience?.isPlaying) this.ambience.stop();
    this.ambience?.parent?.remove(this.ambience);
    this.ambience?.gain.disconnect();
    this.childVoice?.parent?.remove(this.childVoice);
    this.childVoice?.gain.disconnect();
    this.bicycleRoll?.parent?.remove(this.bicycleRoll);
    this.bicycleBell?.parent?.remove(this.bicycleBell);
    this.bicycleRoll?.gain.disconnect();
    this.bicycleBell?.gain.disconnect();
    this.ambience = undefined;
    this.childVoice = undefined;
    this.bicycleRoll = this.bicycleBell = undefined;
  }

  private async load() {
    if (!this.listener) return;
    const context = this.listener.context;
    try {
      const [ambience, sniffleA, sniffleB, giggle, roll, bell] = await Promise.all([
        this.decode(AMBIENCE_URL, context),
        this.decode(SNIFFLE_URLS[0], context),
        this.decode(SNIFFLE_URLS[1], context),
        this.decode(GIGGLE_URL, context),
        this.decode(BICYCLE_ROLL_URL, context),
        this.decode(BICYCLE_BELL_URL, context),
      ]);
      if (this.disposed) return;
      this.ambienceBuffer = seamlessLoop(context, ambience, LOOP_CROSSFADE_SECONDS);
      const sources = [sniffleA, sniffleB];
      this.sniffleClips = SNIFFLE_WINDOWS.map(window => sliceBuffer(context, sources[window.source], window.offset, window.duration));
      this.giggleClip = sliceBuffer(context, giggle, 0.05, Math.min(1.8, giggle.duration - 0.05));
      this.bicycleRollBuffer = seamlessLoop(context, roll, 0.35);
      // Asset is already a short ding-ding; keep a tiny lead-in trim only.
      this.bicycleBellClip = sliceBuffer(context, bell, 0, Math.min(1.2, bell.duration));
      this.ambience?.setBuffer(this.ambienceBuffer);
      if (this.bicycleRoll && this.bicycleRollBuffer) this.bicycleRoll.setBuffer(this.bicycleRollBuffer);
      if (this.bicycleBell && this.bicycleBellClip) this.bicycleBell.setBuffer(this.bicycleBellClip);
      if (this.active) void this.attemptAmbience();
      if (this.toyMissing && this.active) this.scheduleSniffle(1200);
    } catch (error) {
      if (!this.disposed) console.warn('Market environmental audio could not be loaded.', error);
    }
  }

  private voicePlaying() {
    return Boolean(this.hooks.isSpeechBusy?.());
  }

  private rollVolume() {
    return this.voicePlaying() || this.duckCount > 0 ? BICYCLE_ROLL_SPEECH : BICYCLE_ROLL_VOLUME;
  }

  private bellVolume() {
    // Dialogue panels must not mute the bell; only live voice gently ducks it.
    return this.voicePlaying() ? BICYCLE_BELL_SPEECH : BICYCLE_BELL_VOLUME;
  }

  private syncBicycleRollVolume() {
    if (this.bicycleRoll?.isPlaying) this.bicycleRoll.setVolume(this.rollVolume());
  }

  private startBicycleRoll() {
    if (!this.bicycleRoll || !this.bicycleRollBuffer || !this.listener) return;
    void this.listener.context.resume().then(() => {
      if (this.disposed || !this.active || !this.bicycleRiding || this.hidden || !this.bicycleRoll) return;
      if (!this.bicycleRoll.isPlaying) {
        this.bicycleRoll.setVolume(this.rollVolume());
        this.bicycleRoll.play();
      } else {
        this.bicycleRoll.setVolume(this.rollVolume());
      }
    }).catch(() => { /* Optional bike bed. */ });
  }

  private ringBicycleBell() {
    if (!this.bicycleBell || !this.bicycleBellClip || !this.listener) return;
    void this.listener.context.resume().then(() => {
      if (this.disposed || !this.active || !this.bicycleRiding || this.hidden || !this.bicycleBell) return;
      if (!this.bicycleBellClip) return;
      if (this.bicycleBell.isPlaying) this.bicycleBell.stop();
      this.bicycleBell.setBuffer(this.bicycleBellClip);
      this.bicycleBell.setVolume(this.bellVolume());
      this.bicycleBell.play();
    }).catch(() => { /* Optional bell. */ });
  }

  private stopBicycle(resetFlags: boolean) {
    this.bicycleRiding = false;
    this.bicycleHadSample = false;
    this.bicycleLastDistance = Infinity;
    if (this.bicycleRoll?.isPlaying) this.bicycleRoll.stop();
    if (this.bicycleBell?.isPlaying) this.bicycleBell.stop();
    if (resetFlags) this.bicycleBellArmed = true;
  }

  private async decode(url: string, context: AudioContext) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Market audio request failed with ${response.status}`);
    return context.decodeAudioData(await response.arrayBuffer());
  }

  private shouldPlayAmbience() {
    return Boolean(this.active && this.ambienceBuffer && this.ambience && !this.hidden && !this.disposed);
  }

  private async attemptAmbience() {
    if (!this.shouldPlayAmbience() || !this.listener || !this.ambience) return;
    clearTimeout(this.stopTimer);
    try {
      await this.listener.context.resume();
      if (!this.shouldPlayAmbience() || !this.ambience) return;
      if (!this.ambience.isPlaying) {
        this.ambience.gain.gain.value = 0;
        this.ambience.play();
      }
      if (this.listener.context.state === 'running') {
        const target = this.duckCount > 0 ? AMBIENCE_DUCKED : AMBIENCE_VOLUME;
        this.fadeAmbienceTo(target, FADE_SECONDS);
        this.removeUnlockListeners();
      } else {
        this.addUnlockListeners();
      }
      if (this.toyMissing) this.scheduleSniffle(2000 + Math.random() * 2000);
    } catch {
      this.addUnlockListeners();
    }
  }

  private fadeAmbienceTo(volume: number, seconds: number) {
    if (!this.ambience || !this.listener) return;
    const gain = this.ambience.gain.gain;
    const now = this.listener.context.currentTime;
    const current = Math.min(Math.max(gain.value, 0), AMBIENCE_VOLUME);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(current, now);
    gain.linearRampToValueAtTime(volume, now + seconds);
  }

  private fadeAmbienceOut(reset: boolean) {
    if (!this.ambience?.isPlaying) return;
    clearTimeout(this.stopTimer);
    this.duckCount = 0;
    this.fadeAmbienceTo(0, this.hidden ? 0 : FADE_SECONDS);
    if (this.hidden) {
      this.ambience.pause();
      return;
    }
    this.stopTimer = setTimeout(() => {
      if (!this.ambience?.isPlaying || this.shouldPlayAmbience()) return;
      if (reset) this.ambience.stop();
      else this.ambience.pause();
    }, FADE_SECONDS * 1000 + 40);
  }

  private scheduleSniffle(delayMs: number) {
    this.clearSniffleSchedule();
    if (!this.active || !this.toyMissing || this.disposed) return;
    this.sniffleTimer = setTimeout(() => this.playSniffle(), delayMs);
  }

  private clearSniffleSchedule() {
    clearTimeout(this.sniffleTimer);
    this.sniffleTimer = undefined;
  }

  private speechBlocksChild() {
    return this.dialogueBusy || Boolean(this.hooks.isSpeechBusy?.());
  }

  private playSniffle() {
    if (this.disposed || !this.active || !this.toyMissing || this.hidden) return;
    if (this.speechBlocksChild() || this.childVoice?.isPlaying) {
      // Keep the 32 s / 5 cadence; retry near the next slot instead of drifting.
      this.scheduleSniffle(SNIFFLE_INTERVAL_MS * 0.45);
      return;
    }
    const clip = this.sniffleClips[this.sniffleVariant++ % Math.max(1, this.sniffleClips.length)];
    if (!clip || !this.listener || !this.childVoice) {
      this.scheduleSniffle(SNIFFLE_INTERVAL_MS);
      return;
    }
    const generation = this.generation;
    void this.listener.context.resume().then(() => {
      if (this.disposed || generation !== this.generation || !this.active || !this.toyMissing || this.hidden || this.speechBlocksChild() || !this.childVoice) {
        this.scheduleSniffle(SNIFFLE_INTERVAL_MS * 0.45);
        return;
      }
      if (this.childVoice.isPlaying) this.childVoice.stop();
      this.childVoice.setBuffer(clip);
      this.childVoice.setVolume(SNIFFLE_VOLUME * (0.85 + Math.random() * 0.2));
      this.childVoice.setPlaybackRate(0.96 + Math.random() * 0.08);
      this.childVoice.play();
      // Next of five starts ~6.4 s later → five plays inside each 32 s window.
      this.scheduleSniffle(SNIFFLE_INTERVAL_MS);
    }).catch(() => this.scheduleSniffle(SNIFFLE_INTERVAL_MS));
  }

  private playGiggle() {
    if (this.disposed || !this.giggleClip || !this.listener || !this.childVoice || this.hidden) return;
    if (this.speechBlocksChild()) return;
    const generation = this.generation;
    void this.listener.context.resume().then(() => {
      if (this.disposed || generation !== this.generation || this.hidden || this.speechBlocksChild() || !this.childVoice || !this.giggleClip) return;
      if (this.childVoice.isPlaying) this.childVoice.stop();
      this.childVoice.setBuffer(this.giggleClip);
      this.childVoice.setVolume(GIGGLE_VOLUME);
      this.childVoice.setPlaybackRate(1.02);
      this.childVoice.play();
    }).catch(() => { /* Optional relief cue. */ });
  }

  private stopChildVoice() {
    if (this.childVoice?.isPlaying) this.childVoice.stop();
  }

  private unlock = () => {
    if (this.shouldPlayAmbience()) void this.attemptAmbience();
  };

  private addUnlockListeners() {
    window.addEventListener('pointerdown', this.unlock, { capture: true, passive: true });
    window.addEventListener('keydown', this.unlock, { capture: true });
  }

  private removeUnlockListeners() {
    window.removeEventListener('pointerdown', this.unlock, true);
    window.removeEventListener('keydown', this.unlock, true);
  }

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden) {
      this.generation++;
      this.clearSniffleSchedule();
      this.stopChildVoice();
      this.stopBicycle(false);
      this.fadeAmbienceOut(false);
    } else if (this.active) {
      void this.attemptAmbience();
    }
  };
}
