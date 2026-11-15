import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { racks, DIRECTIONS, type Player, type Rack } from './core';
import tokens from './tokens.json';
import { createStock, layouts, type ShelfUnit } from './stock';
import { GoldenMarket } from './market';
import type { MarketPose, ActivityId } from './market-world';

const c = tokens.color;
const materials = new Map<string, THREE.MeshStandardMaterial>();
const geometry = new Map<string, THREE.BufferGeometry>();
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .88, metalness: 0 }));
  return materials.get(color)!;
}
function box(parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], color: string, radius = .025) {
  const key = `${size.join(',')}:${radius}`;
  if (!geometry.has(key)) geometry.set(key, new RoundedBoxGeometry(...size, 2, radius));
  const mesh = new THREE.Mesh(geometry.get(key), material(color));
  mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
const sphere = new THREE.SphereGeometry(1, 12, 10);
function ball(parent: THREE.Object3D, at: [number, number, number], scale: [number, number, number], color: string) {
  const mesh = new THREE.Mesh(sphere, material(color)); mesh.position.set(...at); mesh.scale.set(...scale);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: THREE.Object3D, at: [number, number, number], top: number, bottom: number, height: number, color: string) {
  const key = `cyl:${top}:${bottom}:${height}`;
  if (!geometry.has(key)) geometry.set(key, new THREE.CylinderGeometry(top, bottom, height, 12));
  const mesh = new THREE.Mesh(geometry.get(key), material(color)); mesh.position.set(...at);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function contactShadow(parent: THREE.Object3D, width: number, depth: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(43,35,64,.24)'); gradient.addColorStop(1, 'rgba(43,35,64,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .014; parent.add(mesh);
}

export class ShopScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, .06, 120);
  rackGroups = new Map<string, THREE.Group>();
  itemGroups = new Map<string, THREE.Group>();
  units = new Map<string, THREE.Group>();
  pickup?: { object: THREE.Group; from: THREE.Vector3; scale: THREE.Vector3; at: number };
  hand = new THREE.Group();
  outlines = new Map<string, THREE.Group>();
  keeper?: THREE.Group;
  keeperArms: THREE.Group[] = [];
  checkoutItems = new THREE.Group();
  packedBag = new THREE.Group();
  packedContents = new THREE.Group();
  scanner?: THREE.Mesh;
  exitDoor = new THREE.Group();
  radioAnchor = new THREE.Group();
  exitReady = false;
  market: GoldenMarket;
  departure?: { at: number; done: () => void };
  arrived = false;
  thresholdGlow = new THREE.Group();
  doorLight = new THREE.SpotLight('#ffd18a', 0, 10, .48, .7, 1.4);
  marketStartedAt = 0;
  roamPose?: MarketPose;
  onMarketInteract?: (id: ActivityId) => void;
  onMarketItem?: (id:string)=>void;
  onPlayerWalking?: (walking:boolean)=>void;
  private playerWalking=false;
  carriedGoods=new THREE.Group();
  keeperGreetingAt=-10000;
  carryVisibleAt=0;
  checkout?: { items: THREE.Group[]; from: THREE.Vector3; at: number; last: number; onScan: (count: number) => void; onReady: () => void };
  raf = 0;
  observer: ResizeObserver;
  position = new THREE.Vector3(0, 1.58, 3);
  from = this.position.clone();
  target = this.position.clone();
  yaw = 0; fromYaw = 0; targetYaw = 0; movedAt = 0;
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  highlight: string | undefined;
  lastTime = 0;

  constructor(private host: HTMLElement, private onRackClick: (id: string, unitId?: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(c.cream);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-label', 'First-person shop with wooden racks on both sides, a counter and a shopkeeper ahead. Use the controls to move.');
    this.renderer.domElement.setAttribute('role', 'img');
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(c.cream);
    this.scene.fog = new THREE.Fog(c.cream, 10, 22);
    this.scene.add(new THREE.HemisphereLight('#fff7e8', '#c4c7b7', 2.1));
    const sunlight = new THREE.DirectionalLight('#fff0d3', 2.5);
    sunlight.position.set(-3, 7, 4); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 20 });
    sunlight.shadow.normalBias = .025; sunlight.shadow.bias = -.0002;
    sunlight.shadow.radius = 4; this.scene.add(sunlight);
    this.market = new GoldenMarket(this.scene);
    this.makeRoom();
    this.makeThresholdLight();
    for (const rack of racks) this.makeRack(rack);
    this.makeKeeper();
    this.scene.add(this.camera);
    this.camera.add(this.hand); this.hand.visible = false;
    this.camera.add(this.carriedGoods);this.carriedGoods.position.set(-.34,-.47,-.85);
    // First-person hand and rolled sleeve, visible only while picking one unit.
    cylinder(this.hand, [0, -.14, 0], .055, .07, .26, c.cream);
    ball(this.hand, [0, .025, 0], [.065, .095, .04], tokens.skin.T3.base);
    for (let i = 0; i < 4; i++) ball(this.hand, [-.04 + i * .026, .1, -.012], [.012, .045, .015], tokens.skin.T3.base);
    ball(this.hand, [-.07, .025, -.005], [.022, .045, .024], tokens.skin.T3.base);
    this.renderer.domElement.addEventListener('click', this.click);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(host); this.resize();
    this.animate();
  }

  resize = () => {
    const { width, height } = this.host.getBoundingClientRect();
    this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.fov = width < 650 ? 76 : 62;
    this.camera.updateProjectionMatrix();
  };

  makeRoom() {
    const room = new THREE.Group(); this.scene.add(room);
    room.name = 'shop-interior';
    box(room, [9.1, .14, 9.1], [0, -.1, 0], '#D5CCB9');
    for (let col = 0; col < 9; col++) for (let row = 0; row < 9; row++) {
      box(room, [.986, .025, .986], [col - 4, -.015, row - 4], (col + row) % 2 ? '#E9E3D6' : '#E1DACC', .008);
    }
    box(room, [9.2, 3.5, .15], [0, 1.68, -4.1], '#F1EBDD');
    box(room, [.15, 3.5, 8.3], [-4.1, 1.68, 0], '#E8E6DC');
    box(room, [.15, 3.5, 8.3], [4.1, 1.68, 0], '#F1EBDD');
    // The doorway is an actual opening; a hinged glass door opens after checkout.
    for (const x of [-2.4, 2.4]) box(room, [3.4, 3.5, .08], [x, 1.7, 4.12], '#D2E3DE');
    box(room, [8.2, .04, 1.8], [0, -.03, 4.9], '#D6C0A0', .008);
    this.exitDoor.position.set(-.65, 0, 4.02); room.add(this.exitDoor);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.64, .055), new THREE.MeshStandardMaterial({ color: '#648879', roughness: .85 }));
    glass.position.set(.65, 1.35, 0); this.exitDoor.add(glass);
    for (const y of [.65, 1.94]) box(this.exitDoor, [1.02, 1.05, .065], [.65, y, -.035], '#759887', .018);
    for (const x of [.03, 1.27]) box(this.exitDoor, [.045, 2.68, .045], [x, 1.35, 0], '#496B61', .004);
    for (const y of [.03, 2.68]) box(this.exitDoor, [1.26, .045, .045], [.65, y, 0], '#496B61', .004);
    cylinder(this.exitDoor, [1.1, 1.25, -.07], .018, .018, .28, '#496B61');
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(.65, .2), new THREE.MeshBasicMaterial({ map: this.label('EXIT', 'see you again', 512, 160), transparent: true }));
    exitSign.position.set(0, 2.91, 3.93); exitSign.rotation.y = Math.PI; room.add(exitSign);
    box(room, [8.1, .08, 8.1], [0, 3.38, 0], '#F4F0E7');
    for (const x of [-4, 4]) {
      box(room, [.08, .85, 8.1], [x, .43, 0], '#9CAFA1');
      box(room, [.12, .055, 8.1], [x, .88, 0], '#C1CDBE');
    }
    box(room, [8, .85, .06], [0, .43, -4], '#9CAFA1');
    // A real doorway is visible when the player turns around.
    for (const side of [-1, 1]) {
      // Shopfront windows and a framed glass door make the entrance legible.
      box(room, [3.4, .8, .15], [side * 2.4, .4, 4.02], '#9CAFA1');
      box(room, [3.4, .4, .15], [side * 2.4, 3.2, 4.02], '#F1EBDD');
      for (const x of [side * .75, side * 2.4, side * 4]) box(room, [.065, 2.25, .16], [x, 1.9, 3.95], '#496B61');
      for (const y of [.85, 1.9, 3]) box(room, [3.3, .06, .16], [side * 2.4, y, 3.95], '#496B61');
      const poster = this.label(side < 0 ? 'FRESH EVERY DAY' : 'YOUR NEIGHBORHOOD SHOP', side < 0 ? 'fruit · pantry · everyday essentials' : 'come in, take your time', 768, 240);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .55), new THREE.MeshBasicMaterial({ map: poster, transparent: true }));
      panel.position.set(side * 2.4, 2.3, 3.9); panel.rotation.y = Math.PI; room.add(panel);
    }
    for (const x of [-.68, .68]) box(room, [.065, 2.7, .14], [x, 1.35, 3.99], '#496B61');
    box(room, [1.36, .07, .14], [0, 2.7, 3.99], '#496B61');
    box(room, [1.4, 1, .15], [0, 3, 4.1], c.wall);
    box(room, [1.35, .025, .7], [0, .006, 3.4], '#6D897C', .025);
    for (const x of [-4, 4]) box(room, [.06, .12, 8.1], [x, .05, 0], '#6D897C');
    box(room, [8, .12, .06], [0, .05, -4], '#6D897C');
    // Wall groceries: cans, cartons and jars, at the same scale as pickable stock.
    for (const x of [-3, 3]) {
      const shelves = new THREE.Group(); shelves.position.set(x, 0, .3); this.scene.add(shelves);
      box(shelves, [.42, 1.86, 5.8], [0, .93, 0], '#D2D5C5');
      for (const y of [.27, .7, 1.13, 1.56]) {
        box(shelves, [.7, .045, 5.95], [0, y, 0], '#E6D7BE');
        box(shelves, [.03, .055, 5.95], [x < 0 ? .34 : -.34, y, 0], '#597D70', .005);
        for (let n = 0; n < 24; n++) {
          const z = -2.68 + n * .23, stockX = x < 0 ? .23 : -.23;
          const palette = ['#B29C71', '#A0B2A1', '#D8BB8B', '#B8A5A1'];
          if (n % 4 === 0) {
            cylinder(shelves, [stockX, y + .11, z], .065, .065, .17, palette[n % 3]);
            cylinder(shelves, [stockX, y + .205, z], .068, .068, .018, '#D8D7C6');
          } else {
            box(shelves, [.16, .19 + (n % 3) * .025, .15], [stockX, y + .135, z], palette[Math.floor(n / 5) % 4], .008);
            box(shelves, [.008, .06, .09], [stockX + (x < 0 ? .085 : -.085), y + .13, z], '#F6F1DF', .002);
          }
        }
      }
    }
    const counter = new THREE.Group(); counter.position.set(0, 0, -2.5); this.scene.add(counter);
    counter.name = 'checkout';
    box(counter, [2.95, .94, 1.06], [0, .47, 0], '#628675', .035);
    box(counter, [3.06, .08, 1.16], [0, .98, 0], '#E1CCAA', .025);
    for (const x of [-.95, 0, .95]) box(counter, [.84, .67, .025], [x, .48, .55], '#729381', .018);
    box(counter, [.45, .025, .5], [.8, 1.04, 0], '#435A51', .006);
    box(counter, [.24, .055, .22], [.55, 1.06, -.3], '#435A51', .012);
    box(counter, [.05, .16, .06], [.55, 1.15, -.3], '#435A51', .012);
    const screen = box(counter, [.3, .21, .035], [.55, 1.28, -.3], '#2F4843', .012); screen.rotation.x = -.22;
    box(counter, [.24, .15, .01], [.55, 1.29, -.275], '#A6C2B2', .004);
    box(counter, [.16, .06, .24], [.1, 1.07, .22], '#344C47', .008);
    this.scanner = new THREE.Mesh(new THREE.BoxGeometry(.14, .008, .2), new THREE.MeshBasicMaterial({ color: '#EB7E63', transparent: true, opacity: .8 }));
    this.scanner.position.set(.1, 1.105, .22); this.scanner.visible = false; counter.add(this.scanner);
    this.checkoutItems.name = 'checkout-items'; this.scene.add(this.checkoutItems);
    this.makePackedBag();
    // Paper bags and a small impulse-buy tray at checkout.
    for (let n = 0; n < 3; n++) box(counter, [.18, .29, .11], [-1.05 + n * .22, 1.17, -.23], '#BF9B6C', .009);
    box(counter, [.4, .045, .24], [-.67, 1.05, .27], '#AD875A', .005);
    for (let n = 0; n < 6; n++) box(counter, [.045, .035, .13], [-.83 + n * .06, 1.09, .27], ['#A36552', '#628675', '#D2AC5D'][n % 3], .004);
    this.makeRadio(counter);
    const sign = this.label('THE LITTLE SHOP', 'make yourself at home', 1024, 240);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.45, .57), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
    plaque.position.set(0, 2.66, -3.99); this.scene.add(plaque);
    for (const x of [-2.25, 2.25]) {
      cylinder(room, [x, 2.85, -1.8], .012, .012, .95, c.ink);
      cylinder(room, [x, 2.36, -1.8], .14, .24, .22, '#577D6D');
      cylinder(room, [x, 2.24, -1.8], .21, .21, .02, '#FFF4CF');
      const light = new THREE.PointLight('#ffd58d', 3, 4, 2); light.position.set(x, 2.1, -1.8); this.scene.add(light);
    }
    this.plant(2.2, -3.3);
    // Back-wall refrigerator with visible shelves and stocked bottles.
    const fridge = new THREE.Group(); fridge.position.set(-2.65, 0, -3.65); room.add(fridge);
    box(fridge, [1.05, 2.15, .62], [0, 1.075, 0], '#F4F2E8', .025);
    box(fridge, [.9, 1.86, .04], [0, 1.1, .325], '#B2CEC6', .008);
    for (const y of [.4, .85, 1.3, 1.75]) {
      box(fridge, [.87, .035, .2], [0, y, .36], '#EFF1E7', .004);
      for (let i = 0; i < 6; i++) {
        cylinder(fridge, [-.35 + i * .14, y + .13, .36], .045, .045, .22, i % 2 ? '#E3E6D3' : '#91AC9B');
        cylinder(fridge, [-.35 + i * .14, y + .255, .36], .026, .026, .03, '#597D70');
      }
    }
    for (const x of [-.48, 0, .48]) box(fridge, [.035, 1.96, .06], [x, 1.1, .48], '#536D63', .004);
    box(fridge, [.025, .4, .05], [.08, 1.12, .53], '#435A51', .004);
    // Bread and pantry display on the opposite side of the checkout.
    const pantry = new THREE.Group(); pantry.position.set(2.7, 0, -3.55); room.add(pantry);
    box(pantry, [1.05, 1.62, .5], [0, .81, 0], '#BBA07A', .02);
    for (const y of [.25, .7, 1.15]) {
      box(pantry, [1.1, .045, .61], [0, y, .04], '#DFC9A6', .01);
      for (let n = 0; n < 5; n++) {
        ball(pantry, [-.4 + n * .2, y + .095, .08], [.07, .08, .2], '#C89C5F');
        for (const z of [-.02, .08, .18]) box(pantry, [.09, .01, .014], [-.4 + n * .2, y + .17, z], '#E0BC82', .003);
      }
    }
    for (const [x, title, subtitle] of [[-2.65, 'CHILLED', 'milk & drinks'], [2.7, 'BAKED TODAY', 'bread & pantry']] as const) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .32), new THREE.MeshBasicMaterial({ map: this.label(title, subtitle, 768, 210), transparent: true }));
      panel.position.set(x, 2.3, -3.95); room.add(panel);
    }
    // Small floor runner marks the customer side of checkout without blocking the aisle.
    box(room, [2.5, .009, .55], [0, .012, -1.32], '#AFBAA5', .015);
  }

  makeRadio(counter: THREE.Group) {
    const radio = this.radioAnchor;
    radio.name = 'checkout-radio';
    radio.position.set(1.12, 1.08, .02);
    radio.scale.setScalar(.7);
    counter.add(radio);
    box(radio, [.48, .3, .22], [0, .15, 0], '#4F7468', .035);
    box(radio, [.19, .11, .012], [.105, .18, .116], '#E7D6AF', .012);
    for (let line = 0; line < 4; line++) box(radio, [.15, .008, .006], [.105, .145 + line * .023, .124], '#9B8968', .002);
    const speaker = cylinder(radio, [-.125, .16, .118], .09, .09, .016, '#293F3C');
    speaker.rotation.x = Math.PI / 2;
    const speakerCenter = cylinder(radio, [-.125, .16, .13], .032, .032, .012, '#D3B86E');
    speakerCenter.rotation.x = Math.PI / 2;
    for (const x of [.055, .16]) {
      const knob = cylinder(radio, [x, .09, .122], .022, .022, .025, '#2F4843');
      knob.rotation.x = Math.PI / 2;
    }
    const antenna = cylinder(radio, [.13, .45, -.03], .009, .009, .43, '#53645E');
    antenna.rotation.z = -.3;
    ball(radio, [.195, .66, -.03], [.018, .018, .018], '#D3B86E');
    contactShadow(radio, .65, .42);
  }

  makeThresholdLight() {
    this.thresholdGlow.name = 'doorway-sunbeam'; this.scene.add(this.thresholdGlow); this.thresholdGlow.visible = false;
    const beamGeometry = new THREE.BufferGeometry();
    beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -.58, 2.55, 4.1, .58, 2.55, 4.1, 1.15, .025, .8,
      -.58, 2.55, 4.1, 1.15, .025, .8, -1.15, .025, .8,
      -.58, .05, 4.1, .58, .05, 4.1, 1.15, .025, .8,
      -.58, .05, 4.1, 1.15, .025, .8, -1.15, .025, .8,
    ], 3));
    const beamMaterial = new THREE.MeshBasicMaterial({ color: '#ffd487', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.thresholdGlow.add(new THREE.Mesh(beamGeometry, beamMaterial));
    this.doorLight.position.set(0, 2.9, 5.3); this.doorLight.target.position.set(0, .3, 1.8);
    this.thresholdGlow.add(this.doorLight, this.doorLight.target);

  }

  label(title: string, subtitle: string, width: number, height: number) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = c.card; ctx.beginPath(); ctx.roundRect(0, 0, width, height, 40); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = c.teal;
    ctx.font = `700 ${width * .057}px sans-serif`; ctx.fillText(title, width / 2, height * .47);
    ctx.font = `400 ${width * .026}px sans-serif`; ctx.fillStyle = c.muted; ctx.fillText(subtitle, width / 2, height * .74);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }

  plant(x: number, z: number) {
    const group = new THREE.Group(); group.position.set(x, 0, z); this.scene.add(group);
    cylinder(group, [0, .23, 0], .23, .16, .46, c.coral);
    cylinder(group, [0, .46, 0], .24, .24, .04, c.coral_d);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const leaf = ball(group, [Math.sin(angle) * .18, .74 + (i % 2) * .13, Math.cos(angle) * .18], [.1, .32, .07], i % 2 ? c.teal : '#36948C');
      leaf.rotation.set(Math.cos(angle) * .5, angle, Math.sin(angle) * -.5);
    }
    contactShadow(group, .9, .9);
  }

  makeRack(rack: Rack) {
    const group = new THREE.Group(); group.position.set(rack.col - 4, 0, rack.row - 4);
    group.rotation.y = rack.col === 2 ? Math.PI / 2 : -Math.PI / 2;
    group.userData.rackId = rack.id; this.scene.add(group); this.rackGroups.set(rack.id, group);
    const produce = rack.item === 'fruit';
    box(group, [.86, 1.48, .045], [0, .78, -.255], produce ? '#B89A70' : '#D4D9CA', .008);
    box(group, [.86, .2, .58], [0, .1, .02], '#7E9987', .012);
    for (const x of [-.425, .425]) {
      box(group, [.04, 1.5, .045], [x, .77, .29], '#7C9482', .008);
      box(group, [.04, 1.5, .045], [x, .77, -.255], '#7C9482', .008);
    }
    for (const y of [.28, .66, 1.04, 1.46]) {
      box(group, [.9, .035, .6], [0, y, .02], '#DED1B5', .008);
      box(group, [.9, .05, .025], [0, y - .012, .33], '#536F60', .004);
      if (produce && y < 1.4) {
        for (const x of [-.42, .42]) box(group, [.025, .09, .54], [x, y + .06, .025], '#C4A374', .004);
        box(group, [.86, .07, .02], [0, y + .04, .29], '#C4A374', .004);
        for (const x of [-.14, .14]) box(group, [.015, .08, .51], [x, y + .055, .025], '#B59468', .003);
      }
    }
    const items = new THREE.Group(); group.add(items); this.itemGroups.set(rack.id, items);
    const layout = layouts[rack.item];
    for (const unit of createStock().filter(unit => unit.rackId === rack.id)) {
      const product = this.makeProduct(unit);
      product.position.set((unit.column - (layout.columns - 1) / 2) * (.77 / layout.columns), layout.tiers[unit.tier], .2 - unit.depth * .15);
      product.userData.unitId = unit.id;
      product.userData.item = unit.item;
      product.name = unit.id; items.add(product); this.units.set(unit.id, product);
    }
    const names = { fruit: ['FRESH FRUIT', '30 / each'], bottle: ['WATER & DRINKS', '25 / bottle'], bag: ['REUSABLE BAGS', '50 / bag'], book: ['BOOKS & STATIONERY', '120 / book'] };
    const header = new THREE.Mesh(new THREE.PlaneGeometry(.86, .18), new THREE.MeshBasicMaterial({ map: this.label(...names[rack.item] as [string, string], 768, 180), transparent: true }));
    header.position.set(0, 1.57, .01); group.add(header);
    for (const y of [.28, .66, 1.04]) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(.23, .052), new THREE.MeshBasicMaterial({ map: this.label(names[rack.item][1], 'per item', 384, 100), transparent: true }));
      tag.position.set(.22, y - .008, .345); group.add(tag);
    }
    const outline = new THREE.Group(); group.add(outline); outline.visible = false;
    const outlineMat = new THREE.MeshBasicMaterial({ color: c.marigold });
    for (const x of [-.435, .435]) {
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, 1.62, 6), outlineMat); edge.position.set(x, .81, .255); outline.add(edge);
    }
    for (const y of [.015, 1.62]) {
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .87, 6), outlineMat); edge.rotation.z = Math.PI / 2; edge.position.set(0, y, .255); outline.add(edge);
    }
    this.outlines.set(rack.id, outline); contactShadow(group, 1.3, .95);
  }

  makeProduct(unit: ShelfUnit) {
    const product = new THREE.Group();
    if (unit.item === 'fruit') {
      const color = unit.column < 3 ? '#C96E4F' : unit.column < 5 ? '#DCAA49' : '#A7B66D';
      ball(product, [0, .055, 0], [.047, .05, .047], color);
      cylinder(product, [0, .109, 0], .003, .004, .022, '#795A3B');
      const leaf = ball(product, [.014, .111, 0], [.019, .004, .008], '#5C8557'); leaf.rotation.z = .4;
    } else if (unit.item === 'bottle') {
      const color = ['#A5C2BA', '#A5C2BA', '#C4B19A'][unit.column % 3];
      cylinder(product, [0, .075, 0], .037, .037, .15, color);
      ball(product, [0, .151, 0], [.037, .029, .037], color);
      cylinder(product, [0, .188, 0], .017, .017, .06, color);
      cylinder(product, [0, .222, 0], .02, .02, .018, '#426B60');
      cylinder(product, [0, .08, 0], .038, .038, .065, '#F5F0DF');
      box(product, [.032, .025, .004], [0, .08, .039], '#6F9989', .002);
    } else if (unit.item === 'book') {
      const height = .21 + (unit.column % 3) * .022;
      const color = ['#B89361', '#648C7C', '#B47760', '#9D94AC', '#D4C69C'][unit.column % 5];
      box(product, [.076, height, .18], [0, height / 2, 0], color, .004);
      box(product, [.05, height - .02, .165], [0, height / 2, .005], '#E6DEC8', .002);
      box(product, [.075, height, .02], [0, height / 2, .094], color, .003);
      for (const y of [.04, height - .035]) box(product, [.047, .008, .004], [0, y, .106], '#EFE5C9', .001);
    } else {
      box(product, [.19, .22, .095], [0, .11, 0], unit.column % 2 ? '#B5A677' : '#C8AE75', .012);
      for (const z of [-.038, .038]) {
        const handle = new THREE.Mesh(new THREE.TorusGeometry(.042, .006, 5, 12, Math.PI), material('#6F7960'));
        handle.position.set(0, .22, z); product.add(handle);
      }
      box(product, [.065, .065, .006], [0, .125, .05], '#F1EBDD', .006);
      ball(product, [0, .125, .056], [.019, .024, .003], '#6F9989');
    }
    return product;
  }

  makeKeeper() {
    const person = new THREE.Group();
    person.name = 'shopkeeper'; person.position.set(0, 0, -3.48); person.scale.setScalar(.86);
    this.scene.add(person); this.keeper = person;
    // A clay figure facing the entrance, with the lower body behind the counter.
    const skin = tokens.skin.T1;
    for (const x of [-.13, .13]) {
      cylinder(person, [x, .43, 0], .085, .09, .74, '#4B4170');
      ball(person, [x, .08, .04], [.11, .07, .17], c.ink);
    }
    ball(person, [0, 1.08, 0], [.31, .42, .19], c.cream);
    box(person, [.4, .49, .06], [0, 1.03, .176], c.teal, .04);
    for (const x of [-.16, .16]) box(person, [.035, .32, .035], [x, 1.33, .17], c.teal, .012);
    box(person, [.18, .12, .025], [0, 1.01, .218], c.teal_d, .02);
    cylinder(person, [0, 1.49, 0], .09, .1, .15, skin.base);
    ball(person, [0, 1.72, .015], [.235, .265, .21], skin.base);
    for (const x of [-.235, .235]) ball(person, [x, 1.72, .02], [.045, .07, .04], skin.shade);
    for (let n = 0; n < 9; n++) {
      const angle = n / 8 * Math.PI;
      ball(person, [Math.cos(angle) * .205, 1.83 + Math.sin(angle) * .14, -.025], [.085, .08, .12], '#D2CAE2');
    }
    for (const x of [-.09, .09]) {
      ball(person, [x, 1.74, .207], [.025, .032, .014], c.ink);
      const glasses = new THREE.Mesh(new THREE.TorusGeometry(.077, .009, 6, 24), material(c.ink));
      glasses.position.set(x, 1.74, .22); person.add(glasses);
      ball(person, [x * 1.6, 1.65, .18], [.035, .018, .018], '#E6B6A3');
    }
    box(person, [.037, .014, .018], [0, 1.75, .23], c.ink, .004);
    ball(person, [0, 1.69, .225], [.035, .04, .025], skin.shade);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(.055, .008, 6, 16, Math.PI), material(c.ink));
    smile.rotation.z = Math.PI; smile.position.set(0, 1.64, .212); person.add(smile);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .28, 1.3, 0); person.add(arm); this.keeperArms.push(arm);
      const sleeve = ball(arm, [side * .02, -.06, .025], [.12, .23, .13], c.cream);
      sleeve.rotation.z = side * .3;
      ball(arm, [side * .06, -.22, .12], [.085, .16, .085], skin.base);
      ball(arm, [side * .02, -.29, .25], [.09, .065, .09], skin.base);
    }
  }

  makePackedBag() {
    const bag = this.packedBag;
    bag.name = 'packed-shopping-bag'; bag.position.set(-.87, 1.03, -2.58);
    for (const z of [-.13, .13]) box(bag, [.4, .4, .025], [0, .2, z], '#C2A273', .008);
    for (const x of [-.2, .2]) box(bag, [.025, .4, .26], [x, .2, 0], '#B79667', .008);
    box(bag, [.4, .025, .26], [0, .012, 0], '#B79667', .004);
    for (const z of [-.1, .1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(.095, .009, 6, 20, Math.PI), material('#6B795C'));
      handle.position.set(0, .4, z); bag.add(handle);
    }
    box(bag, [.12, .12, .008], [0, .24, .148], '#F1EBDD', .008);
    ball(bag, [0, .24, .156], [.035, .045, .004], '#6F9989');
    bag.add(this.packedContents);
    bag.visible = false; this.scene.add(bag);
  }

  beginCheckout(ids: string[], onScan: (count: number) => void, onReady: () => void) {
    this.resetCheckout();
    this.camera.updateMatrixWorld();
    const from = this.camera.localToWorld(new THREE.Vector3(.15, -.35, -.7));
    const items = ids.map(id => {
      const item = this.units.get(id)!.clone(true);
      item.visible = true; item.position.copy(from); item.rotation.set(0, 0, 0);
      this.checkoutItems.add(item); return item;
    });
    this.packedBag.visible = true;
    this.checkout = { items, from, at: performance.now(), last: -1, onScan, onReady };
  }
  resetCheckout() {
    this.setPlayerWalking(false);
    this.departure = undefined; this.arrived = false;
    this.roamPose=undefined;this.market.resetActivities();
    this.carriedGoods.clear();this.carriedGoods.visible=true;this.carryVisibleAt=0;this.keeperGreetingAt=-10000;
    this.market.root.visible = false; this.thresholdGlow.visible = false; this.doorLight.intensity = 0;
    this.scene.fog = new THREE.Fog(c.cream, 10, 22);
    this.checkout = undefined; this.checkoutItems.clear(); this.packedContents.clear(); this.packedBag.visible = false;
    if (this.scanner) this.scanner.visible = false;
    this.keeperArms.forEach(arm => arm.rotation.set(0, 0, 0));
    this.exitReady = false; this.exitDoor.rotation.y = 0;
  }
  collectPackedBag() {
    this.clearPickup();
    const object = this.packedBag.clone(true); this.scene.add(object);
    this.packedBag.visible = false;
    if (this.reducedMotion) this.scene.remove(object);
    else { this.pickup = { object, from: object.position.clone(), scale: object.scale.clone(), at: performance.now() }; this.hand.visible = true; }
    this.exitReady = true;
  }

  walkIntoMarket(done: () => void) {
    this.clearPickup();
    this.setPlayerWalking(false);
    this.departure = { at: performance.now(), done };
    this.marketStartedAt = performance.now();
    this.market.root.visible = true; this.thresholdGlow.visible = true;
    this.scene.fog = new THREE.Fog('#f5b987', 32, 105);
    this.renderer.domElement.setAttribute('aria-label', 'Sunlight spills through the opening door. Step onto the footpath and turn right along a wide market street: shoppers at stalls, a parent calming a child, a delivery bicycle, birds and pink clouds.');
    if (this.reducedMotion) this.finishDeparture();
  }
  finishDeparture() {
    this.setPlayerWalking(false);
    const done = this.departure?.done;
    this.departure = undefined; this.arrived = true;
    this.market.root.visible = true; this.hand.visible = false;
    this.camera.position.set(1.2, 1.73, 7.8);
    this.camera.rotation.set(.015, Math.PI * 1.5 - .3, 0, 'YXZ');
    done?.();
  }
  setMarketPose(pose: MarketPose) {
    if(!this.arrived)return;
    this.roamPose={...pose};this.movedAt=performance.now();
  }
  private setPlayerWalking(walking:boolean){
    if(this.playerWalking===walking){if(walking)this.onPlayerWalking?.(true);return;}
    this.playerWalking=walking;
    this.onPlayerWalking?.(walking);
  }
  greetShopkeeper(){this.keeperGreetingAt=performance.now();}
  setMarketCarry(kind:'fruit'|'flowers'|'bread'|'toy'|undefined,count=1,delay=0){
    this.carriedGoods.clear();this.carriedGoods.visible=!delay;this.carryVisibleAt=delay?performance.now()+delay:0;if(!kind||count===0)return;
    ball(this.carriedGoods,[-.03,-.08,.04],[.065,.085,.05],tokens.skin.T3.base);
    cylinder(this.carriedGoods,[-.03,-.23,.04],.055,.07,.21,c.cream);
    if(kind==='toy'){
      ball(this.carriedGoods,[0,.15,0],[.09,.11,.07],'#b95e4e');ball(this.carriedGoods,[0,.3,0],[.1,.09,.08],'#c96b53');
      for(const side of [-1,1]){ball(this.carriedGoods,[side*.08,.38,0],[.04,.04,.03],'#b95e4e');ball(this.carriedGoods,[side*.035,.31,.075],[.009,.012,.009],'#392d2c');}
    }else{
      box(this.carriedGoods,[.34,.22,.24],[0,.03,0],'#c5a06b');
      for(let i=0;i<count;i++){
        if(kind==='flowers'){box(this.carriedGoods,[.012,.25,.012],[(i%3-1)*.08,.22,Math.floor(i/3)*.08],'#63885b');ball(this.carriedGoods,[(i%3-1)*.08,.36,Math.floor(i/3)*.08],[.065,.04,.065],i%2?'#dfbce4':'#edb28e');}
        else ball(this.carriedGoods,[(i%3-1)*.08,.2,Math.floor(i/3)*.08],[.07,.07,kind==='bread'?.17:.07],kind==='bread'?'#dfb678':'#dc7954');
      }
    }
  }

  animateCheckout(now: number) {
    const checkout = this.checkout;
    if (!checkout) return;
    const elapsed = now - checkout.at;
    const staging = (i: number) => new THREE.Vector3(-.48 + i * .28, 1.035, -2.12);
    if (elapsed < 650) {
      checkout.items.forEach((item, i) => item.position.lerpVectors(checkout.from, staging(i), this.reducedMotion ? 1 : Math.min(1, elapsed / 650)));
      return;
    }
    const scanElapsed = elapsed - 650;
    const current = Math.floor(scanElapsed / 1100);
    if (current !== checkout.last) {
      checkout.items.slice(0, current).forEach((item, i) => {
        if (item.userData.item === 'bag' || this.packedContents.getObjectByName(`packed-${i}`)) return;
        const packed = item.clone(true); packed.name = `packed-${i}`; packed.visible = true;
        packed.position.set(-.09 + (i % 3) * .08, .32, i % 2 ? -.045 : .035); packed.rotation.set(0, i * .3, 0); packed.scale.setScalar(.85);
        this.packedContents.add(packed);
      });
    }
    if (current < checkout.items.length) {
      if (current !== checkout.last) { checkout.last = current; checkout.onScan(current); }
      const progress = scanElapsed / 1100 - current;
      checkout.items.forEach((item, i) => { item.visible = i >= current; if (i > current) item.position.copy(staging(i)); });
      const active = checkout.items[current];
      const scan = new THREE.Vector3(.1, 1.12, -2.28), intoBag = new THREE.Vector3(-.87, 1.18, -2.58);
      if (this.reducedMotion) active.position.copy(scan);
      else if (progress < .45) active.position.lerpVectors(staging(current), scan, progress / .45);
      else active.position.lerpVectors(scan, intoBag, (progress - .45) / .55);
      active.position.y += this.reducedMotion ? 0 : Math.sin(progress * Math.PI) * .12;
      active.scale.setScalar(progress > .8 ? 1 - (progress - .8) * 3 : 1);
      if (this.scanner) this.scanner.visible = progress > .28 && progress < .62;
      if (!this.reducedMotion) this.keeperArms.forEach((arm, i) => { arm.rotation.x = -Math.sin(progress * Math.PI) * .55; arm.rotation.z = Math.sin(progress * Math.PI) * (i ? .2 : -.2); });
    } else {
      checkout.items.forEach(item => { item.visible = false; });
      if (this.scanner) this.scanner.visible = false;
      if (current !== checkout.last) { checkout.last = current; checkout.onScan(checkout.items.length); }
      if (scanElapsed >= checkout.items.length * 1100 + 600) {
        this.keeperArms.forEach(arm => arm.rotation.set(0, 0, 0));
        this.checkout = undefined; checkout.onReady();
      }
    }
  }

  setPlayer(player: Player, instant = false) {
    if (this.departure || this.arrived) return;
    this.from.copy(this.camera.position); this.fromYaw = this.yaw;
    this.target.set(player.col - 4, 1.58, player.row - 4);
    let angle = -DIRECTIONS.indexOf(player.facing) * Math.PI / 2;
    while (angle - this.yaw > Math.PI) angle -= Math.PI * 2;
    while (angle - this.yaw < -Math.PI) angle += Math.PI * 2;
    this.targetYaw = angle; this.movedAt = performance.now();
    if (instant || this.reducedMotion) {
      this.camera.position.copy(this.target); this.yaw = this.targetYaw; this.from.copy(this.target); this.fromYaw = this.targetYaw;
    }
  }
  setHighlight(id?: string) {
    this.highlight = id;
    this.outlines.forEach((outline, rackId) => { outline.visible = rackId === id; });
  }
  takeUnit(id: string) {
    const unit = this.units.get(id);
    if (!unit || !unit.visible) return;
    this.clearPickup();
    unit.updateWorldMatrix(true, false);
    const object = unit.clone(true);
    unit.getWorldPosition(object.position); unit.getWorldQuaternion(object.quaternion); unit.getWorldScale(object.scale);
    unit.visible = false;
    if (this.reducedMotion) return;
    this.scene.add(object);
    this.pickup = { object, from: object.position.clone(), scale: object.scale.clone(), at: performance.now() };
    this.hand.visible = true;
  }
  clearPickup() {
    if (this.pickup) this.scene.remove(this.pickup.object);
    this.pickup = undefined; this.hand.visible = false;
  }
  resetStock() {
    this.clearPickup(); this.resetCheckout(); this.units.forEach(unit => { unit.visible = true; });
    this.renderer.domElement.setAttribute('aria-label', 'First-person shop with wooden racks on both sides, a counter and a shopkeeper ahead. Use the controls to move.');
  }
  click = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, this.camera);
    const first = raycaster.intersectObjects(this.scene.children, true).find(hit => {
      let object: THREE.Object3D | null = hit.object;
      while (object) { if (!object.visible || object === this.camera) return false; object = object.parent; }
      return true;
    });
    let object: THREE.Object3D | null = first?.object ?? null;
    let unitId: string | undefined;
    while (object) {
      if(object.userData.marketItem){this.onMarketItem?.(object.userData.marketItem as string);break;}
      if (object.userData.activityId) { this.onMarketInteract?.(object.userData.activityId as ActivityId); break; }
      if (object.userData.unitId) unitId = object.userData.unitId;
      if (object.userData.rackId) { this.onRackClick(object.userData.rackId, unitId); break; }
      object = object.parent;
    }
  };
  animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    const now = performance.now();
    if(this.carryVisibleAt&&now>=this.carryVisibleAt){this.carriedGoods.visible=true;this.carryVisibleAt=0;}
    // Keep idle rendering at 30fps; movement renders at display rate.
    if (now - this.lastTime < 32 && now - this.movedAt > 250 && !this.pickup && !this.checkout) return;
    this.lastTime = now;
    const t = Math.min((now - this.movedAt) / 220, 1), eased = t * t * (3 - 2 * t);
    if (!this.departure && !this.arrived) {
      this.camera.position.lerpVectors(this.from, this.target, eased);
      this.yaw = THREE.MathUtils.lerp(this.fromYaw, this.targetYaw, eased);
      this.camera.rotation.set(0, this.yaw, 0, 'YXZ');
    }
    this.animateCheckout(now);
    const greeting=(now-this.keeperGreetingAt)/1800;
    if(greeting>=0&&greeting<1&&!this.checkout){const amount=this.reducedMotion?.8:Math.sin(greeting*Math.PI);this.keeperArms.forEach((arm,i)=>arm.rotation.set(-.95*amount,0,(i?-.4:.4)*amount));}
    if(this.arrived && this.roamPose) {
      const pose=this.roamPose;
      this.camera.position.lerp(new THREE.Vector3(pose.x,pose.z<9||pose.z>19?1.73:1.58,pose.z),this.reducedMotion?1:.3);
      this.camera.rotation.set(pose.pitch,pose.yaw,0,'YXZ');
    }
    const opening = !!this.departure || this.arrived;
    this.exitDoor.rotation.y = THREE.MathUtils.lerp(this.exitDoor.rotation.y, opening ? -Math.PI * .56 : 0, this.reducedMotion ? 1 : .065);
    this.doorLight.intensity = opening ? Math.min(22, Math.abs(this.exitDoor.rotation.y) * 18) : 0;
    if (this.market.root.visible) this.market.update((now - this.marketStartedAt) / 1000, this.arrived ? 1 : this.departure ? Math.min(1, (now - this.departure.at) / 9000) : 0, this.reducedMotion);
    if (this.departure) {
      const progress = Math.min(1, (now - this.departure.at) / 9000);
      this.setPlayerWalking(!this.reducedMotion&&progress>.16&&progress<.62);
      // Pause at the hinge, step across the sill, then gently take in the street.
      const walk = THREE.MathUtils.smoothstep(progress, .16, .62);
      const turn = THREE.MathUtils.smoothstep(progress, .48, .92);
      const bob = Math.sin(walk * Math.PI * 8) * .018;
      this.camera.position.set(turn * 1.2, 1.58 + walk * .15 + bob, 3.15 + walk * 4.65);
      this.camera.rotation.set(.015 * turn, Math.PI + turn * (Math.PI / 2 - .3), 0, 'YXZ');
      this.hand.visible = progress > .03 && progress < .3;
      this.hand.position.set(.32, -.32 - Math.max(0, progress - .18) * 4, -.65); this.hand.rotation.z = -.2;
      if (progress === 1) this.finishDeparture();
    }
    if (this.pickup) {
      this.camera.updateMatrixWorld();
      const progress = Math.min((now - this.pickup.at) / 650, 1);
      const eased = 1 - (1 - progress) ** 3;
      // Bring the item into view in the hand, then lower it into the shopping bag.
      const drop = Math.max(0, (progress - .72) / .28);
      const destination = this.camera.localToWorld(new THREE.Vector3(.24, -.2 - drop * .65, -.65));
      this.pickup.object.position.lerpVectors(this.pickup.from, destination, eased);
      this.pickup.object.position.y += Math.sin(progress * Math.PI) * .16;
      this.pickup.object.scale.copy(this.pickup.scale).multiplyScalar(1 - progress * .3);
      const handPosition = this.camera.worldToLocal(this.pickup.object.position.clone());
      this.hand.position.copy(handPosition).add(new THREE.Vector3(.025, -.14, .025));
      this.hand.rotation.z = -.25;
      if (progress === 1) this.clearPickup();
    }
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    this.setPlayerWalking(false);
    cancelAnimationFrame(this.raf); this.observer.disconnect();
    this.renderer.domElement.removeEventListener('click', this.click);
    this.thresholdGlow.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
    this.market.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
