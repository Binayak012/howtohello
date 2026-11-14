/** Clay-style double doors, opening onto the supplied shop artwork. */
export const unitDoorMarkup = `<div class="unit-portal" aria-hidden="true">
  <span class="portal-speck portal-speck-one">✦</span><span class="portal-speck portal-speck-two">✧</span><span class="portal-speck portal-speck-three">✦</span>
  <div class="portal-plaque"><span>01</span> BASIC</div>
  <div class="portal-frame"><div class="portal-opening">
    <div class="portal-world"><img src="/assets/shop-scene-laptop.svg" alt=""><span class="portal-sunlight"></span></div>
    <div class="portal-light"></div>
    <div class="portal-panel portal-panel-left"><span class="portal-window"><i></i></span><span class="portal-inset"></span><span class="portal-pull"></span></div>
    <div class="portal-panel portal-panel-right"><span class="portal-window"><i></i></span><span class="portal-inset"></span><span class="portal-pull"></span></div>
    <span class="portal-lock"><svg viewBox="0 0 24 24" fill="none"><path class="portal-shackle" d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3"/><rect x="5" y="10" width="14" height="11" rx="4"/><circle cx="12" cy="15" r="1"/><path d="M12 16v2"/></svg></span>
  </div></div><div class="portal-threshold"></div><div class="portal-ground"></div>
</div>`;
