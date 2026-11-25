"""Genera catalog.js a partir del Excel de campaña.

Uso: python tools/build_catalog.py ruta/al/Cyberpunk.xlsx > catalog.js
Hojas leídas: las de implantes (ver SHEETS), Méritos, Armas, Consumibles, Mejoras y Quickhacks.
Los méritos generales (imagen de la tabla) van abajo, a mano.
"""
import json
import re
import sys

import openpyxl

SHEETS = {  # hoja -> ranura en la planilla de implantes
    'Ojos': 'Ojos', 'Corteza Frontal': 'Corteza frontal', 'Sistema operativo': 'Sistema operativo',
    'Sistema Nervioso': 'Sistema nervioso', 'Sistema Circulatorio': 'Sistema circulatorio',
    'Sistema Tegumentario': 'Sistema integumentario', 'Esqueleto': 'Esqueleto', 'Manos': 'Manos', 'Brazos': 'Brazos',
    'Piernas': 'Piernas',
}

# Méritos generales (tabla de la imagen): nivel, nombre, requisito, rangos, descripción.
GENERAL_MERITS = """
1|Ambidiestro|DES 60|1|Reduce a la mitad los penalizadores por usar la mano torpe
1|Regenerador|CON 60|1|+2 Velocidad de curación
1|Entrenado|-|6|+5 Característica
1|Experto|Hab. 50|6|+20 a una habilidad especializada que no sea de combate (Ej: Investigar: Rastrear, Pericia: Medicina, Social: Comerciar)
1|Habilidoso con las armas|DES 60|1|+30 Fuerza para cumplir los requisitos mínimos de armas
1|Instruido|INT 40|1|+3 PHxNv
1|Manos de acero|Atletismo 40|1|No sufre penalizadores por escalar sin equipamiento
1|Parchar|Pericia 40|1|Reduce un 50% mas el sangrado al realizar primeros auxilios
1|Primera sangre|-|1|+3 Iniciativa
1|Uno con la naturaleza|-|1|Mitad de tiempo para cazar, encontrar agua y montar campamento
2|Agarre experto|Pelea: Agarres 40|1|+20 a fuerza o destreza al mantener una presa
2|Decidido|-|1|+10 Voluntad
2|El Alma de la Fiesta|-|1|+20 sociales bajo la influencia del alcohol
2|Escapista|-|1|+20 a destreza o agilidad para intentar soltarse de ataduras o agarres
2|Escurridizo|-|1|+10 Reflejos
2|Imparable|-|1|+10 Fortaleza
2|Incansable|-|1|+30 a fortaleza para resistir el cansancio
2|Sanador|Pericia: Medicina 50|1|Aumenta los puntos de vida curados con Pericia: Medicina en 50%
2|Siempre listo|DES 60|1|-2 PA para desenfundar/desenvainar un arma o tomar un objeto de acceso rápido
2|Sin tiempo para sangrar|-|1|Daño por desangre solo cada 2 turnos
3|Brazo de hierro|FUE 50|1|Duplica la potencia para arrojar
3|Brazo firme|FUE 70|1|Reduce a la mitad el penalizador de armas automáticas
3|Caer y rodar|Atletismo 60|1|Mitad de daño por caídas
3|Duro de matar|DET 50|1|+20 Vitalidad
3|Lider|Social 70|1|+2 PA, +5 evasión y +10 a todas las habilidades a los miembros del grupo en un rango de 10m
3|Observador|Investigación 70|1|Permite saber los pv, resistencias y armamento del enemigo
3|Ojo de halcón|PER 50|1|Duplica el rango de tiro
3|Médico de combate|Pericia: Medicina 60|1|Mitad de PA para curar en combate
4|Descarga de Adrenalina|DET 60|1|+20 Fuerza, +1 a los PA, +5 RD y reduce a la mitad los penalizadores cuando tus PGs bajen del 50%
4|Afilado|-|2|+5 crítico en combate
4|CQC|Puntería 50, Pelea 50|1|Elimina el penalizador por disparar a corto rango
4|Escurridizo II|DES 70|1|+1 evasión por cada metro recorrido
4|Rata de laboratorio|CON 50|1|Reduce los efectos negativos de sustancias consumidas en 50%
4|Soy tu Huckleberry|Puntería 60|1|Permite realizar disparos apuntados a 15m o menos por el coste de un disparo rápido
4|Visión nocturna|PER 60|1|Mitad de penalizador por baja luminosidad
4|Evasivo|-|2|+10 Evasión
5|99.1% puro|INT 60, CON 40|1|Aumenta los efectos positivos de sustancias consumidas en un 50%
5|Acróbata|Atletismo: Acrobacia 60|1|Mitad de PA para realizar maniobras acrobáticas
5|Dureza|CON 60, DET 60|2|+5% RD y +10 Fortaleza
5|Ejecutor|-|2|+1 resultado de crítico
5|Listo para la acción|-|2|+2 acción en el primer turno de combate, +1 en el resto
5|Recarga táctica|DES 40|1|Mitad de PA para acciones de recarga
6|Cuidadoso|-|1|Reduce la probabilidad de pifia en 3%
6|Gatillo rápido|DES 70|1|-1 PA para con armas de distancia
6|Guerrero del asfalto|Pericia: Conducir 60|1|Sin penalizador atacar en un vehículo en movimiento
6|Manos rápidas|DES 70|1|-1 PA para combate cuerpo a cuerpo
6|Experto en combate|Hab. 50|3|+20 a una habilidad especializada de combate (Ej: Pelea: Judo, Puntería: Rifles)
6|Puños de acero|Pelea 60|1|Reduce la RD enemiga a la mitad al atacar con las manos desnudas
7|Fundirse en las sombras|Sigilo 70|1|+5 al crítico para ocultarse en las sombras, +15 en la oscuridad completa. No hay pifia de sigilo
7|Esquivador de balas|Reflejos 40|1|Permite usar reflejos para esquivar ataques a distancia sin penalizador
7|Francotirador|Puntería 70, PER 60|1|Reduce en 20 el penalizador por apuntar
7|Cirujano de combate|Pericia: Medicina 70|1|Permite realizar cirugías complejas en combate
7|Sentido del Peligro|PER 75|1|Siempre que vayas a entrar en una situación peligrosa (lo sepas o no), se te erizará el pelo de la nuca y sentirás que algo malo va a suceder
7|Experto en Demolición|Pericia: Explosivos 70|1|+50% de daños de explosivos y siempre explotarán en el momento correcto
8|Paso silencioso|Sigilo 65, Atletismo 65|1|Puede mantener el sigilo sin penalizador a paso rápido
8|Peligro a dos manos|DES 65|1|Permite realizar dos ataques portando un arma de igual tamaño en cada mano por un 20% menos de PA
8|Tocado por la fortuna|-|1|Los usos de suerte cuestan la mitad
8|Fuerza de voluntad|DET 80|1|Los usos de resolución cuestan la mitad
8|Manos mágicas|Pericia: Medicina 80|1|La curación de Pericia: Medicina siempre es el máximo posible
9|Asesino|Sigilo 80, Pelea 80|1|+20 crítico, +2 letalidad al realizar un ataque cuerpo a cuerpo estando oculto
9|Gun kata|Pelea 70, Puntería 70, DES 70|1|Luego de una tirada exitosa de reflejos permite realizar un disparo apuntado por la mitad de PA
9|Rendirse, jamás|DET 80|1|La resolución no puede bajar de 5
9|Infalible|-|1|La tirada de efecto de pifias se considera siempre 1
9|Trébol de 4 hojas|-|1|La suerte no puede bajar de 5
10|El profesional|-|1|Duplica la probabilidad de crítico de todas las habilidades
10|Carrera de la Parca|-|1|Cada vez que elimines a un oponente recuperas automáticamente 3 Puntos de acción (no se puede exceder del máximo de PA por turno)
10|El destructor|-|1|Cada golpe CaC que realices es crítico con una tirada de (FUE+DES)/2
10|Una bala, una muerte|-|1|Cada ataque a distancia que realices es crítico con una tirada de (DES+PER)/2
10|Soy Leyenda|-|1|Los rumores de tus hazañas (positivas o negativas) son reconocidos mundialmente, muchas veces incluso exagerados
"""


def num(v):
    return v if isinstance(v, (int, float)) else None


def implants(wb):
    """Cada implante: filas con TIER 1-3 (costo de humanidad total a ese tier, efecto, precio) y filas de
    continuación con más efectos. La última columna dice si es ACTIVABLE y su duración/enfriamiento."""
    out = []
    for sheet, slot in SHEETS.items():
        ws = wb[sheet]
        so = sheet == 'Sistema operativo'  # tiene una columna extra de tipo (Cyberdeck, Sandevistan...)
        typ_c, name_c, tier_c, cost_c, eff_c, price_c, extra_c = (1, 2, 3, 4, 5, 6, 7) if so else (None, 1, 2, 3, 4, 5, 6)
        blocks, last = [], 99
        for r in range(2, ws.max_row + 1):
            v = lambda c: ws.cell(r, c).value if c else None
            if so and v(typ_c) == 'OVERCLOCK' and not v(tier_c):
                continue  # fila que explica qué es el Overclock, no pertenece a ningún implante
            t = v(tier_c) if isinstance(v(tier_c), int) else None
            if t and t <= last:
                blocks.append({'name': None, 'tiers': [None] * 3, 'costs': [None] * 3, 'prices': [None] * 3,
                               'desc': [], 'type': None, 'act': None, 'cur': t})
            if not blocks:
                continue
            b = blocks[-1]
            if t:
                b['cur'], last = t, t
                b['costs'][t - 1], b['prices'][t - 1] = num(v(cost_c)), num(v(price_c))
            b['name'] = b['name'] or v(name_c)
            b['type'] = b['type'] or v(typ_c)
            if v(eff_c):
                i = b['cur'] - 1
                b['tiers'][i] = ' | '.join(filter(None, [b['tiers'][i], re.sub(r'\s+', ' ', str(v(eff_c))).strip()]))
            x = str(v(extra_c) or '').strip()
            m = re.search(r'Duraci[oó]n (\d+) turnos?, Enfriamiento (\d+) turnos?', x)
            if m:
                b['act'] = f'D {m.group(1)}T, CD {m.group(2)}T'
            elif x and x != 'ACTIVABLE':
                b['desc'].append('Overclock:' if x == 'OVERCLOCK' else x)
        for b in blocks:
            if not b['name']:
                continue
            k = next(i for i, t in enumerate(b['tiers']) if t)
            if b['act']:  # el parser de la ficha reconoce "D 2T, CD 4T" como activable
                b['tiers'][k] += ' | ' + b['act']
            for i in range(1, 3):  # tier sin costo propio: mantiene el anterior
                b['costs'][i] = b['costs'][i] if b['costs'][i] is not None else b['costs'][i - 1]
            typ = str(b['type'] or '').strip().capitalize()
            out.append({'v': 2, 'name': title(b['name']), 'slot': 'Otros' if typ == 'Otros' else slot, 'minTier': k + 1,
                        'costs': [c or 0 for c in b['costs']], 'prices': b['prices'], 'tiers': b['tiers'],
                        'desc': ' '.join(filter(None, [typ if so and typ != 'Otros' else ''] + b['desc'])).replace('Overclock: ', 'Overclock: ')})
    return out


WEAPON_COLS = ['tipo', 'modo', 'calibre', 'rec', 'rango', 'precision', 'dano', 'efecto', 'pa', 'cap', 'marca']


def split_damage(d):
    """'18+3d6/30+d6' -> ('18/30', '3d6/d6'): daño base y dados por modo de disparo."""
    parts = [re.match(r'\s*(\d+)\s*\+\s*(.+?)\s*$', m) for m in str(d).split('/')]
    if not all(parts):
        return str(d), ''
    return '/'.join(m.group(1) for m in parts), '/'.join(m.group(2) for m in parts)


def title(name):
    """'PING II' -> 'Ping II' (title() dejaría 'Ping Ii')."""
    return re.sub(r'\b[ivx]+\b', lambda m: m.group(0).upper(), str(name).strip().title(), flags=re.I)


def clean(v):
    return '' if v is None or str(v).strip() in ('-', '?') else str(v).strip()


def melee(row):
    """Fila de cuerpo a cuerpo: nombre, tipo, DES, daño ('POT+D6(+2D6 ELE)'), -, efecto, PA, descripción."""
    name, typ, des, dmg, _, eff, pa, desc = (clean(v) for v in row[:8])
    elem = [{'dados': m.upper(), 'tipo': 'Eléctrico'} for m in re.findall(r'\(\+(\w+) ELE\)', dmg)]
    dmg = re.sub(r'\(\+\w+ ELE\)', '', dmg).strip()
    m = re.match(r'(.+)\+(\d*d\d+)$', dmg, re.I)  # 'POT(8)+D6' -> base 'POT(8)', dados 'D6'
    c = re.search(r'\+(\d+)(?:\(\d+\))? cr[ií]tico', eff)
    return {'kind': 'weapon', 'cat': 'Cuerpo a cuerpo', 'name': title(name), 'skill': 'Pelea', 'tipo': typ,
            'base': m.group(1) if m else dmg, 'dados': m.group(2).upper() if m else '', 'elem': elem,
            'crit': int(c.group(1)) if c else 0, 'efecto': eff, 'pa': pa,
            'notes': ' '.join(filter(None, [f'DES {des}.' if des else '', desc]))}


def items(wb):
    out = []
    ws, cat = wb['Armas'], None
    for r in range(1, ws.max_row + 1):
        row = [ws.cell(r, c).value for c in range(1, 13)]
        if row[1] == 'TIPO':  # fila de encabezado de cada categoría; la de cuerpo a cuerpo no tiene nombre
            cat = str(row[0]).strip().capitalize() if row[0] else 'Cuerpo a cuerpo'
        elif row[0] and cat == 'Cuerpo a cuerpo':
            out.append(melee(row))
        elif row[0]:
            w = dict(zip(WEAPON_COLS, (clean(v) for v in row[1:12])))
            w['base'], w['dados'] = split_damage(w.pop('dano'))
            out.append({'kind': 'weapon', 'cat': cat, 'name': str(row[0]).strip(), **w})
    ws = wb['Consumibles']
    for r in range(2, ws.max_row + 1):
        price, name, app, dur, desc, side = (ws.cell(r, c).value for c in range(1, 7))
        if name and name != 'MEDICAMENTOS':
            out.append({'kind': 'item', 'cat': 'Consumibles', 'name': title(name), 'attrs': {k: clean(v) for k, v in
                        [('Precio', price), ('Aplicación', app), ('Duración', dur), ('Efecto', desc), ('Efectos secundarios', side)] if clean(v)}})
    ws, cat = wb['Mejoras'], None
    for r in range(1, ws.max_row + 1):
        a, b, c, d = (ws.cell(r, k).value for k in range(1, 5))
        if b == 'EFECTO':
            cat = 'Mejoras · ' + str(a).strip().capitalize()
        elif b and ws.cell(r + 3, 1).value:  # el nombre está 3 filas debajo del efecto
            out.append({'kind': 'item', 'cat': cat, 'name': str(ws.cell(r + 3, 1).value).strip(),
                        'attrs': {k: clean(v) for k, v in [('Efecto', b), ('Precio', c), ('Marca', d)] if clean(v)}})
    ws, cat = wb['Quickhacks'], None
    for r in range(2, ws.max_row + 1):
        typ, price, name, ram, pa, dur, desc = (ws.cell(r, k).value for k in range(1, 8))
        if r >= 44:  # quickhacks legendarios: el tipo está en la columna B y no tienen precio
            typ, price = price, None
        if typ:
            cat = 'Quickhacks · ' + str(typ).strip().capitalize()
        if name and isinstance(ram, (int, float)):  # abajo hay una tabla de Overclock que no son quickhacks
            out.append({'kind': 'item', 'cat': cat, 'name': title(name), 'attrs': {k: clean(v) for k, v in
                        [('Precio', price), ('RAM', ram), ('PA', pa), ('Duración', dur), ('Efecto', desc)] if clean(v)}})
    return out


def merits(wb):
    rows = [l.split('|') for l in GENERAL_MERITS.strip().splitlines()]
    out = [{'lvl': int(a), 'name': b, 'req': c, 'max': int(d), 'desc': e} for a, b, c, d, e in rows]
    ws = wb['Méritos']
    for r in range(2, ws.max_row + 1):
        lvl, name, req, ranks, desc = (ws.cell(r, c).value for c in range(1, 6))
        if name:
            out.append({'lvl': int(lvl), 'name': str(name).strip(), 'req': str(req or '-').strip(),
                        'max': int(ranks or 1), 'desc': str(desc or '').strip()})
    return sorted(out, key=lambda m: m['lvl'])


if __name__ == '__main__':
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)  # precios calculados con fórmulas
    data = {'implants': implants(wb), 'merits': merits(wb), 'items': items(wb)}
    sys.stdout.reconfigure(encoding='utf-8')
    print('// Generado por tools/build_catalog.py; no editar a mano.')
    print('globalThis.CATALOG=' + json.dumps(data, ensure_ascii=False, indent=0) + ';')
