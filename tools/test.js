// Prueba de reglas con la ficha de ejemplo. Uso: node tools/test.js
const assert = require('assert');
require('../rules.js');
const R = Rules;
const ch = R.normalize(require('./vergil.json').character);
const skill = n => R.compute(ch).skills[ch.skills.findIndex(s => s.name === n)];

let sh = R.compute(ch);
assert.deepStrictEqual([sh.attrs.per.base, sh.attrs.per.total], [40, 50], 'Kiroshi suma +10 PER en +/-');
const exp = {Investigación: [28, 30, 3], Pericia: [32, 32, 3], Conocimiento: [30, 40, 4], Social: [35, 45, 4],
  Atletismo: [32, 50, 5], Sigilo: [30, 40, 4], Pelea: [32, 100, 10], Puntería: [30, 82, 8], Informática: [32, 32, 3], Estilo: [40, 90, 9]};
for (const [n, [base, total, crit]] of Object.entries(exp)) assert.deepStrictEqual([skill(n).base, skill(n).total, skill(n).crit], [base, total, crit], n);
assert.deepStrictEqual([sh.def.evasion.base, sh.def.evasion.total], [10, 31]);
assert.deepStrictEqual([sh.def.reflejos.base, sh.def.reflejos.total], [30, 42]);
assert.strictEqual(sh.def.fortaleza.total, 30);
assert.strictEqual(sh.def.voluntad.total, 35);
const s = k => sh.sec[k].total;
assert.deepStrictEqual([s('pa'), s('vitalidad'), s('potencia'), s('rango'), s('iniciativa'), s('curacion'), s('resolucion'), s('ph')],
  [11, 70, 5, 25, 14, 2, 37, 15]);
assert.deepStrictEqual([sh.points.ini.spent, sh.points.ini.avail, sh.points.attr.avail, sh.points.skill.avail, sh.points.skill.spent], [325, 320, 15, 100, 100]);
assert.deepStrictEqual([sh.load.used, sh.load.max, sh.cdr], [93, 100, 50]);
const ker = ch.implants.findIndex(i => i.name === 'Kerenzikov'), def = ch.implants.findIndex(i => i.name === 'Defenzikov');
assert.deepStrictEqual([sh.imps[ker].dur, sh.imps[ker].cdEff], [1, 2], 'Boost T4 sin +1 duración; Newton -50% CD redondeado arriba');
assert.strictEqual(sh.imps[4].cdEff, 4);

assert.ok(R.activate(ch, ker));
sh = R.compute(ch);
assert.deepStrictEqual([s('pa'), sh.def.reflejos.total, sh.def.evasion.total], [15, 67, 41], 'Kerenzikov activo');
R.nextTurn(ch);
assert.deepStrictEqual([ch.implants[ker].on, ch.implants[ker].cdLeft, ch.implants[def].on], [0, 2, 1], 'termina y dispara Defenzikov');
assert.deepStrictEqual([R.compute(ch).rd.normal.total, R.compute(ch).rd.termal.total], [20, 0], 'RD sin tipo es RD normal');

const p = R.parseEffect('10 Icewall | +4 PA, D 3T, CD 6T, +10 Reflejos. +10 Puntería con armas SMART');
assert.deepStrictEqual([p.dur, p.cd, p.mods.map(m => m.target)], [3, 6, ['icewall', 'pa', 'reflejos', 'puntería con armas smart'.normalize('NFD').replace(/[̀-ͯ]/g, '')]]);
assert.strictEqual(R.parseEffect('+20 Fuerza, +1 a los PA cuando tus PGs bajen').mods.length, 0);
assert.deepStrictEqual(R.unmetReqs('DES 70, Pelea: Agarres 40, Hab. 50', ch, R.compute(ch)), ['DES 70']);
assert.deepStrictEqual([R.rollStatus(9, 0, 0), R.rollStatus(10, 0, 0)], ['exito', 'fallo'], '1–9 éxito automático');
assert.deepStrictEqual([R.rollStatus(92, 100, 10), R.rollStatus(97, 100, 10), R.rollStatus(5, 50, 5), R.rollStatus(40, 50, 5), R.rollStatus(60, 50, 5)],
  ['fallo', 'pifia', 'critico', 'exito', 'fallo']);

// Catálogo completo del Excel: Defenzikov con su texto original, implantes-arma y límites por ranura.
require('../catalog.js');
const cat = name => ({...JSON.parse(JSON.stringify(CATALOG.implants.find(i => i.name === name))), on: 0, cdLeft: 0});
const d = R.parseEffect(cat('Defenzikov').tiers[0]);
assert.deepStrictEqual([d.trigger, d.dur, d.cd, d.mods.map(m => m.target)], ['kerenzikov', 1, 3, ['rd']]);
const n2 = R.normalize(R.blankCharacter());
n2.implants = [{...cat('Brazos Gorila - Arasaka'), tier: 1}, {...cat('Hojas Mantis Arasaka'), tier: 2}, {...cat('Adaptador Celular'), tier: 1}];
const s2 = R.compute(n2);
assert.deepStrictEqual([s2.sec.pa.total, s2.attrs.fue.total, s2.sec.potencia.total, s2.rd.normal.total, s2.sec.vitalidad.total], [10, 60, 8, 0, 75],
  '"5 PA" es coste de ataque, "-15 RD" es perforación, "+10 Vitalidad máxima" suma');
assert.ok(R.slotFull(n2, 'Brazos') && !R.slotFull(n2, 'Sistema integumentario') && !R.slotFull(n2, 'Chips'));
assert.strictEqual(R.normalize({...n2, implants: [{name: 'x', slot: 'Mano derecha', tiers: []}]}).implants[0].slot, 'Manos');
console.log('OK');
