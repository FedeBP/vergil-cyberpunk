// Prueba de reglas con la ficha de ejemplo. Uso: node tools/test.js
const assert = require('assert');
require('../rules.js');
const R = Rules;
const ch = R.normalize(require('./vergil.json').character);
const skill = n => R.compute(ch).skills[ch.skills.findIndex(s => s.name === n)];

let sh = R.compute(ch);
assert.strictEqual(ch.implants.length, 0, 'los implantes del sistema viejo (6 tiers) se quitan');
assert.strictEqual(sh.attrs.per.total, 40);
const exp = {Investigación: [28, 28, 2], Pericia: [32, 32, 3], Conocimiento: [30, 40, 4], Social: [35, 45, 4],
  Atletismo: [32, 50, 5], Sigilo: [30, 38, 3], Pelea: [32, 100, 10], Puntería: [30, 80, 8], Tecnología: [32, 32, 3], Estilo: [40, 90, 9]};
for (const [n, [base, total, crit]] of Object.entries(exp)) assert.deepStrictEqual([skill(n).base, skill(n).total, skill(n).crit], [base, total, crit], n);
assert.ok(!ch.skills.some(x => x.name === 'Informática'), 'Tecnología reemplaza a Informática');
assert.deepStrictEqual([sh.def.evasion.total, sh.def.reflejos.total, sh.def.fortaleza.total, sh.def.voluntad.total], [20, 30, 30, 35]);
const s = k => sh.sec[k].total;
assert.deepStrictEqual([s('pa'), s('vitalidad'), s('potencia'), s('rango'), s('iniciativa'), s('curacion'), s('resolucion'), s('ph')],
  [11, 70, 5, 20, 13, 2, 7, 15]);
assert.deepStrictEqual([sh.points.ini.spent, sh.points.ini.avail, sh.points.attr.avail, sh.points.skill.avail, sh.points.skill.spent], [325, 320, 15, 100, 100]);
assert.deepStrictEqual([sh.load.used, sh.load.max], [0, 108], 'humanidad = CON/2 + DET + NV×2');

// Implantes del Excel v9: 3 tiers, costo de humanidad total al tier, los efectos de cada tier se suman.
require('../catalog.js');
const cat = (name, tier) => ({...JSON.parse(JSON.stringify(CATALOG.implants.find(i => i.name === name))), tier, on: 0, cdLeft: 0});
ch.implants = [cat('Kiroshi Clarividente', 3), cat('Kerenzikov', 3), cat('Newton Module', 3), cat('Chrome Compressor', 1), cat('Netwatch Netdriver', 1)];
ch.strain = 5;
sh = R.compute(ch);
assert.strictEqual(sh.def.evasion.total, 60, 'Clarividente T3: +10 y +30 Evasión se suman');
assert.deepStrictEqual([sh.load.implants, sh.load.strain, sh.load.used], [21, 5, 26], '(12+6+12+6+6) −50% Chrome Compressor + situaciones');
assert.deepStrictEqual([s('ram'), s('ramregen')], [10, 1], 'RAM 5+INT/10');
const ker = ch.implants.findIndex(i => i.name === 'Kerenzikov');
assert.deepStrictEqual([sh.imps[ker].dur, sh.imps[ker].cdEff, sh.cdr], [1, 3, 50], 'Newton T3 −10−15−25 = −50%: CD 6 → 3');
assert.deepStrictEqual([s('pa'), skill('Puntería').crit], [11, 8], 'Kerenzikov inactivo no suma');
assert.ok(R.activate(ch, ker));
sh = R.compute(ch);
assert.deepStrictEqual([s('pa'), skill('Puntería').crit], [15, 11], 'Kerenzikov activo: +4 PA, +3 Crítico Puntería');
R.nextTurn(ch);
assert.deepStrictEqual([ch.implants[ker].on, ch.implants[ker].cdLeft], [0, 3]);
ch.implants.push(cat('Kerenzikov Boost System', 3));
assert.strictEqual(R.compute(ch).def.reflejos.total, 30, 'Boost System no suma sin Kerenzikov activo');
ch.implants[ker].cdLeft = 0; R.activate(ch, ker);
assert.deepStrictEqual([R.compute(ch).def.reflejos.total, R.compute(ch).sec.iniciativa.total], [60, 16], 'con Kerenzikov activo: +30 Reflejos, +3 Iniciativa');
ch.implants.pop(); ch.implants[ker].on = 0;
const n2 = R.normalize(R.blankCharacter());
n2.implants = [cat('Brazos Moore Tech', 2), cat('Mantis Arasaka', 2), cat('Mamba Negra', 3), cat('Armadura Subdermal', 1), cat('Editor De Dolor', 1)];
const s2 = R.compute(n2);
assert.deepStrictEqual([s2.attrs.fue.total, s2.def.fortaleza.total, s2.rd.normal.total, s2.rd.quimica.total, s2.rd.termal.total], [70, 34, 20, 100, 5],
  'los negativos no se aplican solos; RD General suma a todas; Mamba Negra T3 = 15+30+50');
const n3 = R.normalize(R.blankCharacter()); n3.implants = [cat('Editor De Dolor', 3)];
assert.strictEqual(R.compute(n3).sec.implantes.total, R.compute(R.normalize(R.blankCharacter())).sec.implantes.total + 15, '+30 Constitución sube la humanidad en 15');
assert.ok(R.slotFull(n2, 'Brazos') && !R.slotFull(n2, 'Otros'));
const n4 = R.normalize(R.blankCharacter());
n4.implants = [cat('Brazos Arasaka', 2), cat('Brazos Arasaka', 3), cat('Porter', 1)];
assert.strictEqual(R.compute(n4).load.implants, 16 + 2, 'par de brazos iguales: cuenta una vez el costo del tier más alto');
assert.deepStrictEqual([R.compute(n4).attrs.fue.total, R.compute(n4).skills.find((_, i) => n4.skills[i].name === 'Pelea').total], [60, 52], 'y sus efectos una vez: +10 Fuerza, +20 Pelea');
n4.implants = [cat('Brazos Arasaka', 1), cat('Brazos Moore Tech', 1)];
assert.deepStrictEqual([R.compute(n4).attrs.fue.total, R.compute(n4).load.implants], [80, 12], 'brazos distintos: suman efectos y costo');
n4.implants = [cat('S.A. Rostovik Rakater', 1)];
assert.ok(R.cantInstall(n4, cat('S.A. Rostovik Rakater', 1)) && !R.cantInstall(n4, cat('Brazos Arasaka', 1)), 'Rakater en un solo brazo');
assert.deepStrictEqual(R.parseEffect('-10% Enfriamiento | -50% Carga de implantes').cdr, 10);
assert.strictEqual(R.parseEffect('+20 Fuerza, +1 a los PA cuando tus PGs bajen').mods.length, 0);
assert.deepStrictEqual(R.unmetReqs('DES 70, Pelea: Agarres 40, Hab. 50', ch, R.compute(ch)), ['DES 70']);
const old = R.blankCharacter(); old.skills = old.skills.filter(x => x.name !== 'Estilo');
assert.deepStrictEqual(R.normalize(old).skills.at(-1), {name: 'Estilo', a: 'det', b: 'det', mod: 0, spec: false, custom: false}, 'fichas viejas reciben Estilo');
assert.strictEqual(ch.skills.find(x => x.name === 'Estilo').custom, false, 'el Estilo personalizado pasa a ser el estándar');
const burya = CATALOG.items.find(i => i.name === 'RT-46 Burya');
assert.deepStrictEqual([burya.base, burya.dados], ['18/34', '3d8/d8'], 'armas: daño separado por modo');
const ika = CATALOG.items.find(i => i.name === 'Ikazuchi');
assert.deepStrictEqual([ika.base, ika.dados, ika.elem, ika.crit], ['POT', 'D6', [{dados: '2D6', tipo: 'Eléctrico'}], 5], 'cuerpo a cuerpo con daño eléctrico');
assert.ok(!CATALOG.items.some(i => i.name === 'Sistema Operativo'), 'la tabla de Overclock no es un quickhack');
assert.deepStrictEqual(R.normalize({...R.blankCharacter(), items: undefined}).items, [], 'fichas viejas reciben inventario vacío');
console.log('OK');
