// Prueba de reglas con la ficha de ejemplo. Uso: node tools/test.js
const assert = require('assert');
require('../rules.js');
const R = Rules;
const ch = R.normalize(require('../vergil.json').character);
const skill = n => R.compute(ch).skills[ch.skills.findIndex(s => s.name === n)];

let sh = R.compute(ch);
assert.deepStrictEqual([sh.attrs.per.base, sh.attrs.per.total], [40, 50], 'Kiroshi suma +10 PER en +/-');
const exp = {Investigación: [28, 30, 3], Pericia: [32, 32, 3], Conocimiento: [30, 40, 4], Social: [35, 45, 4],
  Atletismo: [32, 50, 5], Sigilo: [30, 40, 4], Pelea: [32, 100, 10], Puntería: [30, 82, 8], Informática: [32, 32, 3], Estilo: [40, 90, 9]};
for (const [n, [base, total, crit]] of Object.entries(exp)) assert.deepStrictEqual([skill(n).base, skill(n).total, skill(n).crit], [base, total, crit], n);
assert.deepStrictEqual([sh.def.evasion.base, sh.def.evasion.total], [10, 26]);
assert.deepStrictEqual([sh.def.reflejos.base, sh.def.reflejos.total], [30, 42]);
assert.strictEqual(sh.def.fortaleza.total, 30);
assert.strictEqual(sh.def.voluntad.total, 35);
const s = k => sh.sec[k].total;
assert.deepStrictEqual([s('pa'), s('vitalidad'), s('potencia'), s('rango'), s('iniciativa'), s('curacion'), s('resolucion'), s('ph')],
  [11, 70, 5, 25, 14, 2, 37, 15]);
assert.deepStrictEqual([sh.points.ini.spent, sh.points.ini.avail, sh.points.attr.avail], [325, 320, 30]);
assert.deepStrictEqual([sh.load.used, sh.load.max, sh.cdr], [93, 100, 50]);
const ker = ch.implants.findIndex(i => i.name === 'Kerenzikov'), def = ch.implants.findIndex(i => i.name === 'Defenzikov');
assert.deepStrictEqual([sh.imps[ker].dur, sh.imps[ker].cdEff], [1, 2], 'Boost T4 sin +1 duración; Newton -50% CD redondeado arriba');
assert.strictEqual(sh.imps[4].cdEff, 4);

assert.ok(R.activate(ch, ker));
sh = R.compute(ch);
assert.deepStrictEqual([s('pa'), sh.def.reflejos.total, sh.def.evasion.total], [15, 67, 36], 'Kerenzikov activo');
R.nextTurn(ch);
assert.deepStrictEqual([ch.implants[ker].on, ch.implants[ker].cdLeft, ch.implants[def].on], [0, 2, 1], 'termina y dispara Defenzikov');
assert.strictEqual(R.compute(ch).rd.normal.total, 20);

const p = R.parseEffect('10 Icewall | +4 PA, D 3T, CD 6T, +10 Reflejos. +10 Puntería con armas SMART');
assert.deepStrictEqual([p.dur, p.cd, p.mods.map(m => m.target)], [3, 6, ['icewall', 'pa', 'reflejos', 'puntería con armas smart'.normalize('NFD').replace(/[̀-ͯ]/g, '')]]);
assert.strictEqual(R.parseEffect('+20 Fuerza, +1 a los PA cuando tus PGs bajen').mods.length, 0);
assert.deepStrictEqual(R.unmetReqs('DES 70, Pelea: Agarres 40, Hab. 50', ch, R.compute(ch)), ['DES 70']);
assert.deepStrictEqual([R.rollStatus(92, 100, 10), R.rollStatus(97, 100, 10), R.rollStatus(5, 50, 5), R.rollStatus(40, 50, 5), R.rollStatus(60, 50, 5)],
  ['fallo', 'pifia', 'critico', 'exito', 'fallo']);
console.log('OK');
