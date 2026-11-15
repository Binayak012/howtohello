export const vowelSounds = [
  { letter: 'अ', roman: 'a', hint: 'A short, relaxed “uh” sound.', clip: 'a' },
  { letter: 'आ', roman: 'ā · aa', hint: 'An open “ah” sound, like the a in father.', clip: 'aa' },
  { letter: 'इ', roman: 'i', hint: 'An “ee” sound, like the ee in see.', clip: 'i' },
  { letter: 'ई', roman: 'ī · ee', hint: 'Like इ in everyday Nepali; a different spelling.', clip: 'ii' },
  { letter: 'उ', roman: 'u', hint: 'Round your lips for a soft “oo” sound.', clip: 'u' },
];
export const speakerIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/><path class="speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>`;

/** Play the user’s bundled Nepali recordings; no browser-voice or English fallback. */
export function setupLetterPronunciation(root: HTMLElement, onPlaybackChange: (playing: boolean) => void = () => {}) {
  const button = root.querySelector<HTMLButtonElement>('#hear-letter')!;
  const description = root.querySelector<HTMLElement>('#letter-pronunciation')!;
  const status = root.querySelector<HTMLElement>('#letter-sound-status')!;
  const audio = new Audio();
  audio.preload = 'auto';
  audio.defaultPlaybackRate = 1.4;
  audio.playbackRate = 1.4;
  audio.preservesPitch = true;
  let index = 0;
  let revision = 0;
  let disposed = false;
  let playing = false;
  function setPlaying(value: boolean) {
    if (playing === value) return;
    playing = value;
    onPlaybackChange(value);
  }
  function idle() { button.classList.remove('is-speaking'); button.removeAttribute('aria-busy'); }
  function update(nextIndex: number) {
    revision++; audio.pause(); setPlaying(false); idle(); index = nextIndex;
    const sound = vowelSounds[index];
    description.innerHTML = `<strong>${sound.roman}</strong><span>${sound.hint}</span>`;
    button.setAttribute('aria-label', `Hear ${sound.letter} pronounced in Nepali`);
    button.title = `Listen to ${sound.letter}`;
    status.textContent = '';
    audio.src = `/audio/ne/${sound.clip}.wav`;
    audio.playbackRate = 1.4;
    audio.load();
  }
  button.onclick = async () => {
    if (disposed) return;
    const request = ++revision;
    audio.pause(); audio.currentTime = 0;
    button.setAttribute('aria-busy', 'true');
    setPlaying(true);
    try {
      await audio.play();
      if (request !== revision || disposed) return;
      button.removeAttribute('aria-busy'); button.classList.add('is-speaking');
      status.textContent = `Playing ${vowelSounds[index].letter}.`;
    } catch {
      if (request !== revision || disposed) return;
      setPlaying(false);
      idle(); status.textContent = 'Could not play the sound. Tap the speaker to try again.';
      description.innerHTML = `<strong>${vowelSounds[index].roman}</strong><span>Sound could not play. Try the speaker again.</span>`;
    }
  };
  audio.onended = () => { setPlaying(false); idle(); status.textContent = ''; };
  update(0);
  return {
    update,
    dispose() {
      disposed = true; revision++; audio.pause(); setPlaying(false); audio.removeAttribute('src'); audio.load();
      audio.onended = null; button.onclick = null;
    },
  };
}
