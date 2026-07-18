/**
 * Audio manager for game sound effects.
 *
 * Pre-loads the audio element once and reuses it. Calling `play()` while
 * already playing restarts from the beginning so sounds never overlap.
 */

let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio('/fahhhhh.mp3');
    audioEl.preload = 'auto';
  }
  return audioEl;
}

/** Play the wrong-answer sound. Stops any current playback first. */
export function playWrongAnswerSound(): void {
  try {
    const audio = getAudio();
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // Audio playback is best-effort — never break game flow.
  }
}
