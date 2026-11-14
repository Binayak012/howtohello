import * as THREE from 'three';

type EffectName = 'bag' | 'footstep' | 'shopkeeperHmm' | 'shopkeeperPlayful' | 'bottle' | 'fruit' | 'scan' | 'complete' | 'cheer';

const URLS: Record<EffectName, string> = {
  bag: `${import.meta.env.BASE_URL}assets/audio/bag_rustle.mp3`,
  footstep: `${import.meta.env.BASE_URL}assets/audio/footstep.mp3`,
  shopkeeperHmm: `${import.meta.env.BASE_URL}assets/audio/shopkeeper_hmm.mp3`,
  shopkeeperPlayful: `${import.meta.env.BASE_URL}assets/audio/shopkeeper_playful_mhm.mp3`,
  bottle: `${import.meta.env.BASE_URL}assets/audio/bottle_clink.mp3`,
  fruit: `${import.meta.env.BASE_URL}assets/audio/fruit_pop.mp3`,
  scan: `${import.meta.env.BASE_URL}assets/audio/barcode_scan.mp3`,
  complete: `${import.meta.env.BASE_URL}assets/audio/level_complete_woo.mp3`,
  cheer: `${import.meta.env.BASE_URL}assets/audio/level_complete_cheer.mp3`,
};

export class EffectsController {
  private context?: AudioContext;
  private buffers = new Map<EffectName, AudioBuffer>();
  private active = false;
  private hidden = document.hidden;
  private disposed = false;
  private generation = 0;
  private step = 0;
  private reaction = 0;
  private reactionAt = -Infinity;
  private sources = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  private shopkeeper?: THREE.PositionalAudio;

  constructor(private listener?: THREE.AudioListener, shopkeeperAnchor?: THREE.Object3D) {
    if (!listener) return;
    this.context = listener.context;
    if (shopkeeperAnchor) {
      this.shopkeeper = new THREE.PositionalAudio(listener)
        .setRefDistance(1.1)
        .setRolloffFactor(1)
        .setDistanceModel('linear')
        .setMaxDistance(7);
      this.shopkeeper.gain.gain.value = 0.13;
      shopkeeperAnchor.add(this.shopkeeper);
    }
    for (const name of Object.keys(URLS) as EffectName[]) void this.load(name);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    this.generation++;
    if (!active) this.stopAll();
  }

  footstep() {
    const playbackRate = this.step++ % 2 ? 1.035 : 0.97;
    void this.play('footstep', 0.1, 0, 0.48, playbackRate);
  }

  bagRustle() {
    void this.play('bag', 0.11, 0.05, 0.85, 1);
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
    this.stopAll();
  }

  shopkeeperReaction() {
    if (!this.context || !this.shopkeeper || !this.active || this.hidden || this.shopkeeper.isPlaying) return;
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

  private async load(name: EffectName) {
    try {
      const response = await fetch(URLS[name]);
      if (!response.ok) throw new Error(`Effect request failed with ${response.status}`);
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.buffers.set(name, buffer);
    } catch (error) {
      if (!this.disposed) console.warn(`The ${name} sound effect could not be loaded.`, error);
    }
  }

  private async play(name: EffectName, volume: number, offset: number, duration: number, playbackRate: number, allowInactive = false) {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context || !this.listener || (!this.active && !allowInactive) || this.hidden || this.disposed) return;
    const generation = this.generation;
    try {
      await this.context.resume();
      if ((!this.active && !allowInactive) || this.hidden || this.disposed || generation !== this.generation) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.listener.getInput());
      const nodes = { source, gain };
      this.sources.add(nodes);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.sources.delete(nodes);
      };
      source.start(0, Math.min(offset, Math.max(0, buffer.duration - 0.05)), Math.min(duration, buffer.duration));
    } catch { /* Effects are optional; the next user action can retry. */ }
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
      this.stopAll();
    }
  };

  dispose() {
    this.disposed = true;
    this.generation++;
    this.stopAll();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.shopkeeper?.parent?.remove(this.shopkeeper);
    this.shopkeeper?.gain.disconnect();
    this.buffers.clear();
  }
}
