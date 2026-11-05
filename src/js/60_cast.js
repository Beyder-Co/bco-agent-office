/* =============================================================================
   60 · THE CAST — eight specialists in eight separate lanes
   -----------------------------------------------------------------------------
   Robots show verified operational lanes; Crimson coordinates existing owners.
   Model names are not invented from appearance.
   `look.bot` picks the robot: one family, eight different bots. Each has its own body paint
   (AGENT_COLORS[look.color].main, so the roster chip is the robot's colour), its own head and
   its own base: four walk on legs, two hover, one balances on a ball, one runs on tracks.
   The eyes and a thin collar seam carry the agent's light; they turn crimson
   when the agent needs Igor. No overhead halo.
   ============================================================================= */

const CAST = [
  {
    id: 'crimson', name: 'CRIMSON', monogram: 'Cr', engine: "Codex · Office coordinator",
    specialty: "Coordination & Decisions",
    role: "Your instruction and approval inbox. Coordinates existing owners, follows repair requests and reports their evidence. Routine jobs keep their existing schedules.",
    systems: ["Office coordinator chat", "Approval inbox", "Repair follow-through"],
    delivered: [],
    look: { color: 'crimson', bot: { preset: 'helm', deep: 0.2 }, headwear: 'headset', prop: 'tablet', screen: 'ops', build: { torsoW: 1.02 } },
    slot: 5,
  },
  {
    id: 'builder', name: 'BUILDER', monogram: 'Bu', engine: "Studio website reports",
    specialty: "Websites & Deployments",
    role: "Shows website and deployment checks. Crimson coordinates requested website work with the appropriate owner; this robot is not a separate model or publishing service.",
    systems: ["Website checks", "Vercel deployment reports"],
    delivered: [],
    look: { color: 'orange', bot: { preset: 'dome' }, prop: 'house', screen: 'build', build: { torsoW: 1.0 } },
    slot: 2,
  },
  {
    id: 'engineer', name: 'ENGINEER', monogram: 'En', engine: "Studio native jobs · Codex coordination",
    specialty: "Maintenance & Integrations",
    role: "Shows the Studio monitor and maintenance results. Repairs follow the existing review and installation requirements.",
    systems: ["Monitor", "Maintenance", "Code and integrations"],
    delivered: [],
    look: { color: 'violet', bot: { preset: 'cube' }, headwear: 'headphones', prop: 'laptop', screen: 'code', build: { torsoW: 0.98 } },
    slot: 3,
  },
  {
    id: 'strategist', name: 'STRATEGIST', monogram: 'St', engine: "On demand through Crimson",
    specialty: "Strategy & Planning",
    role: "A workspace for strategic requests to Crimson. No independent scheduled strategy worker is connected. Muse remains the SEO owner.",
    systems: ["Positioning", "Planning", "Muse owns SEO externally"],
    delivered: [],
    look: { color: 'teal', bot: { preset: 'capsule' }, prop: 'chess', screen: 'strategy' },
    slot: 1,
  },
  {
    id: 'automations', name: 'AUTOMATIONS', monogram: 'Au', engine: "Studio native jobs · Codex FUB owner",
    specialty: "FUB & Scheduled Communications",
    role: "Shows FUB follow-up, contact sync and communication jobs. Their existing owners execute them; Crimson handles instructions and unresolved decisions.",
    systems: ["FUB", "Email and SMS", "Contact sync", "Follow-ups"],
    delivered: [],
    look: { color: 'azure', bot: { preset: 'block' }, prop: 'studio', screen: 'terminal' },
    slot: 7,

  },
  {
    id: 'analyst', name: 'ANALYST', monogram: 'An', engine: "Studio native reporting",
    specialty: "Revenue & Activity Reporting",
    role: "Shows revenue attribution and activity reporting. Finance Tracker and Plaid are separate systems, not connected executors in this Office.",
    systems: ["Revenue attribution", "High-value activity"],
    delivered: [],
    look: { color: 'green', bot: { preset: 'orb' }, prop: 'ledger', screen: 'sheet', build: { torsoW: 0.98 } },
    slot: 4,
  },
  {
    id: 'scout', name: 'SCOUT', monogram: 'Sc', engine: "Studio native jobs · Codex NJMLS owner",
    specialty: "NJMLS & RealScout",
    role: "Shows NJMLS intake and RealScout activity jobs. The NJMLS owner retains the hot-sheet and preparation schedules; native intake retains its own trigger.",
    systems: ["NJMLS", "RealScout", "Property activity"],
    delivered: [],
    look: { color: 'lime', bot: { preset: 'lens' }, prop: 'camera', screen: 'map' },
    slot: 0,
  },
  {
    id: 'publisher', name: 'PUBLISHER', monogram: 'Pu', engine: "Codex content owners · Studio reports",
    specialty: "Content & Publishing",
    role: "Shows the existing content brief, weekly scan, Journal owners and dashboard publishing reports. Content selection and publication approvals remain with Igor.",
    systems: ["Content brief", "Weekly scan", "Daily Journal", "Dashboard reports"],
    delivered: [],
    look: { color: 'plum', bot: { preset: 'screen' }, prop: 'mic', screen: 'media' },
    slot: 6,
  },
];

/** Robots for agents who join later: each preset is a whole bot (head and base), desk object and screen. */
const STYLES = {
  headset: { label: 'Biped, visor helmet', look: { bot: { preset: 'helm' }, headwear: 'headset', prop: 'tablet', screen: 'ops' } },
  blazer: { label: 'Biped, tall capsule', look: { bot: { preset: 'capsule' }, prop: 'chess', screen: 'strategy' } },
  hoodie: { label: 'Biped, cube head', look: { bot: { preset: 'cube' }, headwear: 'headphones', prop: 'laptop', screen: 'code' } },
  field: { label: 'Biped, camera lens', look: { bot: { preset: 'lens' }, prop: 'camera', screen: 'map' } },
  vest: { label: 'Biped, orb head', look: { bot: { preset: 'orb' }, prop: 'ledger', screen: 'sheet' } },
  site: { label: 'Biped, dome head', look: { bot: { preset: 'dome' }, prop: 'house', screen: 'build' } },
  press: { label: 'Biped, screen face', look: { bot: { preset: 'screen' }, prop: 'mic', screen: 'media' } },
  robot: { label: 'Biped, block head', look: { bot: { preset: 'block' }, prop: 'studio', screen: 'terminal' } },
};

/** Colour families offered to newcomers, the unused ones first. */
function freeColors() {
  const used = new Set(OFFICE_STATE.order.map(id => OFFICE_STATE.agents[id].look.color));
  const keys = Object.keys(AGENT_COLORS).filter(k => k !== 'crimson');
  return keys.filter(k => !used.has(k)).concat(keys.filter(k => used.has(k)));
}

/** Figure spec from an agent record (cast member or newcomer). */
function figureSpec(a) {
  const L = a.look;
  return { id: a.id, color: L.color, outfit: L.outfit, headwear: L.headwear, wear: L.wear, bot: L.bot, accent: L.accent, build: L.build };
}
