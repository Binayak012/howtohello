import * as THREE from 'three';

type EffectName = 'bag' | 'fabric' | 'footstep' | 'key' | 'tap' | 'shopkeeperHmm' | 'shopkeeperPlayful' | 'bottle' | 'fruit' | 'scan' | 'complete' | 'cheer' | 'bumpOops' | 'bumpOuch' | 'bumpExcuse';
export type BumpKind = 'none' | 'object' | 'person';

const URLS: Record<Exclude<EffectName, 'tap'>, string> = {
  bag: `${import.meta.env.BASE_URL}assets/audio/bag_rustle.mp3`,
  fabric: `${import.meta.env.BASE_URL}assets/audio/fabric_rustle.mp3`,
  footstep: `${import.meta.env.BASE_URL}assets/audio/footstep.mp3`,
  key: `${import.meta.env.BASE_URL}assets/audio/key_jingle.mp3`,
  shopkeeperHmm: `${import.meta.env.BASE_URL}assets/audio/shopkeeper_hmm.mp3`,
  shopkeeperPlayful: `${import.meta.env.BASE_URL}assets/audio/shopkeeper_playful_mhm.mp3`,
  bottle: `${import.meta.env.BASE_URL}assets/audio/bottle_clink.mp3`,
  fruit: `${import.meta.env.BASE_URL}assets/audio/fruit_pop.mp3`,
  scan: `${import.meta.env.BASE_URL}assets/audio/barcode_scan.mp3`,
  complete: `${import.meta.env.BASE_URL}assets/audio/level_complete_woo.mp3`,
  cheer: `${import.meta.env.BASE_URL}assets/audio/level_complete_cheer.mp3`,
  bumpOops: `${import.meta.env.BASE_URL}assets/audio/bump_oops.mp3`,
  bumpOuch: `${import.meta.env.BASE_URL}assets/audio/bump_ouch.mp3`,
  // Verified Nepali “माफ गर्नुहोस्” recording — add the file when available (see CREDITS.md).
  bumpExcuse: `${import.meta.env.BASE_URL}assets/audio/ne/maaf_garnuhos.wav`,
};
const TAP_ENABLED_KEY = 'wayword.tap-sounds.enabled';
const FOOTSTEP_ONSET = 0.372;
const FOOTSTEP_DURATION = 0.16;
const FOOTSTEP_VOLUME = 0.1;
/** Quieter steps on the open market street so ambience stays on top. */
const MARKET_FOOTSTEP_VOLUME = 0.035;
const BUMP_COOLDOWN_MS = 2000;

export class EffectsController {
  private context?: AudioContext;
  private ownsContext = false;
  private buffers = new Map<EffectName, AudioBuffer>();
  private active = false;
  private hidden = document.hidden;
  private disposed = false;
  private generation = 0;
  private walking = false;
  private tapEnabled = true;
  private footstepVolume = FOOTSTEP_VOLUME;
  private nextStepAt = 0;
  private step = 0;
  private reaction = 0;
  private reactionAt = -Infinity;
  private bumpContact: Exclude<BumpKind, 'none'> | 'none' = 'none';
  private bumpAt = -Infinity;
  private bumpVariant = 0;
  private speechBusy = false;
  private effectGenerations = new Map<EffectName, number>();
  private sources = new Set<{ name: EffectName; source: AudioBufferSourceNode; gain: GainNode }>();
  private shopkeeper?: THREE.PositionalAudio;

  constructor(private listener?: THREE.AudioListener, shopkeeperAnchor?: THREE.Object3D) {
    if (listener) this.context = listener.context;
    else {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      this.context = new AudioContextConstructor();
      this.ownsContext = true;
    }
    if (shopkeeperAnchor && listener) {
      this.shopkeeper = new THREE.PositionalAudio(listener)
        .setRefDistance(1.1)
        .setRolloffFactor(1)
        .setDistanceModel('linear')
        .setMaxDistance(7);
      this.shopkeeper.gain.gain.value = 0.13;
      shopkeeperAnchor.add(this.shopkeeper);
    }
    this.buffers.set('tap', this.createTapBuffer());
    try { this.tapEnabled = localStorage.getItem(TAP_ENABLED_KEY) !== 'false'; } catch { /* Tap sounds still work without storage. */ }
    void this.load('footstep');
    void this.load('key');
    void this.load('fabric');
    void this.load('bumpOops');
    void this.load('bumpOuch');
    void this.load('bumpExcuse', true);
    for (const name of Object.keys(URLS) as (Exclude<EffectName, 'tap'>)[]) {
      if (name === 'footstep' || name === 'key' || name === 'fabric' || name === 'bumpOops' || name === 'bumpOuch' || name === 'bumpExcuse') continue;
      void this.load(name);
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    this.generation++;
    if (!active) {
      this.walking = false;
      this.clearBumpState();
      this.stopAll();
    }
  }

  /** Skip bump voice while pronunciation or other important speech is playing. */
  setSpeechBusy(busy: boolean) {
    this.speechBusy = busy;
  }

  isSpeechBusy() {
    return this.speechBusy;
  }

  /** Soften or restore footsteps (e.g. quieter on the market street). */
  setFootstepVolume(volume: number) {
    this.footstepVolume = Math.max(0, volume);
  }

  useMarketFootsteps(enabled: boolean) {
    this.footstepVolume = enabled ? MARKET_FOOTSTEP_VOLUME : FOOTSTEP_VOLUME;
  }

  footstep() {
    if (this.hasActive('footstep')) return;
    const playbackRate = this.step++ % 2 ? 1.035 : 0.97;
    void this.play('footstep', this.footstepVolume, FOOTSTEP_ONSET, FOOTSTEP_DURATION, playbackRate);
  }

  bindTapControls(root:HTMLElement,button:HTMLButtonElement){
    const render=()=>{
      button.textContent=`Tap: ${this.tapEnabled?'On':'Off'}`;
      button.setAttribute('aria-pressed',String(this.tapEnabled));
      button.setAttribute('aria-label',this.tapEnabled?'Mute tap sounds':'Turn tap sounds on');
    };
    const toggle=()=>{
      if(this.tapEnabled)this.tap();
      this.tapEnabled=!this.tapEnabled;
      try{localStorage.setItem(TAP_ENABLED_KEY,String(this.tapEnabled));}catch{/* The setting remains active for this page. */}
      render();
    };
    const tap=(event:MouseEvent)=>{
      if(event.detail===0||!this.tapEnabled)return;
      const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button'):null;
      if(target&&!target.disabled)this.tap();
    };
    render();
    button.addEventListener('click',toggle);
    root.addEventListener('click',tap);
    return()=>{
      button.removeEventListener('click',toggle);
      root.removeEventListener('click',tap);
    };
  }

  tap() {
    if (!this.tapEnabled || this.hasActive('tap')) return;
    void this.play('tap', 0.055, 0, 0.09, 1, true);
  }

  get soundsEnabled() { return this.tapEnabled; }

  setWalking(walking: boolean, now = performance.now(), interval = 520) {
    if (!walking || !this.active || this.hidden || this.disposed) {
      if (this.walking) this.stopEffect('footstep');
      this.walking = false;
      this.nextStepAt = 0;
      return;
    }
    if (!this.walking) this.nextStepAt = now;
    this.walking = true;
    if (now < this.nextStepAt) return;
    // Keep retrying on the next movement frame if decoding is not ready yet,
    // rather than turning a missed first contact into a full-cadence delay.
    if(!this.buffers.has('footstep'))return;
    this.footstep();
    this.nextStepAt = now + interval;
  }

  bagRustle() {
    void this.play('bag', 0.11, 0.05, 0.85, 1);
  }

  /** Soft plush/fabric rustle for the lost teddy — once per successful pickup. */
  fabricRustle() {
    if (this.hasActive('fabric')) return;
    void this.play('fabric', 0.07, 0.35, 0.42, 1);
  }

  keyJingle() {
    if(this.hasActive('key'))return;
    void this.play('key', 0.055, 6.82, 1, 1, true);
  }

  /**
   * Soft player voice on a real walk collision. Plays once at initial contact;
   * sustained pressure needs separation before the same contact can fire again.
   * NPC collisions take priority at the call site; speech already playing skips
   * the line instead of queueing it.
   */
  noteBump(kind: BumpKind) {
    if (kind === 'none') {
      this.bumpContact = 'none';
      return;
    }
    if (this.bumpContact !== 'none') return;
    this.bumpContact = kind;
    if (!this.active || this.hidden || this.disposed || this.speechBusy) return;
    if (this.shopkeeper?.isPlaying) return;
    if (this.hasActive('bumpOops') || this.hasActive('bumpOuch') || this.hasActive('bumpExcuse')) return;
    const now = performance.now();
    if (now - this.bumpAt < BUMP_COOLDOWN_MS) return;
    if (kind === 'person') {
      if (!this.buffers.has('bumpExcuse')) return;
      this.bumpAt = now;
      void this.play('bumpExcuse', 0.08, 0, 1.2, 1);
      return;
    }
    this.bumpAt = now;
    const soft = this.bumpVariant++ % 2 === 0;
    if (soft) void this.play('bumpOops', 0.07, 0, 0.55, 1);
    else void this.play('bumpOuch', 0.06, 0, 0.45, 1.02);
  }

  bottlePickup() {
    void this.play('bottle', 0.09, 0, 0.6, 1);
  }

  fruitPickup() {
    void this.play('fruit', 0.11, 0, 0.65, this.step++ % 2 ? 1.04 : 0.98);
    void this.play('bag', 0.05, 0.18, 0.55, 1.08);
  }

  barcodeScan() {
    void this.play('scan', 0.085, 0, 0.35, 1);
  }

  levelComplete() {
    void this.play('complete', 0.17, 0, 2.5, 0.94, true);
    void this.play('cheer', 0.075, 0, 4.5, 1, true);
  }

  cancel() {
    this.generation++;
    this.walking = false;
    this.nextStepAt = 0;
    this.clearBumpState();
    this.stopAll();
  }

  private clearBumpState() {
    this.bumpContact = 'none';
    this.bumpAt = -Infinity;
  }

  isCharacterSpeaking() {
    return Boolean(this.shopkeeper?.isPlaying);
  }

  shopkeeperReaction() {
    if (!this.context || !this.shopkeeper || !this.active || this.hidden || this.shopkeeper.isPlaying || this.speechBusy) return;
    const now = performance.now();
    if (now - this.reactionAt < 1800) return;
    const buffer = this.buffers.get(this.reaction++ % 2 ? 'shopkeeperPlayful' : 'shopkeeperHmm');
    if (!buffer) return;
    const generation = this.generation;
    void this.context.resume().then(() => {
      if (this.disposed || this.hidden || !this.active || generation !== this.generation || this.shopkeeper?.isPlaying) return;
      this.reactionAt = performance.now();
      this.shopkeeper!.setBuffer(buffer);
      this.shopkeeper!.setPlaybackRate(this.step++ % 2 ? 1.03 : 0.97);
      this.shopkeeper!.play();
    }).catch(() => { /* A later meaningful checkout action can retry. */ });
  }

  private async load(name: Exclude<EffectName, 'tap'>, optional = false) {
    try {
      const response = await fetch(URLS[name]);
      if (!response.ok) throw new Error(`Effect request failed with ${response.status}`);
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.buffers.set(name, buffer);
    } catch (error) {
      if (!this.disposed && !optional) console.warn(`The ${name} sound effect could not be loaded.`, error);
    }
  }

  private createTapBuffer(){
    const context=this.context!,duration=.09,length=Math.ceil(context.sampleRate*duration),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++){
      const time=i/context.sampleRate,envelope=Math.sin(Math.min(1,time/.006)*Math.PI/2)*Math.exp(-time*42);
      data[i]=(Math.sin(time*Math.PI*2*430)+Math.sin(time*Math.PI*2*645)*.18)*envelope*.7;
    }
    return buffer;
  }

  private async play(name: EffectName, volume: number, offset: number, duration: number, playbackRate: number, allowInactive = false) {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context || (!this.active && !allowInactive) || this.hidden || this.disposed) return;
    const generation = this.generation;
    const effectGeneration = this.effectGenerations.get(name) ?? 0;
    try {
      await this.context.resume();
      if ((!this.active && !allowInactive) || this.hidden || this.disposed || generation !== this.generation || effectGeneration !== (this.effectGenerations.get(name) ?? 0)) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.listener?.getInput() ?? this.context.destination);
      const nodes = { name, source, gain };
      this.sources.add(nodes);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.sources.delete(nodes);
      };
      source.start(0, Math.min(offset, Math.max(0, buffer.duration - 0.05)), Math.min(duration, buffer.duration));
    } catch { /* Effects are optional; the next user action can retry. */ }
  }

  private hasActive(name: EffectName) {
    for (const nodes of this.sources) if (nodes.name === name) return true;
    return false;
  }

  private stopEffect(name: EffectName) {
    this.effectGenerations.set(name, (this.effectGenerations.get(name) ?? 0) + 1);
    for (const nodes of [...this.sources]) {
      if (nodes.name !== name) continue;
      nodes.source.onended = null;
      try { nodes.source.stop(); } catch { /* Already stopped. */ }
      nodes.source.disconnect();
      nodes.gain.disconnect();
      this.sources.delete(nodes);
    }
  }

  private stopAll() {
    for (const { source, gain } of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Already stopped. */ }
      source.disconnect();
      gain.disconnect();
    }
    this.sources.clear();
    if (this.shopkeeper?.isPlaying) this.shopkeeper.stop();
  }

  private onVisibilityChange = () => {
    this.hidden = document.hidden;
    if (this.hidden) {
      this.generation++;
      this.walking = false;
      this.nextStepAt = 0;
      this.clearBumpState();
      this.stopAll();
    }
  };

  dispose() {
    this.disposed = true;
    this.generation++;
    this.clearBumpState();
    this.stopAll();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.shopkeeper?.parent?.remove(this.shopkeeper);
    this.shopkeeper?.gain.disconnect();
    this.buffers.clear();
    if (this.ownsContext) void this.context?.close().catch(() => {});
  }
}
