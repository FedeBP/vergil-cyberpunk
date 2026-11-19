'use strict';
const R = Rules, C = CATALOG, STORE = 'ficha-cyberpunk-v3', OLD = 'vergil-cyberpunk-v2';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const sg = v => (v >= 0 ? '+' : '') + v;
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = x => JSON.parse(JSON.stringify(x));
const ui = {tab: 'resumen', edit: -1, editItem: -1, open: {}};
let db;

// ---------- Datos ----------
const catMerit = name => C.merits.find(m => R.norm(m.name) === R.norm(name));
const catImplant = (name, tier) => { const m = C.implants.find(x => x.name === name); return m && {...clone(m), tier: tier || m.minTier, on: 0, cdLeft: 0}; };
const ch = () => db.chars[db.current];
const hasMerit = (name, c = ch()) => c.merits.some(m => R.norm(m.name) === R.norm(name));

function fillResources(c) {
  const sh = R.compute(c);
  c.vitality = sh.sec.vitalidad.total; c.resolution = sh.sec.resolucion.total; c.luck = sh.sec.suerte.total;
  return c;
}
// Los méritos del catálogo toman siempre la versión vigente (ej. si el DM cambia un efecto); los personalizados no se tocan.
function refreshMerits(c) { c.merits = c.merits.map(m => (!m.custom && catMerit(m.name)) ? {...catMerit(m.name), ranks: Math.min(m.ranks || 1, catMerit(m.name).max)} : m); return c; }
function addChar(c) { const id = uid(); db.chars[id] = refreshMerits(R.normalize(c)); db.current = id; }

// Convierte el guardado de la versión anterior (ficha fija de Vergil) al formato genérico.
function fromV2(o) {
  const c = R.blankCharacter();
  Object.assign(c, {name: o.name, player: o.player, role: o.role, roleDesc: o.roleDesc, level: o.level, exp: o.exp,
    vitality: o.vitality, luck: o.luck, resolution: o.resolution, notes: o.notes || ''});
  for (const [k] of R.ATTRS) c.attrs[k].ini = +o.attrs?.[k] || 0;
  for (const s of c.skills) { const id = R.norm(s.name); s.mod = +o.skillMods?.[id] || 0; s.spec = !!o.specialties?.[id]; }
  c.traits = (o.traits || []).map(([text, skill]) => ({text, skill: String(skill).split(' / ')[0]}));
  c.merits = (o.merits || []).map(m => ({...(catMerit(m.name) || {name: m.name, lvl: 1, req: '-', max: 1, desc: m.effect || ''}), ranks: 1}));
  const names = {kiroshi: 'Kiroshi Clarividente', boost: 'Kerenzikov Boost System', newton: 'Newton Module', kerenzikov: 'Kerenzikov',
    mirror: 'Zetatech Sandevistan (Mirror)', defenzikov: 'Defenzikov'};
  c.implants = Object.entries(o.implants || {}).filter(([, t]) => t > 0).map(([id, t]) => catImplant(names[id], t)).filter(Boolean);
  const a = o.armors || {};
  c.armor = {normal: a.normal || 0, termal: a.thermal || 0, electrica: a.electric || 0, quimica: a.chemical || 0};
  return c;
}

function load() {
  try { db = JSON.parse(localStorage.getItem(STORE)); } catch (e) { db = null; }
  if (!db?.chars || !Object.keys(db.chars).length) {
    db = {chars: {}};
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD)); } catch (e) { /* sin guardado viejo */ }
    addChar(old?.attrs ? fromV2(old) : fillResources(R.blankCharacter()));
  }
  for (const id in db.chars) clampResources(db.chars[id] = refreshMerits(R.normalize(db.chars[id])));
  if (!db.chars[db.current]) db.current = Object.keys(db.chars)[0];
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { toast('No se pudo guardar; exportá un respaldo'); } }
function toast(msg, ms = 2600) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }

// ---------- Helpers de vista ----------
const LABELS = Object.fromEntries([...R.ATTRS.map(a => [a[0], a[1]]), ...R.DEFENSES.map(d => [d[0], d[1]]),
  ...R.SECONDARY.map(s => [s[0], s[1]]), ...R.RD.map(r => ['rd.' + r[0], 'RD ' + r[1]]), ['crit', 'Crítico'], ['pts', 'Puntos de característica']]);
const heading = (num, title, sub = '') => `<div class="heading"><div><div class="section-number">${num} // NIGHT CITY</div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
const why = p => esc(p.src.map(s => `${s.src} ${sg(s.v)}`).join('\n'));
const tile = (label, p, extra = '') => `<div class="tile ${p.mod ? 'emph' : ''}" data-a="why" data-why="${why(p)}" title="${why(p)}"><div class="topline">${label}</div><strong class="big mono">${p.total}</strong><div class="below">base ${p.base} · ${sg(p.mod)}${extra}</div></div>`;
const plain = (label, value, sub = '', cls = '') => `<div class="tile ${cls}"><div class="topline">${label}</div><strong class="big mono">${value}</strong><div class="below">${sub}</div></div>`;
const inp = (path, val, type = 'number', more = '') => `<input data-f="${path}" type="${type}" value="${esc(val)}" ${type === 'number' ? 'inputmode="numeric" step="1"' : ''} ${more}>`;
const field = (label, path, val, type = 'text', more = '') => `<div class="field"><label>${label}</label>${inp(path, val, type, more)}</div>`;
const area = (label, path, val, ph = '') => `<div class="field span"><label>${label}</label><textarea data-f="${path}" placeholder="${ph}">${esc(val)}</textarea></div>`;
const attrSelect = (path, val) => `<select data-f="${path}">${R.ATTRS.map(([k, , ab]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${ab}</option>`).join('')}</select>`;
// Valores fijos ("30 Icewall"): solo cuenta el del tier más alto.
const autoChips = (texts, c) => {
  const mods = texts.flatMap(t => R.parseEffect(t).mods);
  return mods.filter((m, i) => !m.set || !mods.slice(i + 1).some(o => o.set && o.target === m.target)).map(m => {
    const label = labelFor(m.target, c);
    return label && `${m.set ? m.v : sg(m.v)} ${label}${m.when ? ' (con ' + m.when + ')' : ''}`;
  }).filter(Boolean);
};
function labelFor(raw, c) {
  const key = R.TARGETS[raw];
  if (key) return key === 'dur' ? 'turno de duración' : LABELS[key];
  const s = c.skills.find(x => R.norm(x.name) === raw);
  return s ? s.name : null;
}

// ---------- Pestañas ----------
function renderHero(c, sh) {
  $('heroName').textContent = c.name || 'Sin nombre';
  $('heroSub').textContent = [c.player && 'Jugador: ' + c.player, c.role, c.roleDesc].filter(Boolean).join(' · ');
  $('heroTags').innerHTML = `<span class="tag lime">NV ${String(c.level).padStart(2, '0')}</span><span class="tag">${c.exp} EXP</span><span class="tag">CYBERWARE // ${String(c.implants.length).padStart(2, '0')}</span>`;
  const mark = (c.name || '?').trim()[0]?.toUpperCase() || '?';
  $('brandMark').textContent = mark; $('brandName').textContent = (c.name || '').toUpperCase();
  document.querySelector('.hero').dataset.mark = '// ' + mark;
  document.title = `${c.name || 'Ficha'} // Ficha Cyberpunk`;
}

function renderResumen(c, sh) {
  const warn = [];
  if (sh.points.ini.spent !== sh.points.ini.avail) warn.push(`Características iniciales: ${sh.points.ini.spent} asignados de ${sh.points.ini.avail}.`);
  if (sh.points.attr.spent > sh.points.attr.avail) warn.push(`Características: ${sh.points.attr.spent} puntos por nivel asignados de ${sh.points.attr.avail}.`);
  if (sh.points.skill.spent > sh.points.skill.avail) warn.push(`Habilidades: ${sh.points.skill.spent} PH asignados de ${sh.points.skill.avail}.`);
  if (sh.merits.count > sh.merits.max) warn.push(`Méritos: ${sh.merits.count} de ${sh.merits.max} permitidos.`);
  for (const slot of R.SLOTS) if (R.slotUse(c, slot) > R.SLOT_LIMITS[slot]) warn.push(`${slot}: ${R.slotUse(c, slot)} implantes, el máximo es ${R.SLOT_LIMITS[slot]}.`);
  if (sh.load.used > sh.load.max) warn.push(`Implantes: carga ${sh.load.used} supera el límite ${sh.load.max}.`);
  return heading('01', 'Panel principal', 'Tocá un valor para ver de dónde sale su +/-.') +
    warn.map(w => `<div class="hint-bubble warn">${esc(w)}</div>`).join('') +
    `<div class="grid four">${plain('Vitalidad', `${c.vitality}/${sh.sec.vitalidad.total}`, 'actual / máx.', 'emph')}${tile('PA', sh.sec.pa)}${plain('Suerte', `${c.luck}/${sh.sec.suerte.total}`, 'recurso')}${plain('Resolución', `${c.resolution}/${sh.sec.resolucion.total}`, 'recurso')}</div>` +
    heading('02', 'Características') + `<div class="grid three">${R.ATTRS.map(([k, l]) => tile(l, sh.attrs[k])).join('')}</div>` +
    heading('03', 'Defensas') + `<div class="grid four">${R.DEFENSES.map(([k, l, f]) => tile(l, sh.def[k], `<br>${f}`)).join('')}</div>` +
    `<div class="grid four" style="margin-top:10px">${R.RD.map(([k, l]) => tile('RD ' + l, sh.rd[k])).join('')}</div>` +
    heading('04', 'Características secundarias') +
    `<div class="grid three">${R.SECONDARY.filter(s => !['pa', 'vitalidad', 'suerte', 'resolucion'].includes(s[0]) && (!['ram', 'icewall'].includes(s[0]) || sh.sec[s[0]].total))
      .map(([k, l, f]) => tile(l, sh.sec[k], `<br>${f}`)).join('')}${plain('Carga de implantes', `${sh.load.used}/${sh.load.max}`, 'DET+CON/2', sh.load.used > sh.load.max ? 'bad' : '')}</div>`;
}

const ab = k => R.ATTRS.find(a => a[0] === k)[2];
const formula = s => (s.a === s.b ? `(${ab(s.a)}×2)` : `(${ab(s.a)}+${ab(s.b)})`) + '/5+10';
function renderSkills(c, sh) {
  const pts = sh.points.skill;
  const rows = c.skills.map((s, i) => {
    const p = sh.skills[i];
    const head = s.custom
      ? `<div class="custom-skill">${inp(`skills.${i}.name`, s.name, 'text', 'aria-label="Nombre"')}<div class="pair">(${attrSelect(`skills.${i}.a`, s.a)}+${attrSelect(`skills.${i}.b`, s.b)})/5+10</div><div class="skill-formula">${formula(s)} · para ×2 elegí el mismo atributo dos veces</div></div>`
      : `<div class="skill-name">${esc(s.name)}${s.spec ? ' <span class="yellow">★</span>' : ''}</div><div class="skill-formula">${formula(s)}</div>`;
    return `<div class="skill-row"><div>${head}<div class="skill-note">base ${p.base} · ${p.src.map(x => `${esc(x.src)} ${sg(x.v)}`).join(' · ') || 'sin modificadores'}</div>
      <div class="row-tools"><label class="check-inline"><input type="checkbox" data-f="skills.${i}.spec" ${s.spec ? 'checked' : ''}> Especialidad</label>${s.custom ? `<button class="btn tiny ghost" data-a="delSkill" data-i="${i}">Quitar</button>` : ''}</div></div>
      ${inp(`skills.${i}.mod`, s.mod, 'number', `aria-label="Puntos en ${esc(s.name)}"`)}<div class="skill-score ${s.spec ? 'yellow' : ''}">${p.total}</div><div class="skill-score">${p.crit}</div></div>`;
  }).join('');
  const skillOpts = sel => c.skills.map(s => `<option ${s.name === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  return heading('01', 'Habilidades', 'La base sale de la fórmula. Vos asignás los puntos (+/-); especialidad suma +20 y duplica tus puntos.') +
    `<div class="grid three">${plain('PH por nivel', sh.sec.ph.total, 'INT/5+5')}${plain('PH disponibles', pts.avail, `INT/2+30 + PH × ${c.level - 1} niveles`)}${plain('PH asignados', pts.spent, pts.spent > pts.avail ? 'Te pasaste' : `Quedan ${pts.avail - pts.spent}`, pts.spent > pts.avail ? 'bad' : 'emph')}</div>` +
    `<div class="card"><div class="skill-headers"><span style="text-align:left">HABILIDAD</span><span>PUNTOS</span><span>TOTAL</span><span>CRÍT.</span></div>${rows}
     <div class="actions" style="margin-top:12px"><button class="btn" data-a="addSkill">+ Agregar habilidad</button></div></div>` +
    heading('02', 'Rasgos y especialidades situacionales', 'Suman +20 a la tirada cuando aplican.') +
    `<div class="card">${c.traits.map((t, i) => `<div class="trait-row">${inp(`traits.${i}.text`, t.text, 'text', 'placeholder="Ej: Especialidad en Pelea con armas grandes"')}<select data-f="traits.${i}.skill">${skillOpts(t.skill)}</select><button class="btn tiny ghost" data-a="delTrait" data-i="${i}" aria-label="Quitar rasgo">✕</button></div>`).join('') || '<p class="empty">Sin rasgos.</p>'}
     <div class="actions" style="margin-top:12px"><button class="btn" data-a="addTrait">+ Agregar rasgo</button></div></div>`;
}

function renderCombat(c, sh) {
  const active = c.implants.map((im, i) => [im, sh.imps[i], i]).filter(([, x]) => x.dur);
  const half = (merit, v) => hasMerit(merit) ? Math.ceil(v / 2) : v;
  const res = (id, label, max, btns, foot) => `<div class="resource-card"><h3>${label}</h3><div class="number">${c[id]} <span class="muted small">/ ${max}</span></div><div class="mini-bar"><div class="mini-fill" style="width:${Math.max(0, Math.min(100, c[id] / Math.max(1, max) * 100))}%"></div></div><div class="stat-footer">${foot}</div><div class="resource-buttons">${btns.map(([v, l]) => `<button class="btn tiny" data-a="res" data-id="${id}" data-v="${v}">${l || sg(v)}</button>`).join('')}</div></div>`;
  return heading('01', 'Control de combate', 'Los cooldowns arrancan al terminar el efecto y se redondean hacia arriba.') +
    `<div class="combat-head"><div class="row wrap"><div><div class="eyebrow">ENCUENTRO ACTUAL</div><div class="round-number">TURNO <span class="yellow">${c.round}</span></div></div><div class="actions"><button class="btn primary" data-a="nextTurn">Siguiente turno →</button><button class="btn ghost" data-a="resetCombat">Reiniciar</button></div></div></div>` +
    `<div class="grid four">${tile('PA', sh.sec.pa)}${tile('Reflejos', sh.def.reflejos)}${tile('Evasión', sh.def.evasion)}${tile('Iniciativa', sh.sec.iniciativa)}</div>` +
    combatPreviews(c, sh) +
    heading('02', 'Implantes activables', sh.cdr ? `Reducción de cooldown: ${sh.cdr}%` : '') +
    `<div class="card">${active.map(([im, x, i]) => `<div class="combat-implant"><div><div class="title">${esc(im.name)}</div><div style="margin-top:7px">${im.on ? `<span class="pill on">ACTIVO · ${im.on}T</span>` : im.cdLeft ? `<span class="pill cool">CD · ${im.cdLeft}T</span>` : '<span class="pill ready">LISTO</span>'} <span class="pill">D ${x.dur}T / CD ${x.cdEff}T</span>${x.trigger ? ` <span class="pill">auto tras ${esc(x.trigger)}</span>` : ''}</div></div><div class="buttonish"><button class="btn tiny ${!im.on && !im.cdLeft ? 'primary' : ''}" data-a="activate" data-i="${i}" ${im.on || im.cdLeft ? 'disabled' : ''}>Activar</button><button class="btn tiny" data-a="cd" data-i="${i}" data-v="-1" aria-label="Restar cooldown">−</button><button class="btn tiny" data-a="cd" data-i="${i}" data-v="1" aria-label="Sumar cooldown">+</button></div></div>`).join('') || '<p class="empty">Ningún implante tiene duración (D) y enfriamiento (CD).</p>'}</div>` +
    heading('03', 'Recursos') + `<div class="grid two">
      ${res('vitality', 'Vitalidad', sh.sec.vitalidad.total, [[-10], [-1], [1], [10]], `Curación ${sh.sec.curacion.total} por turno`)}
      ${res('luck', 'Suerte', sh.sec.suerte.total, [[-half('Tocado por la fortuna', 5), `Retirar fallo −${half('Tocado por la fortuna', 5)}`], [-half('Tocado por la fortuna', 10), `Retirar pifia −${half('Tocado por la fortuna', 10)}`], [1], [5]], 'Se regenera aceptando pifias')}
      ${res('resolution', 'Resolución', sh.sec.resolucion.total, [[-half('Fuerza de voluntad', 5), `Éxito automático −${half('Fuerza de voluntad', 5)}`], [1]], 'Se recupera cumpliendo el rol del personaje')}
      <div class="resource-card"><h3>Resistencias</h3>${R.RD.map(([k, l]) => `<div class="readonly-stat"><strong>${l}</strong><b>${sh.rd[k].total}</b></div>`).join('')}</div></div>`;
}

// Tiers con texto (un chip solo tiene T1); un implante personalizado vacío muestra los 6.
const tierList = im => { const l = [1, 2, 3, 4, 5, 6].filter(t => im.tiers[t - 1]); return l.length ? l : [1, 2, 3, 4, 5, 6]; };
const slotLabel = (c, slot) => R.SLOT_LIMITS[slot] === Infinity ? '' : ` (${R.slotUse(c, slot)}/${R.SLOT_LIMITS[slot]})`;
function renderImplants(c, sh) {
  const groups = R.SLOTS.map(slot => [slot, C.implants.filter(i => i.slot === slot)]).filter(([, l]) => l.length);
  return heading('01', 'Implantes', 'Los efectos “+N Algo” se aplican solos al +/- que corresponda. Lo condicional queda como texto.') +
    `<div class="grid four">${plain('Carga', `${sh.load.used}/${sh.load.max}`, 'DET + CON/2', sh.load.used > sh.load.max ? 'bad' : 'emph')}${plain('Enfriamiento', `−${sh.cdr}%`, 'cooldowns')}${tile('RAM', sh.sec.ram)}${tile('Icewall', sh.sec.icewall)}</div>
    <div class="mini-bar" style="height:8px;margin:13px 0"><div class="mini-fill" style="width:${Math.min(100, sh.load.used / Math.max(1, sh.load.max) * 100)}%;background:${sh.load.used > sh.load.max ? 'var(--red)' : 'var(--yellow)'}"></div></div>
    <div class="card"><label>Instalar implante</label><div class="select-roll"><select id="addImplant"><option value="">Elegí del catálogo…</option>${groups.map(([slot, l]) => `<optgroup label="${esc(slot)}${slotLabel(c, slot)}">${l.map(i => `<option value="${C.implants.indexOf(i)}" ${R.slotFull(c, slot) ? 'disabled' : ''}>${esc(i.name)}</option>`).join('')}</optgroup>`).join('')}<option value="*">Personalizado…</option></select><button class="btn primary" data-a="addImplant">Instalar</button></div></div>` +
    c.implants.map((im, i) => {
      const x = sh.imps[i], edit = ui.edit === i, chips = autoChips(im.tiers.slice(0, im.tier).filter(Boolean), c);
      const price = im.price && im.tier < 6 ? im.price * 2 ** (im.tier + 1 - im.minTier) : 0;
      return `<div class="implant"><div class="implant-top"><div><div class="eyebrow" style="color:var(--muted);font-size:9px">${esc(im.slot).toUpperCase()}</div><h3>${esc(im.name)}</h3>${im.desc ? `<div class="help">${esc(im.desc)}</div>` : ''}<small>Tier ${im.tier} · Carga ${im.tier >= 6 ? im.load6 : im.load}${x.dur ? ` · D ${x.dur}T / CD ${x.cdEff}T` : ''}</small></div><div class="actions"><button class="btn tiny" data-a="editImp" data-i="${i}">${edit ? 'Listo' : 'Editar'}</button><button class="btn tiny danger" data-a="delImp" data-i="${i}">Quitar</button></div></div>
        <div class="tier-wrap">${tierList(im).map(t => `<button class="tier-dot ${t === im.tier ? 'selected' : t < im.tier ? 'past' : ''}" data-a="tier" data-i="${i}" data-v="${t}" aria-label="Tier ${t}">${t}</button>`).join('')}</div>
        ${chips.length ? `<div class="chips">${chips.map(t => `<span class="pill on">${esc(t)}</span>`).join('')}${x.dur ? '<span class="pill">solo activo</span>' : ''}</div>` : ''}
        ${edit ? `<div class="field-grid" style="margin-top:12px">${field('Nombre', `implants.${i}.name`, im.name)}<div class="field"><label>Ranura</label><select data-f="implants.${i}.slot">${R.SLOTS.map(s => `<option ${s === im.slot ? 'selected' : R.slotFull(c, s) ? 'disabled' : ''}>${s}${slotLabel(c, s)}</option>`).join('')}</select></div>${field('Carga T1–T5', `implants.${i}.load`, im.load, 'number')}${field('Carga T6', `implants.${i}.load6`, im.load6, 'number')}
          ${im.tiers.map((t, k) => area(`Tier ${k + 1}`, `implants.${i}.tiers.${k}`, t || '', 'Ej: +10 Reflejos, D 2T, CD 6T')).join('')}</div>
          <p class="help">Se aplica solo lo escrito como “+N Objetivo” (Percepción, Reflejos, PA, RD, Pelea…). “D 2T, CD 6T” lo vuelve activable: sus bonos valen solo activo. “+N X al usar Kerenzikov” vale con ese implante activo. “N RAM” sin signo fija un valor base.</p>`
        : `<ul class="effect-list">${im.tiers.map((t, k) => k < im.tier && t ? `<li><strong>T${k + 1}:</strong> ${esc(t)}</li>` : '').join('')}</ul>${im.tier < 6 && im.tiers[im.tier] ? `<div class="next-tier"><b>Tier ${im.tier + 1}:</b> ${esc(im.tiers[im.tier])}${price ? ` · <span class="yellow">${price.toLocaleString('es-AR')} €$</span>` : ''}</div>` : ''}`}</div>`;
    }).join('');
}

function renderPerfil(c, sh) {
  const pa = sh.points.attr;
  const merits = c.merits.map((m, i) => {
    const bad = [...R.unmetReqs(m.req, c, sh), ...(m.lvl > c.level ? [`nivel ${m.lvl}`] : [])];
    const chips = autoChips([m.desc], c);
    return `<div class="merit"><div class="row"><div><span class="pill">N${m.lvl}</span> <b>${esc(m.name)}</b>${m.req && m.req !== '-' ? ` <span class="muted small">req. ${esc(m.req)}</span>` : ''}</div><div class="actions">${m.max > 1 ? `<button class="btn tiny" data-a="rank" data-i="${i}" data-v="-1">−</button><span class="pill">${m.ranks}/${m.max}</span><button class="btn tiny" data-a="rank" data-i="${i}" data-v="1">+</button>` : ''}<button class="btn tiny ghost" data-a="delMerit" data-i="${i}" aria-label="Quitar mérito">✕</button></div></div>
      ${bad.length ? `<div class="red small">No cumple: ${esc(bad.join(', '))}</div>` : ''}
      ${m.custom ? `<div class="field-grid" style="margin-top:8px">${field('Nombre', `merits.${i}.name`, m.name)}${field('Efecto', `merits.${i}.desc`, m.desc)}</div>` : `<div class="help">${esc(m.desc)}</div>`}
      ${chips.length ? `<div class="chips">${chips.map(t => `<span class="pill on">${esc(t)}${m.ranks > 1 ? ' ×' + m.ranks : ''}</span>`).join('')}</div>` : ''}</div>`;
  }).join('');
  const lvls = [...new Set(C.merits.map(m => m.lvl))];
  return heading('01', 'Personajes', 'Todo se guarda en este dispositivo. Exportá para pasarlo a otro.') +
    `<div class="card"><div class="select-roll"><select data-a-change="switch">${Object.entries(db.chars).map(([id, x]) => `<option value="${id}" ${id === db.current ? 'selected' : ''}>${esc(x.name || 'Sin nombre')}${x.player ? ' — ' + esc(x.player) : ''}</option>`).join('')}</select><button class="btn primary" data-a="newChar">Nuevo</button></div>
      <div class="actions" style="margin-top:10px"><button class="btn" data-a="dupChar">Duplicar</button><button class="btn" data-a="export">Exportar JSON</button><button class="btn" data-a="import">Importar JSON</button><button class="btn danger" data-a="delChar">Borrar</button><input type="file" id="importFile" accept=".json,application/json" hidden></div></div>` +
    heading('02', 'Identidad') +
    `<div class="card"><div class="field-grid">${field('Personaje', 'name', c.name)}${field('Jugador', 'player', c.player)}${field('Nivel', 'level', c.level, 'number', 'min="1"')}${field('Experiencia', 'exp', c.exp, 'number', 'min="0"')}${field('Rol', 'role', c.role)}${field('Profesión', 'profession', c.profession)}${area('Descripción del rol', 'roleDesc', c.roleDesc)}${field('Edad', 'age', c.age)}${field('Estatura', 'height', c.height)}${field('Peso', 'weight', c.weight)}${field('Aspecto', 'look', c.look)}${area('Apariencia', 'appearance', c.appearance)}</div></div>` +
    heading('03', 'Características', 'Inicial: lo que tenías al crear el personaje. Por nivel: los ${R.LEVEL_POINTS} puntos que ganás en cada nivel subido.') +
    `<div class="grid two">${[['Iniciales', sh.points.ini, 'al crear el personaje'], ['Por nivel', pa, `${R.LEVEL_POINTS} × ${c.level - 1} niveles${pa.avail !== R.LEVEL_POINTS * (c.level - 1) ? ' + méritos' : ''}`]].map(([l, x, sub]) => { const left = x.avail - x.spent; return plain(l, `${x.spent}/${x.avail}`, left ? (left < 0 ? `Te pasaste ${-left}` : `Quedan ${left}`) + ' · ' + sub : sub, left < 0 ? 'bad' : left ? 'emph' : ''); }).join('')}</div>
     <div class="card"><div class="attr-row head"><span>CARACT.</span><span>INICIAL</span><span>POR NIVEL</span><span>+/-</span><span>TOTAL</span></div>${R.ATTRS.map(([k, l, ab]) => `<div class="attr-row"><strong title="${l}">${ab}</strong>${inp(`attrs.${k}.ini`, c.attrs[k].ini, 'number', 'min="0"')}${inp(`attrs.${k}.lvl`, c.attrs[k].lvl, 'number', 'min="0"')}<span class="yellow mono" title="${why(sh.attrs[k])}">${sg(sh.attrs[k].mod)}</span><b class="mono">${sh.attrs[k].total}</b></div>`).join('')}</div>` +
    heading('04', 'Méritos', `1 por nivel, máximo 10 · ${sh.merits.count}/${sh.merits.max}`) +
    `<div class="card">${merits || '<p class="empty">Sin méritos.</p>'}<label style="margin-top:12px">Agregar mérito</label><div class="select-roll"><select id="addMerit"><option value="">Elegí…</option>${lvls.map(l => `<optgroup label="Nivel ${l}">${C.merits.filter(m => m.lvl === l).map(m => `<option ${l > c.level ? 'disabled' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}<option value="*">Personalizado…</option></select><button class="btn primary" data-a="addMerit">Agregar</button></div></div>` +
    heading('05', 'Equipo') +
    `<div class="card"><div class="field-grid">${R.RD.map(([k, l]) => field('RD equipo · ' + l, `armor.${k}`, c.armor[k], 'number')).join('')}</div></div>` +
    heading('06', 'Rol y notas') + `<div class="card"><div class="field-grid">${area('Detalles de rol', 'roleDetails', c.roleDetails)}${area('Notas', 'notes', c.notes)}</div></div>`;
}

// ---------- Inventario ----------
const ELEMENTS = ['Eléctrico', 'Térmico', 'Químico'];
const WEAPON_FIELDS = [['pa', 'PA por golpe'], ['efecto', 'Efecto al golpear'], ['precision', 'Precisión'], ['rango', 'Rango'],
  ['cap', 'Capacidad'], ['modo', 'Modo'], ['tipo', 'Tipo'], ['calibre', 'Calibre'], ['rec', 'Rec.'], ['marca', 'Marca']];
const blankWeapon = () => ({kind: 'weapon', cat: 'Arma personalizada', name: 'Arma nueva', qty: 1, skill: 'Pelea', base: '', dados: '', elem: [],
  crit: 0, ...Object.fromEntries(WEAPON_FIELDS.map(([k]) => [k, ''])), notes: ''});
// "18/30" + "3d6/d6" -> "18+3d6 / 30+d6" (un valor por modo de disparo), más los dados elementales.
function damage(w) {
  const dice = String(w.dados || '').split('/');
  const modes = String(w.base || '').split('/').map((b, i) => [b.trim(), (dice[i] || '').trim()].filter(Boolean).join('+')).filter(Boolean);
  return [modes.join(' / ') || '—', ...(w.elem || []).filter(e => e.dados).map(e => `${e.dados} ${e.tipo.toLowerCase()}`)].join(' + ');
}
function weaponCrit(w, c, sh) {
  const i = c.skills.findIndex(s => s.name === w.skill);
  return i < 0 ? null : {skill: c.skills[i].name, total: sh.skills[i].total, crit: sh.skills[i].crit + (Math.floor(+w.crit) || 0)};
}
const kv = pairs => `<div class="kv">${pairs.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
const weaponKv = (w, c, sh) => { const r = weaponCrit(w, c, sh);
  return kv([['Daño', damage(w)], ...(r ? [[r.skill, r.total], ['Crítico', `${r.crit}${+w.crit ? ` (${sg(+w.crit)} arma)` : ''}`]] : []), ...WEAPON_FIELDS.map(([k, l]) => [l, w[k]])]); };
const qtyBtns = (i, it) => `<button class="btn tiny" data-a="qty" data-i="${i}" data-v="-1" aria-label="Restar uno">−</button><span class="pill">×${it.qty}</span><button class="btn tiny" data-a="qty" data-i="${i}" data-v="1" aria-label="Sumar uno">+</button>`;

function itemCard(it, i, c, sh) {
  const edit = ui.editItem === i, w = it.kind === 'weapon';
  const head = `<div class="implant-top"><div><div class="eyebrow" style="color:var(--muted);font-size:9px">${esc(it.cat).toUpperCase()}</div><h3>${esc(it.name)}</h3></div>
    <div class="actions">${qtyBtns(i, it)}<button class="btn tiny" data-a="editItem" data-i="${i}">${edit ? 'Listo' : 'Editar'}</button><button class="btn tiny danger" data-a="delItem" data-i="${i}">Quitar</button></div></div>`;
  if (!edit) return `<div class="implant">${head}${w ? weaponKv(it, c, sh) : kv(Object.entries(it.attrs || {}))}${it.notes ? `<div class="help" style="margin-top:8px">${esc(it.notes)}</div>` : ''}</div>`;
  const f = (label, k, type = 'text', more = '') => field(label, `items.${i}.${k}`, it[k], type, more);
  const body = w ? `${f('Nombre', 'name')}<div class="field"><label>Habilidad</label><select data-f="items.${i}.skill">${c.skills.map(s => `<option ${s.name === it.skill ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      ${f('Daño base', 'base', 'text', 'placeholder="Ej: 12 (o 18/30 si tiene dos modos)"')}${f('Dados de daño', 'dados', 'text', 'placeholder="Ej: 3d6"')}
      ${f('Crítico +/-', 'crit', 'number')}${WEAPON_FIELDS.map(([k, l]) => f(l, k, 'text', k === 'efecto' ? 'placeholder="Ej: -4PA,-10RD"' : '')).join('')}
      <div class="field span"><label>Daño elemental</label>${it.elem.map((e, k) => `<div class="trait-row">${inp(`items.${i}.elem.${k}.dados`, e.dados, 'text', 'placeholder="Ej: 2d6" aria-label="Dados elementales"')}<select data-f="items.${i}.elem.${k}.tipo">${ELEMENTS.map(t => `<option ${t === e.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn tiny ghost" data-a="delElem" data-i="${i}" data-k="${k}" aria-label="Quitar daño elemental">✕</button></div>`).join('')}
        <button class="btn tiny" data-a="addElem" data-i="${i}">+ Daño elemental</button></div>`
    : `${f('Nombre', 'name')}${f('Categoría', 'cat')}${it.attrs && Object.keys(it.attrs).length ? `<div class="field span">${kv(Object.entries(it.attrs))}</div>` : ''}`;
  return `<div class="implant">${head}<div class="field-grid" style="margin-top:12px">${body}${area('Notas', `items.${i}.notes`, it.notes, w ? 'Ej: efecto especial al golpear' : 'Descripción')}</div></div>`;
}

function renderInventory(c, sh) {
  const cats = [...new Set(C.items.map(x => x.cat))];
  const list = kind => c.items.map((it, i) => [it, i]).filter(([it]) => (it.kind === 'weapon') === (kind === 'weapon'));
  const cards = kind => list(kind).map(([it, i]) => itemCard(it, i, c, sh)).join('') || `<div class="card"><p class="empty">${kind === 'weapon' ? 'Sin armas.' : 'Sin objetos.'}</p></div>`;
  return heading('01', 'Inventario', 'Armas, consumibles, mejoras y quickhacks del Excel, o los tuyos propios.') +
    `<div class="card"><label>Agregar del catálogo</label><div class="select-roll"><select id="addItem"><option value="">Elegí…</option>${cats.map(cat => `<optgroup label="${esc(cat)}">${C.items.filter(x => x.cat === cat).map(x => `<option value="${C.items.indexOf(x)}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select><button class="btn primary" data-a="addItem">Agregar</button></div>
      <div class="actions" style="margin-top:10px"><button class="btn" data-a="addCustom" data-kind="weapon">+ Arma personalizada</button><button class="btn" data-a="addCustom" data-kind="item">+ Objeto personalizado</button></div></div>` +
    heading('02', 'Armas') + cards('weapon') +
    heading('03', 'Consumibles y objetos') + cards('item') +
    heading('04', 'Notas', `Carga máxima ${sh.sec.carga.total} kg`) + `<div class="card"><div class="field-grid">${area('Otros objetos', 'inventory', c.inventory)}${area('Acceso rápido', 'quick', c.quick)}</div></div>`;
}

// Vistas rápidas desplegables de Combate; recuerdan si estaban abiertas entre redibujos.
const fold = (k, title, body) => `<details class="fold" data-k="${k}" ${ui.open[k] ? 'open' : ''}><summary>${title}</summary><div class="fold-body">${body}</div></details>`;
function combatPreviews(c, sh) {
  const weapons = c.items.map((it, i) => [it, i]).filter(([it]) => it.kind === 'weapon');
  const others = c.items.map((it, i) => [it, i]).filter(([it]) => it.kind !== 'weapon');
  const inv = weapons.map(([w]) => `<div class="mini-item"><b>${esc(w.name)}</b>${weaponKv(w, c, sh)}</div>`).join('') +
    others.map(([it, i]) => `<div class="mini-item row"><span><b>${esc(it.name)}</b> <span class="muted small">${esc(it.attrs?.Efecto || it.notes || '')}</span></span><span class="actions">${qtyBtns(i, it)}</span></div>`).join('');
  const stats = kv(R.ATTRS.map(([k, l]) => [l, sh.attrs[k].total])) + '<hr>' +
    kv(c.skills.map((s, i) => [s.name + (s.spec ? ' ★' : ''), `${sh.skills[i].total} · crít. ${sh.skills[i].crit}`])) + '<hr>' +
    kv([...R.DEFENSES.map(([k, l]) => [l, sh.def[k].total]), ['Potencia', sh.sec.potencia.total], ['Rango', sh.sec.rango.total]]) +
    (c.traits.length ? '<hr>' + c.traits.map(t => `<div class="help">+20 ${esc(t.skill)}: ${esc(t.text)}</div>`).join('') : '');
  return fold('inv', 'Inventario', inv || '<p class="empty">Inventario vacío.</p>') + fold('stats', 'Atributos y habilidades', stats);
}

const TABS = {resumen: renderResumen, habilidades: renderSkills, combate: renderCombat, inventario: renderInventory, implantes: renderImplants, perfil: renderPerfil};
function render() {
  const c = ch(), sh = R.compute(c);
  renderHero(c, sh);
  $('tab-' + ui.tab).innerHTML = TABS[ui.tab](c, sh);
}
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll('.panel').forEach(el => el.classList.toggle('active', el.id === 'tab-' + tab));
  document.querySelectorAll('.tab-button').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  render(); window.scrollTo({top: 0});
}

// ---------- Edición ----------
function setPath(path, el) {
  const parts = path.split('.'), key = parts.pop();
  let o = ch();
  for (const p of parts) { o = o?.[p]; if (o == null || typeof o !== 'object') return; }
  if (!(key in o)) return;
  o[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.floor(Number(el.value)) || 0 : el.value;
  const c = ch();
  c.level = Math.max(1, c.level);
  for (const [k] of R.ATTRS) { c.attrs[k].ini = Math.max(0, c.attrs[k].ini); c.attrs[k].lvl = Math.max(0, c.attrs[k].lvl); }
  clampResources();
}
function clampResources(c = ch()) {
  const sh = R.compute(c), lim = (v, max, min = 0) => Math.max(min, Math.min(max, Math.floor(+v) || 0));
  c.vitality = lim(c.vitality, sh.sec.vitalidad.total);
  c.luck = lim(c.luck, sh.sec.suerte.total, hasMerit('Trébol de 4 hojas', c) ? Math.min(5, sh.sec.suerte.total) : 0);
  c.resolution = lim(c.resolution, sh.sec.resolucion.total, hasMerit('Rendirse, jamás', c) ? Math.min(5, sh.sec.resolucion.total) : 0);
}

function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'}));
  const a = Object.assign(document.createElement('a'), {href: url, download: name});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importChar(obj) {
  const c = obj?.character || obj;
  if (!c || typeof c !== 'object' || !c.attrs || !Array.isArray(c.skills)) throw Error('Formato inválido');
  addChar(c);
}

const ACTIONS = {
  why(el) { if (el.dataset.why) toast(el.dataset.why, 4500); },
  addSkill() { ch().skills.push({name: 'Nueva habilidad', a: 'int', b: 'int', mod: 0, spec: false, custom: true}); },
  delSkill(el) { ch().skills.splice(+el.dataset.i, 1); },
  addTrait() { ch().traits.push({text: '', skill: ch().skills[0]?.name || ''}); },
  delTrait(el) { ch().traits.splice(+el.dataset.i, 1); },
  nextTurn() { R.nextTurn(ch()); },
  resetCombat() { if (!confirm('¿Reiniciar turno, efectos activos y cooldowns?')) return false; ch().round = 1; ch().implants.forEach(i => { i.on = 0; i.cdLeft = 0; }); },
  activate(el) { R.activate(ch(), +el.dataset.i); },
  cd(el) { const im = ch().implants[+el.dataset.i]; im.cdLeft = Math.max(0, im.cdLeft + +el.dataset.v); },
  res(el) { ch()[el.dataset.id] += +el.dataset.v; clampResources(); },
  addItem() {
    const v = $('addItem').value;
    if (!v) return false;
    const x = clone(C.items[+v]);
    ch().items.push(x.kind === 'weapon' ? {...blankWeapon(), ...x, skill: 'Puntería'} : {...x, qty: 1, notes: ''});
    toast(x.name + ' agregado');
  },
  addCustom(el) {
    ch().items.push(el.dataset.kind === 'weapon' ? blankWeapon() : {kind: 'item', cat: 'Objeto', name: 'Objeto nuevo', qty: 1, attrs: {}, notes: ''});
    ui.editItem = ch().items.length - 1;
  },
  delItem(el) { const it = ch().items[+el.dataset.i]; if (!confirm(`¿Quitar ${it.name}?`)) return false; ch().items.splice(+el.dataset.i, 1); ui.editItem = -1; },
  editItem(el) { ui.editItem = ui.editItem === +el.dataset.i ? -1 : +el.dataset.i; },
  qty(el) { const it = ch().items[+el.dataset.i]; it.qty = Math.max(0, (+it.qty || 0) + +el.dataset.v); },
  addElem(el) { ch().items[+el.dataset.i].elem.push({dados: '', tipo: ELEMENTS[0]}); },
  delElem(el) { ch().items[+el.dataset.i].elem.splice(+el.dataset.k, 1); },
  addImplant() {
    const v = $('addImplant').value;
    if (!v) return false;
    const im = v === '*' ? {name: 'Implante personalizado', slot: R.SLOTS.find(s => !R.slotFull(ch(), s)), minTier: 1, tier: 1, load: 0, load6: 0, price: null, desc: '', tiers: Array(6).fill(null), on: 0, cdLeft: 0}
      : {...clone(C.implants[+v]), tier: C.implants[+v].minTier, on: 0, cdLeft: 0};
    if (R.slotFull(ch(), im.slot)) { toast(`${im.slot}: ya tenés el máximo (${R.SLOT_LIMITS[im.slot]})`); return false; }
    ch().implants.push(im);
    if (v === '*') ui.edit = ch().implants.length - 1;
    toast(im.name + ' instalado');
  },
  delImp(el) { const im = ch().implants[+el.dataset.i]; if (!confirm(`¿Quitar ${im.name}?`)) return false; ch().implants.splice(+el.dataset.i, 1); ui.edit = -1; clampResources(); },
  editImp(el) { ui.edit = ui.edit === +el.dataset.i ? -1 : +el.dataset.i; },
  tier(el) { ch().implants[+el.dataset.i].tier = +el.dataset.v; clampResources(); },
  addMerit() {
    const v = $('addMerit').value;
    if (!v) return false;
    ch().merits.push(v === '*' ? {name: 'Mérito personalizado', lvl: 1, req: '-', max: 10, desc: '', ranks: 1, custom: true} : {...catMerit(v), ranks: 1});
    clampResources();
  },
  delMerit(el) { ch().merits.splice(+el.dataset.i, 1); clampResources(); },
  rank(el) { const m = ch().merits[+el.dataset.i]; m.ranks = Math.max(1, Math.min(m.max, m.ranks + +el.dataset.v)); clampResources(); },
  newChar() { addChar(fillResources(R.blankCharacter())); toast('Personaje nuevo creado'); },
  dupChar() { const c = clone(ch()); c.name += ' (copia)'; addChar(c); },
  delChar() {
    if (!confirm(`¿Borrar a ${ch().name} de este dispositivo? No se puede deshacer (exportalo antes si lo querés).`)) return false;
    delete db.chars[db.current];
    if (!Object.keys(db.chars).length) addChar(fillResources(R.blankCharacter()));
    db.current = Object.keys(db.chars)[0];
  },
  export() { download(`${(ch().name || 'personaje').replace(/[^\w-]+/g, '_')}.json`, {format: 'ficha-cyberpunk', exportedAt: new Date().toISOString(), character: ch()}); return false; },
  import() { $('importFile').click(); return false; },
};

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) return setTab(tab.dataset.tab);
  const act = e.target.closest('[data-a]');
  if (!act || !ACTIONS[act.dataset.a]) return;
  const r = ACTIONS[act.dataset.a](act);
  if (r === false || r instanceof Promise || act.dataset.a === 'why') return;
  save(); render();
});
document.addEventListener('toggle', e => { if (e.target.dataset?.k) ui.open[e.target.dataset.k] = e.target.open; }, true);
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'importFile') {
    const file = t.files?.[0];
    if (!file) return;
    try { importChar(JSON.parse(await file.text())); save(); render(); toast('Personaje importado'); } catch (err) { alert('No se pudo importar: el archivo no es una ficha válida.'); }
    t.value = '';
    return;
  }
  if (t.dataset.aChange === 'switch') { db.current = t.value; ui.edit = ui.editItem = -1; save(); return render(); }
  if (t.dataset.f) { setPath(t.dataset.f, t); save(); render(); }
});

load(); save(); render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Sin modo offline', err)));
