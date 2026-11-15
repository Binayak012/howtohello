/** Bundled Nepali word clips for the shop greeting and direction cards. */
export const shopPronunciations = {
  namaste: { word: 'नमस्ते', clip: 'namaste' },
  right: { word: 'दायाँ', clip: 'daaya' },
  left: { word: 'बायाँ', clip: 'baaya' },
  forward: { word: 'अगाडि', clip: 'agadi' },
  backward: { word: 'पछाडि', clip: 'pachhadi' },
} as const;

export type ShopPronunciationId = keyof typeof shopPronunciations;

export const speakerIcon = `<svg class="word-speaker" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/><path class="speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>`;

type PronunciationHooks = {
  onPlayingChange?: (playing: boolean) => void;
  duckRadio?: () => void;
  restoreRadio?: () => void;
  isCharacterSpeaking?: () => boolean;
};

/**
 * Plays one verified Nepali recording at a time. Stops the previous clip instead
 * of queueing, and never falls back to an English voice reading Nepali text.
 */
export class WordPronouncer {
  private audio = new Audio();
  private revision = 0;
  private disposed = false;
  private playing = false;
  private speakingButton?: HTMLElement;

  constructor(private hooks: PronunciationHooks = {}) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', this.onEnded);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  hearLabel(word: string) {
    return `Hear ${word} pronounced`;
  }

  play(id: ShopPronunciationId, button?: HTMLElement) {
    if (this.disposed) return;
    if (this.hooks.isCharacterSpeaking?.()) return;
    const entry = shopPronunciations[id];
    const request = ++this.revision;
    const alreadyPlaying = this.playing;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.clearSpeaking();
    this.audio.src = `${import.meta.env.BASE_URL}assets/audio/ne/${entry.clip}.wav`;
    this.audio.load();
    this.speakingButton = button;
    button?.classList.add('is-speaking');
    button?.setAttribute('aria-busy', 'true');
    this.setPlaying(true);
    if (!alreadyPlaying) this.hooks.duckRadio?.();
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
    this.audio.pause();
    this.audio.currentTime = 0;
    this.finish();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.audio.removeEventListener('ended', this.onEnded);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.removeAttribute('src');
    this.audio.load();
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
