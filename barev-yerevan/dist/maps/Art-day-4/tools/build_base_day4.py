"""Собирает расширенную подложку для карты дня 4: data/base-day-4.json.
Берёт sources/osm.json (как у дня 2) и, если есть, sources/osm-south.json
(выгрузка юго-востока с Эребуни). Остальные карты не затрагивает."""
import json, math
from pathlib import Path
from collections import defaultdict
P = Path(__file__).resolve().parents[1]
els = {}
for name in ['sources/osm.json', 'sources/osm-south.json']:
    f = P / name
    if f.exists():
        for e in json.loads(f.read_text(encoding='utf-8'))['elements']:
            if e.get('type') == 'way' and e.get('geometry'):
                els[e['id']] = e
        print('Прочитано:', name)
    else:
        print('Нет файла (пропуск):', name)
els = list(els.values())
def dist(a, b): return math.hypot((a[0]-b[0])*85300, (a[1]-b[1])*111320)
features = []; names = defaultdict(list)
major = {'motorway','trunk','primary','secondary','tertiary','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'}
local = {'residential','unclassified','living_street','pedestrian'}
for e in els:
    t = e.get('tags', {}); cs = [[round(g['lon'],7), round(g['lat'],7)] for g in e['geometry']]
    if len(cs) < 2: continue
    kind = ''; level = ''
    if 'highway' in t:
        if t['highway'] in ['proposed','construction','platform','raceway']: continue
        kind = 'road'; level = 'main' if t['highway'] in major else 'local' if t['highway'] in local else 'minor'
    elif t.get('waterway') == 'river': kind = 'river'
    elif t.get('natural') == 'water': kind = 'water'
    else: kind = 'green'
    features.append({'type':'Feature','properties':{'kind':kind,'level':level},'geometry':{'type':'LineString','coordinates':cs}})
    name = t.get('name:ru')
    if name and (level in ['main','local'] or kind in ['green','river']):
        length = sum(dist(a,b) for a,b in zip(cs,cs[1:])); names[name].append((length,cs,kind,level))
labels = []
for name, candidates in names.items():
    length, cs, kind, level = max(candidates)
    if length < 110 and kind == 'road': continue
    n = max(0, len(cs)//2-1); a, b = cs[n], cs[min(n+1,len(cs)-1)]
    angle = math.degrees(math.atan2(-(b[1]-a[1]), (b[0]-a[0])*.764))
    if angle > 90: angle -= 180
    if angle < -90: angle += 180
    short = name.replace('проспект ','просп. ').replace('улица ','ул. ').replace('площадь ','пл. ')
    labels.append({'name':short,'lon':(a[0]+b[0])/2,'lat':(a[1]+b[1])/2,'angle':round(angle,1) if kind=='road' else 0,'kind':kind,'minZoom':13 if kind=='river' else 14 if level=='main' else 15.75 if kind=='green' else 16.5,'priority':length+(10000 if level=='main' else 0)})
labels.sort(key=lambda l: -l['priority'])
(P/'data').mkdir(exist_ok=True)
(P/'data/base-day-4.json').write_text(json.dumps({'type':'FeatureCollection','features':features,'labels':labels,'source':'OpenStreetMap contributors','date':'2026-10-15'}, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
print('Готово: data/base-day-4.json,', len(features), 'объектов,', len(labels), 'подписей')
