'use strict';
// Reglas del juego: fórmulas, lectura de efectos y cálculo de la ficha. Sin DOM, se prueba con tools/test.js.
(() => {
const F = Math.floor;
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const sum = list => (list || []).reduce((t, x) => t + x.v, 0);

const ATTRS = [['fue', 'Fuerza', 'FUE'], ['des', 'Destreza', 'DES'], ['per', 'Percepción', 'PER'],
  ['int', 'Inteligencia', 'INT'], ['det', 'Determinación', 'DET'], ['con', 'Constitución', 'CON']];
const DEFAULT_SKILLS = [['Investigación', 'per', 'int'], ['Pericia', 'des', 'int'], ['Conocimiento', 'int', 'int'],
  ['Social', 'det', 'int'], ['Atletismo', 'con', 'des'], ['Sigilo', 'des', 'per'], ['Pelea', 'fue', 'des'],
  ['Puntería', 'des', 'per'], ['Tecnología', 'int', 'des'], ['Estilo', 'det', 'det']];
const DEFENSES = [
  ['evasion', 'Evasión', '(DES+PER)/10', a => (a.des + a.per) / 10],
  ['reflejos', 'Reflejos', '(DES+PER)/5+10', a => (a.des + a.per) / 5 + 10],
  ['fortaleza', 'Fortaleza', '(CON+FUE)/5+10', a => (a.con + a.fue) / 5 + 10],
  ['voluntad', 'Voluntad', '(DET+FUE)/5+10', a => (a.det + a.fue) / 5 + 10]];
const SECONDARY = [
  ['pa', 'Puntos de acción', 'DES/10+5', a => a.des / 10 + 5],
  ['vitalidad', 'Vitalidad', 'CON/2+DET/5+30', a => a.con / 2 + a.det / 5 + 30],
  ['potencia', 'Potencia', 'FUE/5−5', a => a.fue / 5 - 5],
  ['rango', 'Rango', 'PER/2', a => a.per / 2],
  ['iniciativa', 'Iniciativa', '(DES+PER)/10', a => (a.des + a.per) / 10],
  ['curacion', 'Vel. de curación', 'CON/20', a => a.con / 20],
  ['resolucion', 'Resolución', 'DET/10', a => a.det / 10],
  ['suerte', 'Suerte', '50', () => 50],
  ['ph', 'PH × NV', 'INT/5+5', a => a.int / 5 + 5],
  ['carga', 'Carga máx. (kg)', '(FUE+CON)/2+20', a => (a.fue + a.con) / 2 + 20],
  ['implantes', 'Humanidad', 'CON/2+DET+NV×2', (a, ch) => a.con / 2 + a.det + 2 * ch.level],
  ['ram', 'RAM', 'Sistema operativo', () => 0],
  ['ramregen', 'RAM Regen', 'Implantes', () => 0],
  ['icewall', 'ICE', 'Implantes', () => 0]];
const INITIAL_POINTS = 320, LEVEL_POINTS = 5; // características: al crear el personaje y por cada nivel subido
const RD = [['normal', 'Normal'], ['termal', 'Termal'], ['electrica', 'Eléctrica'], ['quimica', 'Química'], ['hack', 'vs Quickhacks']];
// Ranura -> cantidad máxima de implantes (casilleros de la planilla v9.0; "Otros" es una lista libre).
const SLOT_LIMITS = {'Sistema operativo': 1, 'Ojos': 1, 'Corteza frontal': 2, 'Sistema nervioso': 2, 'Sistema circulatorio': 2,
  'Sistema integumentario': 2, 'Esqueleto': 2, 'Brazos': 2, 'Manos': 2, 'Piernas': 1, 'Otros': Infinity};
const SLOTS = Object.keys(SLOT_LIMITS);
const PAIRED = ['Brazos', 'Manos', 'Piernas'];
const SINGLE = ['s.a. rostovik rakater']; // dispara cohetes: solo en un brazo
const TARGETS = {fuerza: 'fue', destreza: 'des', percepcion: 'per', inteligencia: 'int', determinacion: 'det', constitucion: 'con',
  fue: 'fue', des: 'des', per: 'per', int: 'int', det: 'det', con: 'con', 'vitalidad maxima': 'vitalidad',
  evasion: 'evasion', reflejos: 'reflejos', fortaleza: 'fortaleza', voluntad: 'voluntad',
  pa: 'pa', 'puntos de accion': 'pa', vitalidad: 'vitalidad', potencia: 'potencia', rango: 'rango', iniciativa: 'iniciativa',
  'velocidad de curacion': 'curacion', resolucion: 'resolucion', suerte: 'suerte', phxnv: 'ph',
  'limite de implantes': 'implantes', humanidad: 'implantes', ram: 'ram', 'ram regen': 'ramregen', icewall: 'icewall', ice: 'icewall',
  'rd general': 'rd.all', 'rd vs quickhacks': 'rd.hack', 'critico general': 'crit',
  rd: 'rd.normal', 'rd normal': 'rd.normal', 'rd termal': 'rd.termal', 'rd electrica': 'rd.electrica', 'rd quimica': 'rd.quimica', // "+N RD" sin tipo es RD normal
  'resultado de critico': 'crit', caracteristica: 'pts', 'turno de duracion': 'dur'};

// Lee un texto de efecto ("+4 PA, D 3T, CD 6T, +10 Reflejos") y devuelve modificadores numéricos.
// Solo cuenta frases exactas "+N Objetivo"; lo condicional ("+10 Puntería con armas SMART") queda como texto.
function parseEffect(text) {
  const out = {mods: [], dur: null, cd: null, trigger: null, cdr: 0, loadPct: 0};
  // "(se activa cuando…)" solo describe cuándo activarlo; se activa a mano desde Combate.
  for (const seg of norm(text).replace(/\(se activa[^)]*\)/g, '').split(/\.(?!\d)|\|/)) {
    let s = seg.replace(/mientras (este|esta) activo/, ''), m;
    if ((m = s.match(/se activa al terminar (.+)/))) { out.trigger = m[1].trim(); continue; }
    if ((m = s.match(/ al finalizar el efecto de (\S+)/))) { out.trigger = m[1]; s = s.replace(m[0], ''); }
    if ((m = s.match(/enfriamiento.*?(\d+)\s*%/) || s.match(/(\d+)\s*% enfriamiento/))) { out.cdr += +m[1]; continue; }
    if ((m = s.match(/(\d+)\s*% carga de implantes/))) { out.loadPct += +m[1]; continue; }
    if (/\b(cuando|si|grupo)\b/.test(s)) continue;
    for (let ph of s.split(/,| y /)) {
      ph = ph.trim();
      if ((m = ph.match(/^d (\d+)t$/))) { out.dur = +m[1]; continue; }
      if ((m = ph.match(/^cd (\d+)t$/))) { out.cd = +m[1]; continue; }
      if ((m = ph.match(/^ram (\d+)\s*\+\s*int\/10$/))) { out.mods.push({v: +m[1], set: true, target: 'ram', int10: true, when: null}); continue; }
      m = ph.match(/^([+-])?\s*(\d+)\s+(?:a (?:los |las |la )?)?(.+?)(?: al usar (.+))?$/);
      if (m) out.mods.push({v: (m[1] === '-' ? -1 : 1) * m[2], set: !m[1], target: m[3], when: m[4] || null});
    }
  }
  return out;
}

function resolveTarget(raw, skills) {
  if (TARGETS[raw]) return TARGETS[raw];
  if (raw.startsWith('critico ')) { const sk = skills.find(s => norm(s.name) === raw.slice(8)); return sk ? 'crit:' + norm(sk.name) : null; }
  const sk = skills.find(s => norm(s.name) === raw);
  return sk ? 'skill:' + norm(sk.name) : null;
}

// Efectos hasta el tier instalado; se acumulan (Mamba Negra T3 = +15 +30 +50 RD Química).
// Implantes cuyos efectos solo valen con otro implante activo (el Excel no lo dice).
const WHEN_ACTIVE = {'kerenzikov boost system': 'Kerenzikov'};
function implantInfo(im) {
  const eff = im.tiers.slice(0, im.tier).map(parseEffect);
  const last = k => eff.reduce((v, e) => e[k] ?? v, null), total = k => eff.reduce((t, e) => t + e[k], 0);
  return {mods: eff.flatMap(e => e.mods), when: WHEN_ACTIVE[norm(im.name)] || null, dur: last('dur'), cd: last('cd'), trigger: last('trigger'), cdr: total('cdr'), loadPct: total('loadPct')};
}

function compute(ch) {
  const mods = {}, sets = {}, durBonus = {};
  const add = (t, v, src) => (mods[t] ??= []).push({v, src});
  const active = name => ch.implants.some(i => norm(i.name) === norm(name) && i.on > 0);
  let cdr = 0, loadPct = 0;
  // Par de implantes iguales (ambos brazos, manos o piernas): sus efectos cuentan una vez, los del de tier más alto.
  const pairOf = (im, k) => PAIRED.includes(im.slot) ? im.slot + '|' + norm(im.name) : k, best = {};
  ch.implants.forEach((im, k) => { const key = pairOf(im, k); if (best[key] == null || im.tier > ch.implants[best[key]].tier) best[key] = k; });
  const imps = ch.implants.map((im, k) => {
    const x = implantInfo(im);
    if (best[pairOf(im, k)] !== k) return x;
    cdr += x.cdr; loadPct += x.loadPct;
    for (const m of x.mods) {
      const t = resolveTarget(m.target, ch.skills);
      if (!t) continue;
      if (t === 'dur') { if (m.when) durBonus[norm(m.when)] = (durBonus[norm(m.when)] || 0) + m.v; continue; }
      // Un número sin signo solo fija RAM/Icewall del sistema operativo ("5 PA" en armas es el coste del ataque).
      if (m.set) { if (['ram', 'icewall'].includes(t) && (!sets[t] || m.v > sets[t].v)) sets[t] = {v: m.v, int10: m.int10, src: im.name}; continue; }
      if (m.v < 0) continue; // en implantes los negativos son para el enemigo ("-15 RD" perforación, "-20 Reflejos" del objetivo)
      const when = m.when || x.when;
      if (when ? active(when) : (!x.dur || im.on > 0)) add(t, m.v, im.name);
    }
    return x;
  });
  for (const me of ch.merits) for (const m of parseEffect(me.desc).mods) {
    const t = resolveTarget(m.target, ch.skills);
    if (t && t !== 'dur' && !m.set) add(t, m.v * (me.ranks || 1), me.name);
  }
  cdr = Math.min(100, cdr);
  imps.forEach((x, i) => { x.dur = x.dur == null ? null : x.dur + (durBonus[norm(ch.implants[i].name)] || 0);
    x.cdEff = x.cd == null ? null : Math.ceil(x.cd * (1 - cdr / 100)); });

  const raw = {}, tot = {}, attrs = {};
  for (const [k] of ATTRS) {
    raw[k] = (+ch.attrs[k].ini || 0) + (+ch.attrs[k].lvl || 0);
    attrs[k] = {base: raw[k], mod: sum(mods[k]), src: mods[k] || []};
    attrs[k].total = tot[k] = raw[k] + attrs[k].mod;
  }
  for (const k in sets) if (sets[k].int10) sets[k].v += F(tot.int / 10); // "RAM 5+INT/10" del cyberdeck
  // Base: fórmula con características sin modificar. +/-: diferencia por características modificadas + bonos directos.
  const part = (fn, key, extra = []) => {
    const base = F(fn(raw, ch)) + (sets[key]?.v || 0), delta = F(fn(tot, ch)) - F(fn(raw, ch));
    const src = [...(sets[key] ? [{v: sets[key].v, src: sets[key].src + ' (base)'}] : []),
      ...(delta ? [{v: delta, src: 'Características modificadas'}] : []), ...(mods[key] || []), ...extra];
    const mod = delta + sum(mods[key]) + sum(extra);
    return {base, mod, total: base + mod, src};
  };
  const def = Object.fromEntries(DEFENSES.map(([k, , , fn]) => [k, part(fn, k)]));
  const sec = Object.fromEntries(SECONDARY.map(([k, , , fn]) => [k, part(fn, k)]));
  const rd = Object.fromEntries(RD.map(([k]) => [k, part(() => +ch.armor[k] || 0, 'rd.' + k, mods['rd.all'])]));
  const pro = ch.merits.some(m => norm(m.name) === 'el profesional');
  const skills = ch.skills.map(s => {
    const p = part(a => (a[s.a] + a[s.b]) / 5 + 10, 'skill:' + norm(s.name));
    const own = (F(+s.mod) || 0) * (s.spec ? 2 : 1);
    if (s.spec) p.src.push({v: 20, src: 'Especialidad'});
    if (own) p.src.push({v: own, src: s.spec ? 'Puntos ×2 (especialidad)' : 'Puntos asignados'});
    p.mod += own + (s.spec ? 20 : 0);
    p.total = p.base + p.mod;
    p.crit = (F(p.total / 10) + sum(mods.crit) + sum(mods['crit:' + norm(s.name)])) * (pro ? 2 : 1);
    return p;
  });
  return {
    raw, attrs, def, sec, rd, skills, imps, cdr,
    points: {
      ini: {avail: INITIAL_POINTS, spent: ATTRS.reduce((t, [k]) => t + (+ch.attrs[k].ini || 0), 0)},
      attr: {avail: LEVEL_POINTS * (ch.level - 1) + sum(mods.pts), spent: ATTRS.reduce((t, [k]) => t + (+ch.attrs[k].lvl || 0), 0)},
      // Iniciales INT/2+30 al crear, más PH × NV por cada nivel subido.
      skill: {avail: F(raw.int / 2 + 30) + sec.ph.total * (ch.level - 1), spent: ch.skills.reduce((t, s) => t + (F(+s.mod) || 0), 0)},
    },
    merits: {count: ch.merits.reduce((t, m) => t + (m.ranks || 1), 0), max: Math.min(ch.level, 10)},
    // Carga = costo de humanidad de los implantes (al tier instalado, con reducciones tipo Chrome Compressor) + carga por situaciones.
    load: (() => {
      // El mismo implante en ambos brazos, manos o piernas es un par: su costo cuenta una vez (el del tier más alto).
      const cost = Object.values(best).reduce((t, k) => t + (+ch.implants[k].costs?.[ch.implants[k].tier - 1] || 0), 0);
      const implants = F(cost * Math.max(0, 1 - loadPct / 100));
      return {implants, strain: +ch.strain || 0, used: implants + (+ch.strain || 0), max: sec.implantes.total, pct: loadPct};
    })(),
  };
}

// Devuelve los requisitos que no se cumplen ("DES 60", "Pelea: Agarres 40"); lo desconocido se ignora.
function unmetReqs(req, ch, sh) {
  return String(req || '').split(',').filter(part => {
    const m = part.trim().match(/^(.+?)\s+(\d+)$/);
    if (!m) return false;
    const key = norm(m[1]).split(':')[0].trim();
    const at = ATTRS.find(a => norm(a[2]) === key || norm(a[1]) === key);
    const si = ch.skills.findIndex(s => norm(s.name) === key);
    const de = DEFENSES.find(d => norm(d[1]) === key);
    const val = at ? sh.attrs[at[0]].total : si >= 0 ? sh.skills[si].total : de ? sh.def[de[0]].total : null;
    return val != null && val < +m[2];
  }).map(s => s.trim());
}

function activate(ch, i) {
  const im = ch.implants[i], x = compute(ch).imps[i];
  if (!x.dur || im.on > 0 || im.cdLeft > 0) return false;
  im.on = x.dur;
  return true;
}

// Avanza un turno: baja cooldowns, termina efectos (que pasan a cooldown) y dispara "Se activa al terminar X".
function nextTurn(ch) {
  const sh = compute(ch), ended = [];
  ch.implants.forEach((im, i) => {
    if (im.on > 0) {
      if (--im.on === 0) { im.cdLeft = sh.imps[i].cdEff || 0; ended.push(norm(im.name)); }
    } else if (im.cdLeft > 0) im.cdLeft--;
  });
  ch.implants.forEach((im, i) => {
    const t = sh.imps[i].trigger;
    if (t && ended.includes(t) && !im.on && !im.cdLeft) im.on = sh.imps[i].dur || 1;
  });
  ch.round = (ch.round || 1) + 1;
  ch.paUsed = 0; // los PA se recuperan cada turno
}

const slotUse = (ch, slot) => ch.implants.filter(i => i.slot === slot).length;
const slotFull = (ch, slot) => slotUse(ch, slot) >= (SLOT_LIMITS[slot] ?? Infinity);
// Motivo por el que no se puede instalar (o null): espacio lleno o implante que va en un solo miembro.
const cantInstall = (ch, im) => slotFull(ch, im.slot) ? `${im.slot}: ya tenés el máximo (${SLOT_LIMITS[im.slot]})`
  : SINGLE.includes(norm(im.name)) && ch.implants.some(i => norm(i.name) === norm(im.name)) ? `${im.name} solo se puede tener en un miembro` : null;

function blankCharacter() {
  return {v: 3, name: 'Nuevo personaje', player: '', role: '', roleDesc: '', level: 1, exp: 0,
    age: '', height: '', weight: '', profession: '', appearance: '', look: '',
    attrs: Object.fromEntries(ATTRS.map(([k]) => [k, {ini: 50, lvl: 0}])),
    skills: DEFAULT_SKILLS.map(([name, a, b]) => ({name, a, b, mod: 0, spec: false, custom: false})),
    traits: [], merits: [], implants: [], strain: 0, armor: {normal: 0, termal: 0, electrica: 0, quimica: 0, hack: 0},
    items: [], paUsed: 0, vitality: 0, luck: 50, resolution: 0, round: 1, inventory: '', quick: '', roleDetails: '', notes: ''};
}

// Completa campos faltantes (personajes importados o de versiones viejas) sin pisar lo existente.
function normalize(ch) {
  const b = blankCharacter(), out = {...b, ...ch};
  out.attrs = Object.fromEntries(ATTRS.map(([k]) => [k, {...b.attrs[k], ...(ch.attrs?.[k] || {})}]));
  out.armor = {...b.armor, ...(ch.armor || {})};
  for (const k of ['skills', 'traits', 'merits', 'implants', 'items']) if (!Array.isArray(out[k])) out[k] = b[k];
  // Fichas viejas: agrega las habilidades por defecto que falten (ej. Estilo) y convierte la versión personalizada en la estándar.
  for (const s of out.skills) if (norm(s.name) === 'informatica') s.name = 'Tecnología'; // Tecnología reemplaza a Informática
  for (const t of out.traits) if (norm(t.skill) === 'informatica') t.skill = 'Tecnología';
  for (const [name, a, bb] of DEFAULT_SKILLS) {
    const s = out.skills.find(x => norm(x.name) === norm(name));
    if (s) Object.assign(s, {name, a, b: bb, custom: false});
    else out.skills.push({name, a, b: bb, mod: 0, spec: false, custom: false});
  }
  // Implantes del sistema anterior (6 tiers) se quitan: cada jugador reinstala desde el catálogo nuevo.
  out.implants = out.implants.filter(im => im.v === 2);
  out.implants.forEach(im => { im.on ||= 0; im.cdLeft ||= 0; im.tiers = Array.from({length: 3}, (_, i) => im.tiers?.[i] ?? null);
    im.costs = Array.from({length: 3}, (_, i) => +im.costs?.[i] || 0); im.tier = Math.min(3, Math.max(im.minTier || 1, +im.tier || 1)); });
  return out;
}

globalThis.Rules = {F, norm, LEVEL_POINTS, TARGETS, SLOT_LIMITS, slotUse, slotFull, cantInstall, ATTRS, DEFAULT_SKILLS, DEFENSES, SECONDARY, RD, SLOTS, parseEffect, implantInfo,
  compute, unmetReqs, activate, nextTurn, blankCharacter, normalize};
})();
