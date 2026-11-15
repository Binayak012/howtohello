import * as THREE from 'three';

const AMBIENCE_URL = `${import.meta.env.BASE_URL}assets/audio/market_ambience.mp3`;
const STALL_CHATTER_URL = `${import.meta.env.BASE_URL}assets/audio/market_stall_chatter.mp3`;
const BIRD_KOEL_URL = `${import.meta.env.BASE_URL}assets/audio/market_bird_koel.mp3`;
const CHILD_CRY_URL = `${import.meta.env.BASE_URL}assets/audio/child_cry.mp3`;
const GIGGLE_URL = `${import.meta.env.BASE_URL}assets/audio/child_giggle.mp3`;
const BICYCLE_ROLL_URL = `${import.meta.env.BASE_URL}assets/audio/bicycle_roll.mp3`;
const BICYCLE_PASS_URL = `${import.meta.env.BASE_URL}assets/audio/bicycle_pass.mp3`;
const BICYCLE_BELL_URL = `${import.meta.env.BASE_URL}assets/audio/bicycle_bell.wav`;

const AMBIENCE_VOLUME = 0.42;
const AMBIENCE_DUCKED = 0.12;
/**
 * Koel call under the street bed — source peak is quiet (~0.18), so we
 * peak-normalize on load and play clearly (still once per minute).
 */
const BIRD_KOEL_VOLUME = 0.4;
const BIRD_KOEL_INTERVAL_MS = 60000;
/** First call shortly after the street opens so the bird is noticeable. */
const BIRD_KOEL_FIRST_MS = 2500;
const FADE_SECONDS = 0.9;
const LOOP_CROSSFADE_SECONDS = 2.2;
const GIGGLE_VOLUME = 0.12;
/** Quiet close-range cry — only while standing next to the child. */
const CHILD_CRY_VOLUME = 0.09;
/** Listener must be this close before any cry can start. */
const CHILD_CRY_NEAR = 3.2;
/** Walk this far away before cry stops and re-arms. */
const CHILD_CRY_AWAY = 4.6;
/** Occasional short cry while staying close (~once per ~22 s). */
const CHILD_CRY_INTERVAL_MS = 22000;
const STALL_CHATTER_VOLUME = 0.2;
const STALL_CHATTER_SPEECH = 0.06;
/** Start vendor/customer chatter when this close to a stall. */
const STALL_NEAR = 5.2;
/** Stop stall chatter after walking clearly away. */
const STALL_AWAY = 7.2;

/** Brief cry excerpts so we never loop a long sob. */
const CHILD_CRY_WINDOWS = [
  { offset: 0.7, duration: 2.0 },
  { offset: 2.0, duration: 2.1 },
  { offset: 4.2, duration: 1.9 },
] as const;
/** Tire/freewheel bed — keep audible under the louder proximity bell. */
const BICYCLE_ROLL_VOLUME = 0.28;
const BICYCLE_ROLL_SPEECH = 0.08;
/** One-shot pass-by whoosh once per nearby approach (not on teleport). */
const BICYCLE_PASS_VOLUME = 0.16;
const BICYCLE_PASS_SPEECH = 0.05;
const BICYCLE_BELL_VOLUME = 0.36;
/** Soften the ding only while real voice playback is active — never mute it. */
const BICYCLE_BELL_SPEECH = 0.24;
/**
 * Ring / pass-by while approaching, slightly before the closest pass
 * (player↔bike world distance). Two dings + one whoosh per pass.
 */
const BICYCLE_BELL_APPROACH = 8.5;
/** Gap before the second ding of a pass (~one crisp ring after another). */
const BICYCLE_BELL_SECOND_MS = 340;
/** Rearm a new bell/pass sequence only after the bike has clearly moved away. */
const BICYCLE_BELL_AWAY = 16;
/** Ignore proximity when the bicycle teleports/loops (world units between frames). */
const BICYCLE_TELEPORT_JUMP = 10;

type StallId = 'fruit' | 'bread' | 'flowers';
const STALL_IDS: StallId[] = ['fruit', 'bread', 'flowers'];

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

/** Raise a quiet field recording so it can sit under the market bed. */
function peakNormalize(context: AudioContext, source: AudioBuffer, target = 0.88): AudioBuffer {
  let peak = 0;
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const data = source.getChannelData(channel);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak < 1e-5 || peak >= target) return source;
  const scale = target / peak;
  const output = context.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const result = output.getChannelData(channel);
    for (let i = 0; i < input.length; i++) result[i] = input[i] * scale;
  }
  return output;
}

type MarketAudioHooks = {
  isSpeechBusy?: () => boolean;
};

/**
 * Street ambience, occasional koel bird call, near-stall chatter, bicycle
 * pass audio, close-range child cry while the teddy is missing, and a
 * relieved giggle on return. Independent of the shop Radio on/off control.
 */
export class MarketAudioController {
  private ambience?: THREE.Audio;
  private bird?: THREE.Audio;
  private childVoice?: THREE.PositionalAudio;
  private ambienceBuffer?: AudioBuffer;
  private birdClip?: AudioBuffer;
  private stallChatterBuffer?: AudioBuffer;
  private cryClips: AudioBuffer[] = [];
  private giggleClip?: AudioBuffer;
  private bicycleRollBuffer?: AudioBuffer;
  private bicyclePassBuffer?: AudioBuffer;
  private bicycleBellClip?: AudioBuffer;
  private bicycleRoll?: THREE.PositionalAudio;
  private bicyclePass?: THREE.PositionalAudio;
  private bicycleBell?: THREE.PositionalAudio;
  private readonly stallVoices = new Map<StallId, THREE.PositionalAudio>();
  private readonly stallNear = new Map<StallId, boolean>();
  private bicycleRiding = false;
  /** True until the pass whoosh + two-ding sequence fires; re-arms only after AWAY. */
  private bicycleBellArmed = true;
  private bicycleHadSample = false;
  private bicycleLastDistance = Infinity;
  private bicycleBellSecondTimer?: ReturnType<typeof setTimeout>;
  private readonly bicycleLastWorld = new THREE.Vector3();
  private readonly bicycleWorld = new THREE.Vector3();
  private readonly listenerWorld = new THREE.Vector3();
  private readonly stallWorld = new THREE.Vector3();
  private readonly childWorld = new THREE.Vector3();
  private active = false;
  private toyMissing = false;
  private dialogueBusy = false;
  private duckCount = 0;
  private hidden = document.hidden;
  private disposed = false;
  private generation = 0;
  private cryVariant = 0;
  private pendingGiggle = false;
  private childNear = false;
  private cryTimer?: ReturnType<typeof setTimeout>;
  private birdTimer?: ReturnType<typeof setTimeout>;
  private stopTimer?: ReturnType<typeof setTimeout>;

  constructor(private listener?: THREE.AudioListener, private hooks: MarketAudioHooks = {}) {
    if (!listener) return;
    this.ambience = new THREE.Audio(listener);
    this.ambience.setLoop(true);
    this.ambience.gain.gain.value = 0;
    listener.add(this.ambience);
    this.bird = new THREE.Audio(listener);
    this.bird.setLoop(false);
    listener.add(this.bird);
    void this.load();
    this.addUnlockListeners();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Fade the street bed in or out. Safe to call repeatedly; never stacks loops. */
  setActive(active: boolean) {
    if (this.disposed) return;
    if (this.active === active) {
      if (active) {
        void this.attemptAmbience();
        this.armBirdSchedule();
      }
      return;
    }
    this.active = active;
    this.generation++;
    if (active) {
      void this.attemptAmbience();
      this.armBirdSchedule();
    } else {
      this.pendingGiggle = false;
      this.clearCrySchedule();
      this.clearBirdSchedule();
      this.stopBird();
      this.childNear = false;
      this.stopChildVoice();
      this.stopStallChatter();
      this.stopBicycle(true);
      this.fadeAmbienceOut(true);
    }
  }

  /** Attach positional bike sounds to the delivery bicycle. */
  attachBicycle(anchor?: THREE.Object3D) {
    if (this.disposed || !this.listener) return;
    this.stopBicycle(true);
    this.bicycleRoll?.parent?.remove(this.bicycleRoll);
    this.bicyclePass?.parent?.remove(this.bicyclePass);
    this.bicycleBell?.parent?.remove(this.bicycleBell);
    if (!anchor) {
      this.bicycleRoll = this.bicyclePass = this.bicycleBell = undefined;
      return;
    }
    const place = (ref: number, max: number) => new THREE.PositionalAudio(this.listener!)
      .setRefDistance(ref)
      .setRolloffFactor(1.05)
      .setDistanceModel('linear')
      .setMaxDistance(max);
    // Roll stays present through the pass; pass whoosh + bell layer on top.
    this.bicycleRoll = place(3.6, 26);
    this.bicyclePass = place(3.2, 22);
    // Wide ref distance so the ding stays clear as the bike approaches.
    this.bicycleBell = place(6.5, 28);
    this.bicycleRoll.setLoop(true);
    this.bicycleRoll.setVolume(this.rollVolume());
    this.bicyclePass.setVolume(this.passVolume());
    this.bicycleBell.setVolume(this.bellVolume());
    if (this.bicycleRollBuffer) this.bicycleRoll.setBuffer(this.bicycleRollBuffer);
    if (this.bicyclePassBuffer) this.bicyclePass.setBuffer(this.bicyclePassBuffer);
    if (this.bicycleBellClip) this.bicycleBell.setBuffer(this.bicycleBellClip);
    anchor.add(this.bicycleRoll, this.bicyclePass, this.bicycleBell);
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
      // Pass whoosh + two dings just before the closest point; roll keeps looping.
      this.bicycleBellArmed = false;
      this.playBicyclePass();
      this.ringBicycleBellTwice();
    }

    this.bicycleLastWorld.copy(this.bicycleWorld);
    this.bicycleLastDistance = distance;
  }

  /** Attach child cry / giggle to the market child mesh (positional). */
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
      .setRefDistance(1.7)
      .setRolloffFactor(1.35)
      .setDistanceModel('linear')
      .setMaxDistance(6.5);
    this.childVoice.gain.gain.value = CHILD_CRY_VOLUME;
    anchor.add(this.childVoice);
  }

  /**
   * Soft cry only while the teddy is missing and the listener is standing
   * right next to the child. Call each roam frame.
   */
  noteChild() {
    if (this.disposed || !this.active || this.hidden || !this.toyMissing) {
      if (this.childNear) {
        this.childNear = false;
        this.clearCrySchedule();
        this.stopChildVoice();
      }
      return;
    }
    if (!this.childVoice?.parent || !this.listener) return;
    this.childVoice.parent.getWorldPosition(this.childWorld);
    this.listener.getWorldPosition(this.listenerWorld);
    const distance = this.childWorld.distanceTo(this.listenerWorld);
    if (!this.childNear && distance <= CHILD_CRY_NEAR) {
      this.childNear = true;
      if (!this.cryTimer && !this.childVoice.isPlaying) {
        this.scheduleCry(400 + Math.random() * 800);
      }
    } else if (this.childNear && distance > CHILD_CRY_AWAY) {
      this.childNear = false;
      this.clearCrySchedule();
      this.stopChildVoice();
    }
  }

  /** Attach looping vendor/customer chatter to each errand stall. */
  attachStalls(anchors: Partial<Record<StallId, THREE.Object3D | undefined>>) {
    if (this.disposed || !this.listener) return;
    this.stopStallChatter();
    for (const voice of this.stallVoices.values()) {
      voice.parent?.remove(voice);
      voice.gain.disconnect();
    }
    this.stallVoices.clear();
    this.stallNear.clear();
    for (const id of STALL_IDS) {
      const anchor = anchors[id];
      if (!anchor) continue;
      const voice = new THREE.PositionalAudio(this.listener)
        .setRefDistance(2.8)
        .setRolloffFactor(1.2)
        .setDistanceModel('linear')
        .setMaxDistance(12);
      voice.setLoop(true);
      voice.setVolume(this.stallVolume());
      if (this.stallChatterBuffer) voice.setBuffer(this.stallChatterBuffer);
      // Slight offset per stall so the three beds don’t phase-lock.
      voice.offset = id === 'fruit' ? 0 : id === 'bread' ? 7.5 : 15;
      anchor.add(voice);
      this.stallVoices.set(id, voice);
      this.stallNear.set(id, false);
    }
  }

  /**
   * Start/stop stall chatter from listener proximity to each vendor.
   * Call each roam frame.
   */
  noteStalls() {
    if (this.disposed || !this.active || this.hidden || !this.listener) {
      this.stopStallChatter();
      return;
    }
    this.listener.getWorldPosition(this.listenerWorld);
    this.syncStallVolumes();
    for (const id of STALL_IDS) {
      const voice = this.stallVoices.get(id);
      if (!voice?.parent) continue;
      voice.parent.getWorldPosition(this.stallWorld);
      const distance = this.stallWorld.distanceTo(this.listenerWorld);
      const near = this.stallNear.get(id) === true;
      if (!near && distance <= STALL_NEAR) {
        this.stallNear.set(id, true);
        this.startStallVoice(id);
      } else if (near && distance > STALL_AWAY) {
        this.stallNear.set(id, false);
        if (voice.isPlaying) voice.stop();
      }
    }
  }

  /**
   * While true, allow close-range cry. Turning false stops upset sounds and
   * plays one relieved giggle when the teddy returns.
   */
  setToyMissing(missing: boolean) {
    if (this.disposed) return;
    const wasMissing = this.toyMissing;
    this.toyMissing = missing;
    if (!missing) {
      this.childNear = false;
      this.clearCrySchedule();
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
  }

  /** Skip child reactions while a conversation or pronunciation clip is active. */
  setDialogueBusy(busy: boolean) {
    if (this.dialogueBusy === busy) {
      if (!busy) this.flushPendingGiggle();
      return;
    }
    this.dialogueBusy = busy;
    this.syncBicycleRollVolume();
    this.syncStallVolumes();
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
    this.syncStallVolumes();
  }

  restoreDuck() {
    if (this.disposed || this.duckCount === 0) return;
    this.duckCount--;
    if (this.duckCount === 0 && this.shouldPlayAmbience() && this.ambience?.isPlaying) {
      this.fadeAmbienceTo(AMBIENCE_VOLUME, 0.4);
    }
    this.syncBicycleRollVolume();
    this.syncStallVolumes();
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.active = false;
    clearTimeout(this.stopTimer);
    this.clearCrySchedule();
    this.clearBirdSchedule();
    this.clearBicycleBellSchedule();
    this.stopBird();
    this.stopChildVoice();
    this.stopStallChatter();
    this.stopBicycle(true);
    this.removeUnlockListeners();
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.ambience?.isPlaying) this.ambience.stop();
    this.ambience?.parent?.remove(this.ambience);
    this.ambience?.gain.disconnect();
    this.bird?.parent?.remove(this.bird);
    this.bird?.gain.disconnect();
    this.childVoice?.parent?.remove(this.childVoice);
    this.childVoice?.gain.disconnect();
    for (const voice of this.stallVoices.values()) {
      voice.parent?.remove(voice);
      voice.gain.disconnect();
    }
    this.stallVoices.clear();
    this.bicycleRoll?.parent?.remove(this.bicycleRoll);
    this.bicyclePass?.parent?.remove(this.bicyclePass);
    this.bicycleBell?.parent?.remove(this.bicycleBell);
    this.bicycleRoll?.gain.disconnect();
    this.bicyclePass?.gain.disconnect();
    this.bicycleBell?.gain.disconnect();
    this.ambience = undefined;
    this.bird = undefined;
    this.childVoice = undefined;
    this.bicycleRoll = this.bicyclePass = this.bicycleBell = undefined;
  }

  private async load() {
    if (!this.listener) return;
    const context = this.listener.context;
    try {
      const [ambience, stallChatter, bird, cry, giggle, roll, pass, bell] = await Promise.all([
        this.decode(AMBIENCE_URL, context),
        this.decode(STALL_CHATTER_URL, context),
        this.decode(BIRD_KOEL_URL, context),
        this.decode(CHILD_CRY_URL, context),
        this.decode(GIGGLE_URL, context),
        this.decode(BICYCLE_ROLL_URL, context),
        this.decode(BICYCLE_PASS_URL, context),
        this.decode(BICYCLE_BELL_URL, context),
      ]);
      if (this.disposed) return;
      this.ambienceBuffer = seamlessLoop(context, ambience, LOOP_CROSSFADE_SECONDS);
      this.stallChatterBuffer = seamlessLoop(context, stallChatter, 1.2);
      this.birdClip = peakNormalize(context, bird);
      this.cryClips = CHILD_CRY_WINDOWS.map(window => sliceBuffer(context, cry, window.offset, window.duration));
      this.giggleClip = sliceBuffer(context, giggle, 0.05, Math.min(1.8, giggle.duration - 0.05));
      this.bicycleRollBuffer = seamlessLoop(context, roll, 0.35);
      this.bicyclePassBuffer = pass;
      // Asset is a single crisp ding; ringBicycleBellTwice plays it twice per pass.
      this.bicycleBellClip = sliceBuffer(context, bell, 0, Math.min(0.75, bell.duration));
      this.ambience?.setBuffer(this.ambienceBuffer);
      if (this.bird && this.birdClip) this.bird.setBuffer(this.birdClip);
      for (const voice of this.stallVoices.values()) {
        if (this.stallChatterBuffer) voice.setBuffer(this.stallChatterBuffer);
      }
      if (this.bicycleRoll && this.bicycleRollBuffer) this.bicycleRoll.setBuffer(this.bicycleRollBuffer);
      if (this.bicyclePass && this.bicyclePassBuffer) this.bicyclePass.setBuffer(this.bicyclePassBuffer);
      if (this.bicycleBell && this.bicycleBellClip) this.bicycleBell.setBuffer(this.bicycleBellClip);
      if (this.active) {
        void this.attemptAmbience();
        this.armBirdSchedule();
      }
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

  private passVolume() {
    return this.voicePlaying() || this.duckCount > 0 ? BICYCLE_PASS_SPEECH : BICYCLE_PASS_VOLUME;
  }

  private bellVolume() {
    // Dialogue panels must not mute the bell; only live voice gently ducks it.
    return this.voicePlaying() ? BICYCLE_BELL_SPEECH : BICYCLE_BELL_VOLUME;
  }

  private syncBicycleRollVolume() {
    if (this.bicycleRoll?.isPlaying) this.bicycleRoll.setVolume(this.rollVolume());
  }

  private stallVolume() {
    return this.voicePlaying() || this.duckCount > 0 || this.dialogueBusy ? STALL_CHATTER_SPEECH : STALL_CHATTER_VOLUME;
  }

  private syncStallVolumes() {
    const volume = this.stallVolume();
    for (const voice of this.stallVoices.values()) {
      if (voice.isPlaying) voice.setVolume(volume);
    }
  }

  private startStallVoice(id: StallId) {
    const voice = this.stallVoices.get(id);
    if (!voice || !this.stallChatterBuffer || !this.listener) return;
    void this.listener.context.resume().then(() => {
      if (this.disposed || !this.active || this.hidden || !voice || this.stallNear.get(id) !== true) return;
      if (!voice.isPlaying) {
        voice.setVolume(this.stallVolume());
        voice.play();
      } else {
        voice.setVolume(this.stallVolume());
      }
    }).catch(() => { /* Optional stall bed. */ });
  }

  private stopStallChatter() {
    for (const id of STALL_IDS) this.stallNear.set(id, false);
    for (const voice of this.stallVoices.values()) {
      if (voice.isPlaying) voice.stop();
    }
  }

  private startBicycleRoll() {
    if (!this.bicycleRoll || !this.bicycleRollBuffer || !this.listener) return;
    void this.listener.context.resume().then(() => {
      if (this.disposed || !this.active || !this.bicycleRiding || this.hidden || !this.bicycleRoll) return;
      if (!this.bicycleRollBuffer) return;
      // Always (re)bind the roll buffer so a prior stop cannot leave playback empty.
      this.bicycleRoll.setBuffer(this.bicycleRollBuffer);
      this.bicycleRoll.setVolume(this.rollVolume());
      if (!this.bicycleRoll.isPlaying) this.bicycleRoll.play();
    }).catch(() => { /* Optional bike bed. */ });
  }

  /** One pass-by whoosh per nearby approach — never on loop/teleport spawn. */
  private playBicyclePass() {
    if (!this.bicyclePass || !this.bicyclePassBuffer || !this.listener) return;
    void this.listener.context.resume().then(() => {
      if (this.disposed || !this.active || !this.bicycleRiding || this.hidden || !this.bicyclePass) return;
      if (!this.bicyclePassBuffer) return;
      if (this.bicyclePass.isPlaying) this.bicyclePass.stop();
      this.bicyclePass.setBuffer(this.bicyclePassBuffer);
      this.bicyclePass.setVolume(this.passVolume());
      this.bicyclePass.play();
    }).catch(() => { /* Optional pass whoosh. */ });
  }

  /** Play the Pixabay ding twice on each nearby street pass. */
  private ringBicycleBellTwice() {
    this.clearBicycleBellSchedule();
    this.playBicycleBellDing();
    this.bicycleBellSecondTimer = setTimeout(() => {
      this.bicycleBellSecondTimer = undefined;
      this.playBicycleBellDing();
    }, BICYCLE_BELL_SECOND_MS);
  }

  private clearBicycleBellSchedule() {
    clearTimeout(this.bicycleBellSecondTimer);
    this.bicycleBellSecondTimer = undefined;
  }

  private playBicycleBellDing() {
    if (!this.bicycleBell || !this.bicycleBellClip || !this.listener) return;
    void this.listener.context.resume().then(() => {
      if (this.disposed || !this.active || !this.bicycleRiding || this.hidden || !this.bicycleBell) return;
      if (!this.bicycleBellClip) return;
      if (this.bicycleBell.isPlaying) this.bicycleBell.stop();
      this.bicycleBell.setBuffer(this.bicycleBellClip);
      this.bicycleBell.setVolume(this.bellVolume());
      this.bicycleBell.play();
      // Keep the tire bed going under the dings.
      this.startBicycleRoll();
    }).catch(() => { /* Optional bell. */ });
  }

  private stopBicycle(resetFlags: boolean) {
    this.bicycleRiding = false;
    this.bicycleHadSample = false;
    this.bicycleLastDistance = Infinity;
    this.clearBicycleBellSchedule();
    if (this.bicycleRoll?.isPlaying) this.bicycleRoll.stop();
    if (this.bicyclePass?.isPlaying) this.bicyclePass.stop();
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

  private speechBlocksChild() {
    return this.dialogueBusy || Boolean(this.hooks.isSpeechBusy?.());
  }

  /** First call a few seconds after the street opens, then at most once per minute. */
  private armBirdSchedule() {
    if (this.disposed || !this.active || this.hidden || this.birdTimer) return;
    this.scheduleBird(BIRD_KOEL_FIRST_MS + Math.random() * 1500);
  }

  private scheduleBird(delayMs: number) {
    this.clearBirdSchedule();
    if (!this.active || this.disposed || this.hidden) return;
    this.birdTimer = setTimeout(() => this.playBird(), delayMs);
  }

  private clearBirdSchedule() {
    clearTimeout(this.birdTimer);
    this.birdTimer = undefined;
  }

  private playBird() {
    if (this.disposed || !this.active || this.hidden) return;
    if (!this.birdClip || !this.listener || !this.bird) {
      this.scheduleBird(BIRD_KOEL_INTERVAL_MS);
      return;
    }
    const generation = this.generation;
    void this.listener.context.resume().then(() => {
      if (this.disposed || generation !== this.generation || !this.active || this.hidden || !this.bird || !this.birdClip) {
        this.scheduleBird(BIRD_KOEL_INTERVAL_MS);
        return;
      }
      if (this.bird.isPlaying) this.bird.stop();
      this.bird.setBuffer(this.birdClip);
      // Stay clear over the street bed; soften only while speech ducks ambience.
      this.bird.setVolume(this.duckCount > 0 ? BIRD_KOEL_VOLUME * 0.55 : BIRD_KOEL_VOLUME);
      this.bird.play();
      this.scheduleBird(BIRD_KOEL_INTERVAL_MS);
    }).catch(() => this.scheduleBird(BIRD_KOEL_INTERVAL_MS));
  }

  private stopBird() {
    if (this.bird?.isPlaying) this.bird.stop();
  }

  private scheduleCry(delayMs: number) {
    this.clearCrySchedule();
    if (!this.active || !this.toyMissing || !this.childNear || this.disposed) return;
    this.cryTimer = setTimeout(() => this.playCry(), delayMs);
  }

  private clearCrySchedule() {
    clearTimeout(this.cryTimer);
    this.cryTimer = undefined;
  }

  private playCry() {
    if (this.disposed || !this.active || !this.toyMissing || !this.childNear || this.hidden) return;
    if (this.speechBlocksChild() || this.childVoice?.isPlaying) {
      this.scheduleCry(CHILD_CRY_INTERVAL_MS * 0.4);
      return;
    }
    const clip = this.cryClips[this.cryVariant++ % Math.max(1, this.cryClips.length)];
    if (!clip || !this.listener || !this.childVoice) {
      this.scheduleCry(CHILD_CRY_INTERVAL_MS);
      return;
    }
    const generation = this.generation;
    void this.listener.context.resume().then(() => {
      if (this.disposed || generation !== this.generation || !this.active || !this.toyMissing || !this.childNear || this.hidden || this.speechBlocksChild() || !this.childVoice) {
        this.scheduleCry(CHILD_CRY_INTERVAL_MS * 0.4);
        return;
      }
      if (this.childVoice.isPlaying) this.childVoice.stop();
      this.childVoice.setBuffer(clip);
      this.childVoice.setVolume(CHILD_CRY_VOLUME * (0.85 + Math.random() * 0.2));
      this.childVoice.setPlaybackRate(0.97 + Math.random() * 0.06);
      this.childVoice.play();
      this.scheduleCry(CHILD_CRY_INTERVAL_MS);
    }).catch(() => this.scheduleCry(CHILD_CRY_INTERVAL_MS));
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
      this.clearCrySchedule();
      this.clearBirdSchedule();
      this.clearBicycleBellSchedule();
      this.childNear = false;
      this.stopBird();
      this.stopChildVoice();
      this.stopStallChatter();
      this.stopBicycle(false);
      this.fadeAmbienceOut(false);
    } else if (this.active) {
      void this.attemptAmbience();
      this.armBirdSchedule();
    }
  };
}
