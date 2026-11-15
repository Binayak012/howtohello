/**
 * The howtohello logo, shared by the website and every chapter.
 * Mark: a speech bubble with a friendly face (saying hello) and a gold sparkle. Wordmark: howto·hello.
 */
import './brand.css';

export const logoMark = `<svg class="logo-mark" viewBox="0 0 50 48" aria-hidden="true" focusable="false"><path class="logo-shadow" d="M15 8h16a11 11 0 0 1 11 11v8a11 11 0 0 1-11 11H21l-11 8 2.5-8.5A11 11 0 0 1 4 27v-8A11 11 0 0 1 15 8Z"/><path class="logo-bubble" d="M15 5h16a11 11 0 0 1 11 11v8a11 11 0 0 1-11 11H21l-11 8 2.5-8.5A11 11 0 0 1 4 24v-8A11 11 0 0 1 15 5Z"/><path class="logo-shine" d="M11 12.5a7 7 0 0 1 5.5-3.5"/><circle class="logo-face" cx="17.5" cy="17.5" r="2.4"/><circle class="logo-face" cx="28.5" cy="17.5" r="2.4"/><path class="logo-smile" d="M16 23.5q7 6.5 14 0"/><path class="logo-spark" d="M43 0l1.7 4.3L49 6l-4.3 1.7L43 12l-1.7-4.3L37 6l4.3-1.7Z"/></svg>`;
export const logoWord = `<b class="logo-word"><span class="logo-how">howto</span><span class="logo-hello">hello</span><span class="logo-dot">.</span></b>`;
/** Mark and wordmark together, for inside a home link. */
export const logo = logoMark + logoWord;
export const brandName = 'howtohello';
