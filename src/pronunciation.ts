import * as THREE from 'three';

/** Bundled Nepali word clips for shop cards and market conversations. */
export const wordPronunciations = {
  namaste: { word: 'नमस्ते', clip: 'namaste' },
  right: { word: 'दायाँ', clip: 'daaya' },
  left: { word: 'बायाँ', clip: 'baaya' },
  forward: { word: 'अगाडि', clip: 'agadi' },
  backward: { word: 'पछाडि', clip: 'pachhadi' },
  thanks: { word: 'धन्यवाद', clip: 'dhanyabaad' },
  ok: { word: 'हुन्छ', clip: 'hunchha' },
} as const;

export type PronunciationId = keyof typeof wordPronunciations;
/** @deprecated Prefer PronunciationId — kept for shop call sites. */
export type ShopPronunciationId = PronunciationId;
export const shopPronunciations = wordPronunciations;

/** Recurring characters who can speak verified Nepali dialogue clips. */
export type VoiceSpeakerId = 'player' | 'maya' | 'arun' | 'tara' | 'parent' | 'shopkeeper';

/**
 * Shared voice profiles. Player learning/preview clips use Chitwan in `ne/`.
 * NPC dialogue uses distinct Piper Google Nepali speakers under `ne/speakers/`.
 */
export const voiceProfiles: Record<VoiceSpeakerId, {
  label: string;
  /** Folder under assets/audio/ holding this speaker’s clips. */
  folder: string;
  spatial: boolean;
}> = {
  player: { label: 'You', folder: 'ne', spatial: false },
  maya: { label: 'Maya', folder: 'ne/speakers/maya', spatial: true },
  arun: { label: 'Arun', folder: 'ne/speakers/arun', spatial: true },
  tara: { label: 'Tara', folder: 'ne/speakers/tara', spatial: true },
  parent: { label: 'Parent', folder: 'ne/speakers/parent', spatial: true },
  shopkeeper: { label: 'Shopkeeper', folder: 'ne/speakers/shopkeeper', spatial: true },
};

export const speakerIcon = `<svg class="word-speaker" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/><path class="speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>`;

type PronunciationHooks = {
  listener?: THREE.AudioListener;
  onPlayingChange?: (playing: boolean) => void;
  duckRadio?: () => void;
  restoreRadio?: () => void;
  isCharacterSpeaking?: () => boolean;
};

export type PlayOptions = {
  button?: HTMLElement;
  /** Who is speaking this line. Defaults to player (centered). */
  speaker?: VoiceSpeakerId;
  /** World anchor for spatial NPC lines. */
  anchor?: THREE.Object3D;
};

/**
 * Plays one verified Nepali recording at a time. Dialogue lines use the
 * assigned speaker’s voice; pronunciation-preview UI keeps the shared player
 * clips. Never falls back to an English voice reading Nepali text.
 */
export class WordPronouncer {
  private audio = new Audio();
  private revision = 0;
  private disposed = false;
  private playing = false;
  private speakingButton?: HTMLElement;
  private spatial?: THREE.PositionalAudio;
  private spatialAnchor?: THREE.Object3D;
  private buffers = new Map<string, AudioBuffer>();

  constructor(private hooks: PronunciationHooks = {}) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', this.onEnded);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (hooks.listener) {
      this.spatial = new THREE.PositionalAudio(hooks.listener)
        .setRefDistance(1.6)
        .setRolloffFactor(1.1)
        .setDistanceModel('linear')
        .setMaxDistance(14);
      this.spatial.setVolume(0.85);
    }
  }

  hearLabel(word: string) {
    return `Hear ${word} pronounced`;
  }

  /** Pronunciation-preview / player-centered playback (shop cards, player replies). */
  play(id: PronunciationId, button?: HTMLElement) {
    this.speak(id, { button, speaker: 'player' });
  }

  /** Character dialogue with an explicit speaker profile. */
  speak(id: PronunciationId, options: PlayOptions = {}) {
    if (this.disposed) return;
    if (this.hooks.isCharacterSpeaking?.()) return;
    const speaker = options.speaker ?? 'player';
    const profile = voiceProfiles[speaker];
    const entry = wordPronunciations[id];
    const url = `${import.meta.env.BASE_URL}assets/audio/${profile.folder}/${entry.clip}.wav`;
    const button = options.button;
    const request = ++this.revision;
    const alreadyPlaying = this.playing;
    this.stopCurrentMedia();
    this.clearSpeaking();
    this.speakingButton = button;
    button?.classList.add('is-speaking');
    button?.setAttribute('aria-busy', 'true');
    this.setPlaying(true);
    if (!alreadyPlaying) this.hooks.duckRadio?.();

    const useSpatial = profile.spatial && this.spatial && options.anchor && this.hooks.listener;
    if (useSpatial) {
      void this.playSpatial(url, options.anchor!, request, button);
      return;
    }
    this.audio.src = url;
    this.audio.load();
    void this.audio.play().then(() => {
      if (request !== this.revision || this.disposed) return;
      button?.removeAttribute('aria-busy');
    }).catch(() => {
      if (request !== this.revision || this.disposed) return;
      this.finish();
    });
  }

  stop() {
    if (this.disposed && !this.playing) return;
    this.revision++;
    this.stopCurrentMedia();
    this.finish();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.audio.removeEventListener('ended', this.onEnded);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.removeAttribute('src');
    this.audio.load();
    this.spatial?.parent?.remove(this.spatial);
    this.spatial?.gain.disconnect();
    this.spatial = undefined;
    this.buffers.clear();
  }

  private async playSpatial(url: string, anchor: THREE.Object3D, request: number, button?: HTMLElement) {
    try {
      const buffer = await this.loadBuffer(url);
      if (request !== this.revision || this.disposed || !this.spatial || !this.hooks.listener) {
        this.finish();
        return;
      }
      await this.hooks.listener.context.resume();
      if (request !== this.revision || this.disposed || !this.spatial) {
        this.finish();
        return;
      }
      if (this.spatial.parent !== anchor) {
        this.spatial.parent?.remove(this.spatial);
        anchor.add(this.spatial);
        this.spatialAnchor = anchor;
      }
      if (this.spatial.isPlaying) this.spatial.stop();
      this.spatial.setBuffer(buffer);
      this.spatial.play();
      button?.removeAttribute('aria-busy');
      const duration = Math.max(0.2, buffer.duration * 1000 + 40);
      window.setTimeout(() => {
        if (request !== this.revision || this.disposed) return;
        if (!this.spatial?.isPlaying) this.finish();
      }, duration);
      // PositionalAudio has no reliable ended callback across three versions; poll briefly.
      const started = performance.now();
      const poll = () => {
        if (request !== this.revision || this.disposed) return;
        if (!this.spatial?.isPlaying || performance.now() - started > duration + 200) {
          this.finish();
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    } catch {
      if (request !== this.revision || this.disposed) return;
      this.finish();
    }
  }

  private async loadBuffer(url: string) {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Dialogue clip failed with ${response.status}`);
    const buffer = await this.hooks.listener!.context.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(url, buffer);
    return buffer;
  }

  private stopCurrentMedia() {
    this.audio.pause();
    this.audio.currentTime = 0;
    if (this.spatial?.isPlaying) this.spatial.stop();
  }

  private finish() {
    const wasPlaying = this.playing;
    this.setPlaying(false);
    this.clearSpeaking();
    if (wasPlaying) this.hooks.restoreRadio?.();
  }

  private clearSpeaking() {
    this.speakingButton?.classList.remove('is-speaking');
    this.speakingButton?.removeAttribute('aria-busy');
    this.speakingButton = undefined;
  }

  private setPlaying(value: boolean) {
    if (this.playing === value) return;
    this.playing = value;
    this.hooks.onPlayingChange?.(value);
  }

  private onEnded = () => this.finish();

  private onVisibility = () => {
    if (document.hidden) this.stop();
  };
}
