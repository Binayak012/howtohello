/** Original vector scenery for the full-screen learning map. */
const trees = [
  [105, 470, 1.15], [175, 540, .8], [72, 610, .7],
  [1370, 330, 1], [1480, 410, 1.25], [1390, 520, .8],
  [1130, 720, 1.12], [1215, 780, .8], [1400, 805, 1.3],
  [420, 290, .7], [540, 345, .65], [440, 830, .72],
];
const flowers = [
  [285, 480, '#f4b63f'], [313, 505, '#fff6e8'], [273, 520, '#f4b63f'],
  [1330, 600, '#f26b75'], [1354, 617, '#fff6e8'], [1305, 630, '#f4b63f'],
  [1055, 815, '#f4b63f'], [1080, 837, '#f26b75'], [1033, 845, '#fff6e8'],
  [600, 710, '#f26b75'], [625, 734, '#f4b63f'], [580, 741, '#fff6e8'],
  [840, 330, '#f4b63f'], [868, 350, '#fff6e8'], [818, 355, '#f26b75'],
];
export const mapNatureMarkup = `<svg class="map-nature" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="map-meadow" x2="0" y2="1"><stop stop-color="#d9e9c8"/><stop offset="1" stop-color="#b6d791"/></linearGradient>
  <linearGradient id="map-water" x2="1" y2="1"><stop stop-color="#9cdbd1"/><stop offset="1" stop-color="#5ebbb9"/></linearGradient>
  <linearGradient id="map-canopy" x2=".8" y2="1"><stop stop-color="#70b98c"/><stop offset="1" stop-color="#3d8a70"/></linearGradient>
  <g id="map-tree-shape">
    <ellipse cy="65" rx="42" ry="12" fill="#2b4b3c" opacity=".12"/>
    <path d="M-7 8v52q7 7 14 0V8" fill="#b48c61"/><path d="M-3 15v39" stroke="#e9cc9a" stroke-width="3" stroke-linecap="round"/>
    <path d="M-33 26C-66 22-58-16-36-20-43-53-8-72 12-51 43-61 62-28 44-9 67 16 39 46 13 33-3 49-28 46-33 26Z" fill="#34775e"/>
    <path d="M-33 20C-66 16-58-22-36-26-43-59-8-78 12-57 43-67 62-34 44-15 67 10 39 40 13 27-3 43-28 40-33 20Z" fill="url(#map-canopy)"/>
    <path d="M-30-24Q-23-49-5-49" fill="none" stroke="#b8db9e" stroke-width="6" stroke-linecap="round" opacity=".55"/>
  </g>
  <g id="map-flower-shape"><path d="M0 1v15m0-3q-10 0-10-6 10-1 10 6m0-5q9 0 9-5-8-1-9 5" fill="#4d946d" stroke="#4d946d" stroke-width="2"/><g fill="currentColor"><circle cx="-4" cy="-4" r="4"/><circle cx="4" cy="-4" r="4"/><circle cx="-4" cy="3" r="4"/><circle cx="4" cy="3" r="4"/></g><circle r="3" fill="#f4b63f"/></g>
</defs>
<path d="M0 0H1600V900H0Z" fill="url(#map-meadow)"/>
<path d="M-100 370Q190 225 440 370T930 330 1680 290V910H-100Z" fill="#c7dfa5"/>
<path d="M-80 640Q210 400 505 575T1000 500 1700 570V920H-80Z" fill="#a5cd91"/>
<path d="M870 920Q1045 555 1385 625T1670 680V950Z" fill="#90c48d"/>
<path d="M-90 870Q155 680 440 805T850 950H-90Z" fill="#c9dea0"/>
<path class="nature-stream" d="M-30 432C220 427 130 594 242 648S214 816 515 950" fill="none" stroke="#e2dbb1" stroke-width="75" stroke-linecap="round"/>
<path class="nature-stream" d="M-30 432C220 427 130 594 242 648S214 816 515 950" fill="none" stroke="url(#map-water)" stroke-width="54" stroke-linecap="round"/>
<g class="nature-stream" fill="none" stroke="#e9fff3" stroke-width="3" stroke-linecap="round" opacity=".65"><path class="nature-ripples" d="m123 493 20 8m40 124 19 11m62 86 21 10m-13 79 28 17m53 38 27 13"/></g>
<g class="nature-stream" fill="none" stroke="#effff6" stroke-linecap="round"><path class="nature-river-current" d="M-30 432C220 427 130 594 242 648S214 816 515 950" stroke-width="2.5" stroke-dasharray="18 87 36 110" opacity=".43"/><path class="nature-river-current nature-river-current-soft" d="M-30 432C220 427 130 594 242 648S214 816 515 950" transform="translate(8 -3)" stroke-width="1.6" stroke-dasharray="10 120 24 95" opacity=".32"/></g>
<g fill="#568e5e" opacity=".28"><path d="m460 486 4-17 4 17 7-10 2 13m534 148 5-15 4 17 7-10 1 12m-600 42 5-17 4 17 6-10 1 12m741-235 4-16 5 16 5-9 2 11"/></g>
${trees.map(([x, y, scale], i) => `<g class="nature-tree nature-tree-${i}" transform="translate(${x} ${y}) scale(${scale})" style="--wind-duration:${4.6 + i % 5 * .45}s;--wind-delay:-${i * .73}s"><g class="nature-tree-pop"><g class="nature-tree-wind"><use href="#map-tree-shape"/></g></g></g>`).join('')}
${flowers.map(([x, y, color], i) => `<g class="nature-flower nature-flower-${i}" style="--wind-duration:${3.5 + i % 6 * .35}s;--wind-delay:-${i * .47}s"><g transform="translate(${x} ${y})"><g class="nature-flower-pop"><g class="nature-flower-wind"><use href="#map-flower-shape" style="color:${color}"/></g></g></g></g>`).join('')}
<g fill="#a8aa96" stroke="#e1e0c9" stroke-width="2"><path d="M330 662q8-18 28-7l8 16q-14 9-37 1Z"/><path d="M350 685q8-12 20-3l3 10-25 1Z"/><path d="M1280 820q10-15 27-4l4 13-34 1Z"/></g>
<g fill="none" stroke="#66756c" stroke-width="3" stroke-linecap="round" opacity=".45"><path d="M1060 215q10-12 20 0 10-12 20 0M1110 240q7-8 14 0 7-8 14 0"/></g>
</svg>`;
