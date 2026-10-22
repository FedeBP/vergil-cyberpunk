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
  ['Puntería', 'des', 'per'], ['Informática', 'int', 'des']];
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
  ['resolucion', 'Resolución', 'DET/2', a => a.det / 2],
  ['suerte', 'Suerte', '50', () => 50],
  ['ph', 'PH × NV', 'INT/5+5', a => a.int / 5 + 5],
  ['carga', 'Carga máx. (kg)', '(FUE+CON)/2+20', a => (a.fue + a.con) / 2 + 20],
  ['implantes', 'Límite de implantes', 'DET+CON/2', a => a.det + a.con / 2],
  ['ram', 'RAM', 'Sistema operativo', () => 0],
  ['icewall', 'Icewall', 'Sistema operativo', () => 0]];
const RD = [['normal', 'Normal'], ['termal', 'Termal'], ['electrica', 'Eléctrica'], ['quimica', 'Química']];
const SLOTS = ['Cara / Ojos', 'Corteza frontal', 'Sistema operativo', 'Sistema nervioso', 'Sistema circulatorio',
  'Sistema integumentario', 'Esqueleto', 'Brazo derecho', 'Brazo izquierdo', 'Mano derecha', 'Mano izquierda', 'Piernas'];
const TARGETS = {fuerza: 'fue', destreza: 'des', percepcion: 'per', inteligencia: 'int', determinacion: 'det', constitucion: 'con',
  evasion: 'evasion', reflejos: 'reflejos', fortaleza: 'fortaleza', voluntad: 'voluntad',
  pa: 'pa', 'puntos de accion': 'pa', vitalidad: 'vitalidad', potencia: 'potencia', rango: 'rango', iniciativa: 'iniciativa',
  'velocidad de curacion': 'curacion', resolucion: 'resolucion', suerte: 'suerte', phxnv: 'ph',
  'limite de implantes': 'implantes', ram: 'ram', icewall: 'icewall',
  rd: 'rd', 'rd normal': 'rd.normal', 'rd termal': 'rd.termal', 'rd electrica': 'rd.electrica', 'rd quimica': 'rd.quimica',
  critico: 'crit', 'resultado de critico': 'crit', caracteristica: 'pts', 'turno de duracion': 'dur'};

// Lee un texto de efecto ("+4 PA, D 3T, CD 6T, +10 Reflejos") y devuelve modificadores numéricos.
// Solo cuenta frases exactas "+N Objetivo"; lo condicional ("+10 Puntería con armas SMART") queda como texto.
function parseEffect(text) {
  const out = {mods: [], dur: null, cd: null, trigger: null, cdr: 0};
  for (const seg of String(text || '').split(/\.(?!\d)|\|/)) {
    const s = norm(seg).replace(/mientras (este|esta) activo/, '');
    let m;
    if ((m = s.match(/se activa al terminar (.+)/))) { out.trigger = m[1].trim(); continue; }
    if ((m = s.match(/enfriamiento.*?(\d+)\s*%/))) { out.cdr += +m[1]; continue; }
    if (/\b(cuando|si|grupo)\b/.test(s)) continue;
    for (let ph of s.split(/,| y /)) {
      ph = ph.trim();
      if ((m = ph.match(/^d (\d+)t$/))) { out.dur = +m[1]; continue; }
      if ((m = ph.match(/^cd (\d+)t$/))) { out.cd = +m[1]; continue; }
      m = ph.match(/^([+-])?\s*(\d+)\s+(?:a (?:los |las |la )?)?(.+?)(?: al usar (.+))?$/);
      if (m) out.mods.push({v: (m[1] === '-' ? -1 : 1) * m[2], set: !m[1], target: m[3], when: m[4] || null});
    }
  }
  return out;
}

function resolveTarget(raw, skills) {
  if (TARGETS[raw]) return TARGETS[raw];
  const sk = skills.find(s => norm(s.name) === raw);
  return sk ? 'skill:' + norm(sk.name) : null;
}

function implantInfo(im) {
  const eff = im.tiers.slice(0, im.tier).map(parseEffect);
  const last = k => eff.reduce((v, e) => e[k] ?? v, null);
  return {eff, dur: last('dur'), cd: last('cd'), trigger: last('trigger'), cdr: eff.reduce((t, e) => t + e.cdr, 0)};
}

function compute(ch) {
  const mods = {}, sets = {}, durBonus = {};
  const add = (t, v, src) => (mods[t] ??= []).push({v, src});
  const active = name => ch.implants.some(i => norm(i.name) === norm(name) && i.on > 0);
  let cdr = 0;
  const imps = ch.implants.map(im => {
    const x = implantInfo(im);
    cdr += x.cdr;
    for (const e of x.eff) for (const m of e.mods) {
      const t = resolveTarget(m.target, ch.skills);
      if (!t) continue;
      if (t === 'dur') { if (m.when) durBonus[norm(m.when)] = (durBonus[norm(m.when)] || 0) + m.v; continue; }
      if (m.set) { if (!sets[t] || m.v > sets[t].v) sets[t] = {v: m.v, src: im.name}; continue; }
      if (m.when ? active(m.when) : (!x.dur || im.on > 0)) add(t, m.v, im.name);
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
  // Base: fórmula con características sin modificar. +/-: diferencia por características modificadas + bonos directos.
  const part = (fn, key, extra = []) => {
    const base = F(fn(raw)) + (sets[key]?.v || 0), delta = F(fn(tot)) - F(fn(raw));
    const src = [...(sets[key] ? [{v: sets[key].v, src: sets[key].src + ' (base)'}] : []),
      ...(delta ? [{v: delta, src: 'Características modificadas'}] : []), ...(mods[key] || []), ...extra];
    const mod = delta + sum(mods[key]) + sum(extra);
    return {base, mod, total: base + mod, src};
  };
  const def = Object.fromEntries(DEFENSES.map(([k, , , fn]) => [k, part(fn, k)]));
  const sec = Object.fromEntries(SECONDARY.map(([k, , , fn]) => [k, part(fn, k)]));
  const rd = Object.fromEntries(RD.map(([k]) => [k, part(() => +ch.armor[k] || 0, 'rd.' + k, mods.rd)]));
  const pro = ch.merits.some(m => norm(m.name) === 'el profesional');
  const skills = ch.skills.map(s => {
    const p = part(a => (a[s.a] + a[s.b]) / 5 + 10, 'skill:' + norm(s.name));
    const own = (F(+s.mod) || 0) * (s.spec ? 2 : 1);
    if (s.spec) p.src.push({v: 20, src: 'Especialidad'});
    if (own) p.src.push({v: own, src: s.spec ? 'Puntos ×2 (especialidad)' : 'Puntos asignados'});
    p.mod += own + (s.spec ? 20 : 0);
    p.total = p.base + p.mod;
    p.crit = (F(p.total / 10) + sum(mods.crit)) * (pro ? 2 : 1);
    return p;
  });
  return {
    raw, attrs, def, sec, rd, skills, imps, cdr,
    points: {
      attr: {avail: 10 * (ch.level - 1) + sum(mods.pts), spent: ATTRS.reduce((t, [k]) => t + (+ch.attrs[k].lvl || 0), 0)},
      skill: {avail: sec.ph.total * ch.level, spent: ch.skills.reduce((t, s) => t + (F(+s.mod) || 0), 0)},
    },
    merits: {count: ch.merits.reduce((t, m) => t + (m.ranks || 1), 0), max: Math.min(ch.level, 10)},
    load: {used: ch.implants.reduce((t, i) => t + (+(i.tier >= 6 ? i.load6 : i.load) || 0), 0), max: sec.implantes.total},
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

// d100: 90–94 fallo y 95–100 pifia siempre; crítico si sale ≤ crítico; éxito si ≤ umbral.
function rollStatus(die, threshold, crit) {
  if (die >= 95) return 'pifia';
  if (die >= 90) return 'fallo';
  if (die <= crit) return 'critico';
  return die <= threshold ? 'exito' : 'fallo';
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
}

function blankCharacter() {
  return {v: 3, name: 'Nuevo personaje', player: '', role: '', roleDesc: '', level: 1, exp: 0,
    age: '', height: '', weight: '', profession: '', appearance: '', look: '',
    attrs: Object.fromEntries(ATTRS.map(([k]) => [k, {ini: 50, lvl: 0}])),
    skills: DEFAULT_SKILLS.map(([name, a, b]) => ({name, a, b, mod: 0, spec: false, custom: false})),
    traits: [], merits: [], implants: [], armor: {normal: 0, termal: 0, electrica: 0, quimica: 0},
    vitality: 0, luck: 50, resolution: 0, round: 1, inventory: '', quick: '', roleDetails: '', notes: ''};
}

// Completa campos faltantes (personajes importados o de versiones viejas) sin pisar lo existente.
function normalize(ch) {
  const b = blankCharacter(), out = {...b, ...ch};
  out.attrs = Object.fromEntries(ATTRS.map(([k]) => [k, {...b.attrs[k], ...(ch.attrs?.[k] || {})}]));
  out.armor = {...b.armor, ...(ch.armor || {})};
  for (const k of ['skills', 'traits', 'merits', 'implants']) if (!Array.isArray(out[k])) out[k] = b[k];
  out.implants.forEach(im => { im.on ||= 0; im.cdLeft ||= 0; im.tiers = Array.from({length: 6}, (_, i) => im.tiers?.[i] ?? null); });
  return out;
}

globalThis.Rules = {F, norm, TARGETS, ATTRS, DEFAULT_SKILLS, DEFENSES, SECONDARY, RD, SLOTS, parseEffect, implantInfo,
  compute, unmetReqs, rollStatus, activate, nextTurn, blankCharacter, normalize};
})();
