/* =============================================================================
   20 · MATERIALS & PALETTE — white oak, limestone, aluminium, glass, fabrics,
   and each agent's own colour family
   ============================================================================= */

const OAK_TEX = canvasTexture(oakCanvas(1024, 256, 3), { repeat: true });
const OAK_TEX_B = canvasTexture(oakCanvas(1024, 256, 17, { base: '#d7c19f' }), { repeat: true });
const STONE_TEX = canvasTexture(concreteCanvas(1024, 21, { base: '#6f6e6b', joint: 'rgba(14,14,13,0.82)', jointW: 4.5, chamfer: 0.2 }), { repeat: true }); // darker grey concrete in large squares, crisp joints; repeat set by the room
const STONE_DARK_TEX = canvasTexture(stoneCanvas(512, 31, { base: '#3a3a3c', joints: 2, joint: 'rgba(0,0,0,0.25)' }), { repeat: true });

const std = (hex, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: lin(hex), roughness, metalness, fog: false, ...extra });

const MAT = {
  floor: new THREE.MeshStandardMaterial({ map: STONE_TEX, roughness: 0.5, metalness: 0, envMapIntensity: 0.32, fog: false }),
  slab: std('#9a948b', 0.8),
  slabTop: std('#d8d2c8', 0.7),
  oak: new THREE.MeshStandardMaterial({ map: OAK_TEX, roughness: 0.55, metalness: 0, envMapIntensity: 0.5, fog: false }),
  oakB: new THREE.MeshStandardMaterial({ map: OAK_TEX_B, roughness: 0.58, metalness: 0, envMapIntensity: 0.45, fog: false }),
  darkStone: new THREE.MeshStandardMaterial({ map: STONE_DARK_TEX, color: lin('#ffffff'), roughness: 0.5, metalness: 0, envMapIntensity: 0.4, fog: false }),
  plaster: std('#f4f2ee', 0.92),
  white: std('#fafaf8', 0.5),
  alu: std('#c9ccd1', 0.32, 0.85, { envMapIntensity: 1.0 }),
  aluDark: std('#8e939a', 0.34, 0.82, { envMapIntensity: 0.95 }),
  graphite: std('#2e3034', 0.45, 0.4),
  black: std('#141416', 0.5, 0.1),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  glassDoor: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  screenOff: new THREE.MeshPhysicalMaterial({ color: lin('#0b0c0e'), roughness: 0.14, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6, fog: false }),
  fabricGrey: std('#c4c7cc', 0.95),
  fabricLight: std('#e4e2de', 0.97),
  oatmeal: std('#ddd4c6', 1),
  sage: std('#93ab93', 0.95),
  cognac: new THREE.MeshPhysicalMaterial({ color: lin('#8d5432'), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35, fog: false }),
  ceramic: new THREE.MeshPhysicalMaterial({ color: lin('#f6f6f3'), roughness: 0.28, clearcoat: 0.8, fog: false }),
  terracotta: std('#c9774f', 0.85),
  paper: std('#fbfbf8', 0.9),
  soil: std('#4a3a2c', 1),
  leaf: [std('#5c8f4a', 0.75, 0, { flatShading: true }), std('#4c7d40', 0.75, 0, { flatShading: true }), std('#6fa45a', 0.75, 0, { flatShading: true }), std('#3f6e37', 0.8, 0, { flatShading: true })],
  bark: std('#8d7f6f', 0.9),
};

/**
 * Agent colour families. `main` dresses the character and fills its roster tile;
 * `light` lights its eyes, glyphs and glow; `soft` tints its rug and screen.
 * Reds are kept out of the family so crimson always means "needs you".
 */
const AGENT_COLORS = {
  // `main` is each robot's body paint (the roster chip matches the robot); `light` its eyes and collar seam
  crimson: { label: 'Crimson & black', main: '#a70008', light: '#f4f4f6', soft: '#ecd2d3', accent: '#a70008' },
  orange: { label: 'Orange', main: '#ee7a1c', light: '#ffc58f', soft: '#f9dcc2' },
  violet: { label: 'Violet', main: '#7b46db', light: '#c3aaf7', soft: '#e0d5f9' },
  teal: { label: 'Turquoise', main: '#13aeb0', light: '#8fe6e3', soft: '#cbeeed' },
  azure: { label: 'Azure', main: '#2369dd', light: '#93bff5', soft: '#cfe0f8' },
  green: { label: 'Emerald', main: '#17975a', light: '#8fdcae', soft: '#cbecd8' },
  lime: { label: 'Lime', main: '#97c11e', light: '#d8ee8c', soft: '#e9f3c6' },
  plum: { label: 'Magenta', main: '#d2348f', light: '#f6a8d2', soft: '#f6d3e6' },
  // for agents who join later
  indigo: { label: 'Indigo', main: '#3f47b8', light: '#aab0f2', soft: '#d9dbf6' },
  aqua: { label: 'Aqua', main: '#1598aa', light: '#8be0ea', soft: '#cdeef2' },
  slate: { label: 'Slate', main: '#5d7385', light: '#b3c5d3', soft: '#d9e2e9' },
  olive: { label: 'Olive', main: '#6f7d22', light: '#cad696', soft: '#e3e8cc' },
};
const colorsOf = key => AGENT_COLORS[key] || AGENT_COLORS.slate;
