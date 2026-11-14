/** Vector clay treatment: raised land, a soft ocean, and small cloud puffs. */
export const earthClouds: [number, number][] = [[-45, 32], [35, -20], [125, 22]];
export const clayEarthSvg = `<svg class="journey-globe" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg"><defs>
<radialGradient id="journey-ocean" cx="30%" cy="23%" r="86%"><stop stop-color="#89d1c5"/><stop offset=".5" stop-color="#4daba2"/><stop offset="1" stop-color="#267c7b"/></radialGradient>
<linearGradient id="journey-grass" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#e0e7a8"/><stop offset=".45" stop-color="#b9d48b"/><stop offset="1" stop-color="#8fbb7c"/></linearGradient>
<radialGradient id="journey-sphere-light" cx="33%" cy="25%" r="80%"><stop stop-color="#fff6e8" stop-opacity=".18"/><stop offset=".55" stop-color="#fff6e8" stop-opacity="0"/><stop offset="1" stop-color="#145454" stop-opacity=".2"/></radialGradient>
<clipPath id="journey-circle"><circle cx="120" cy="120" r="96"/></clipPath></defs>
<ellipse cx="120" cy="218" rx="65" ry="9" fill="#5c5470" opacity=".06"/>
<g clip-path="url(#journey-circle)"><circle cx="120" cy="120" r="96" fill="url(#journey-ocean)"/>
<path class="journey-land-layer" fill="#568e65" stroke="#568e65" stroke-width="1.1" stroke-linejoin="round" transform="translate(0 1.6)"/>
<path class="journey-land-layer" fill="url(#journey-grass)" stroke="#d8e4ad" stroke-width=".6" stroke-linejoin="round"/>
<circle cx="120" cy="120" r="96" fill="url(#journey-sphere-light)"/>
<ellipse cx="79" cy="56" rx="19" ry="6" transform="rotate(-32 79 56)" fill="#fffcf6" opacity=".18"/>
${earthClouds.map(() => `<g class="earth-cloud"><path d="M-12 3q-5-5 0-8 0-7 7-5 4-7 10-2 7-2 8 5 7 2 4 7Z" fill="#266967" opacity=".12" transform="translate(0 2)"/><path d="M-12 3q-5-5 0-8 0-7 7-5 4-7 10-2 7-2 8 5 7 2 4 7Z" fill="#fffcf6"/><path d="M-8-6q1-3 4-2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/></g>`).join('')}
<circle class="journey-dusk-shade" cx="120" cy="120" r="96" fill="#b9a7e8" opacity="0"/></g></svg>`;
