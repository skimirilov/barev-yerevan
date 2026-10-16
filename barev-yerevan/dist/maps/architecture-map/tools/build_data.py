import json, math, heapq
from pathlib import Path
from collections import defaultdict
P=Path(__file__).resolve().parents[1]
els=json.loads((P/'sources/osm.json').read_text())['elements']
def write(name,data): (P/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def dist(a,b):return math.hypot((a[0]-b[0])*85300,(a[1]-b[1])*111320)
features=[]; names=defaultdict(list)
major={'motorway','trunk','primary','secondary','tertiary','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'}
local={'residential','unclassified','living_street','pedestrian'}
for e in els:
 t=e['tags'];cs=[[round(g['lon'],7),round(g['lat'],7)] for g in e['geometry']]
 if len(cs)<2:continue
 kind='';level=''
 if 'highway' in t:
  if t['highway'] in ['proposed','construction','platform','raceway']:continue
  kind='road';level='main' if t['highway'] in major else 'local' if t['highway'] in local else 'minor'
 elif t.get('waterway')=='river':kind='river'
 elif t.get('natural')=='water':kind='water'
 else:kind='green'
 features.append({'type':'Feature','properties':{'kind':kind,'level':level},'geometry':{'type':'LineString','coordinates':cs}})
 name=t.get('name:ru')
 if name and (level in ['main','local'] or kind in ['green','river']):
  length=sum(dist(a,b) for a,b in zip(cs,cs[1:]));names[name].append((length,cs,kind,level))
labels=[]
for name,candidates in names.items():
 length,cs,kind,level=max(candidates)
 if length<110 and kind=='road':continue
 # Use a real segment near the middle, so labels follow the local street direction.
 n=max(0,len(cs)//2-1);a,b=cs[n],cs[min(n+1,len(cs)-1)]
 angle=math.degrees(math.atan2(-(b[1]-a[1]),(b[0]-a[0])*.764))
 if angle>90:angle-=180
 if angle< -90:angle+=180
 short=name.replace('проспект ','просп. ').replace('улица ','ул. ').replace('площадь ','пл. ')
 labels.append({'name':short,'lon':(a[0]+b[0])/2,'lat':(a[1]+b[1])/2,'angle':round(angle,1) if kind=='road' else 0,'kind':kind,'minZoom':13 if kind=='river' else 14 if level=='main' else 15.75 if kind=='green' else 16.5,'priority':length+(10000 if level=='main' else 0)})
labels.sort(key=lambda l:-l['priority'])
write('data/base.json',{'type':'FeatureCollection','features':features,'labels':labels,'source':'OpenStreetMap contributors','date':'2026-10-15'})

# Area/street stops are representative meeting points. Exact entrances require a field check.
raw=[
 ('Конд','Конд',40.18177,44.50233,'Старый район с извилистыми улицами и сложившейся исторической застройкой. Здесь начинается знакомство с разными архитектурными слоями Еревана.'),
 ('Площадь Республики','Площадь Республики',40.17770,44.51272,'Городской ансамбль, через который маршрут раскрывает монументальную симметрию и столичный масштаб Еревана.'),
 ('Улица Абовяна','Улица Абовяна',40.18040,44.51546,'Остановка на улице Абовяна продолжает знакомство с исторической городской средой и изменением архитектурного облика Еревана.'),
 ('Подземный фонтан','Подземный фонтан',40.1786374,44.516015,'Фонтан в открытом подземном дворике станции метро «Площадь Республики». Архитектурное пространство раскрывается ниже уровня улицы.'),
 ('Северный проспект','Северный проспект',40.18333,44.51491,'Пешеходное пространство в центре города. На маршруте здесь можно сравнить масштаб и характер застройки с историческими кварталами.'),
 ('Оперный театр','Оперный театр',40.18572,44.51502,'Один из ключевых городских ансамблей программы. Остановка посвящена монументальной симметрии и роли общественного здания в городе.'),
 ('Скульптурный сад','Скульптурный сад',40.18925,44.51552,'Открытое пространство у Каскада, где скульптура становится частью городской среды. Через художественные образы маршрут обращается к памяти Еревана.'),
 ('Каскад','Каскад',40.19065,44.51562,'Многоуровневый архитектурный ансамбль. Его лестницы, террасы и вертикальная композиция раскрывают связь рельефа, искусства и города.'),
 ('Матенадаран','Матенадаран',40.19195,44.52082,'Монументальное здание хранилища рукописей. В программе оно представляет сохранение знаний и культурной памяти в архитектуре.'),
 ('Монумент «Мать Армения»','Мать Армения',40.19516,44.52467,'Монументальный образ народа и одна из высотных доминант города. Остановка завершает этап, посвящённый памяти Еревана.'),
 ('Спортивно-концертный комплекс имени Карена Демирчяна','Комплекс Демирчяна',40.18872,44.48350,'Выразительный комплекс со смелым пластическим силуэтом. В программе он открывает разговор о новых формах общественной архитектуры.'),
 ('Парк 2800-летия Еревана','Парк 2800-летия',40.1755854,44.5078823,'Городское общественное пространство. На маршруте парк помогает рассмотреть, как планировка и благоустройство формируют среду для отдыха и встреч.'),
 ('Здание Министерства иностранных дел','Министерство иностранных дел',40.1767792,44.5093242,'Лаконичная геометрия административного здания продолжает разговор о масштабе, функции и выразительности городской архитектуры.'),
 ('Поющие фонтаны','Поющие фонтаны',40.1783151,44.5135484,'Финальная остановка на площади Республики. Композиция фонтанов раскрывает идею города как пространства общих впечатлений и событий. Время работы шоу уточняется отдельно.')
]
stops=[]
for i,(name,short,lat,lon,desc) in enumerate(raw):
 stage='Прошлое' if i<6 else 'Настоящее' if i<10 else 'Будущее'
 symbol={'Прошлое':'История Еревана','Настоящее':'Память Еревана','Будущее':'Город и молодое поколение'}[stage]
 stops.append({'id':f'd1-{i+1:02}','name':name,'shortName':short,'lat':lat,'lon':lon,'stage':stage,'description':desc,'symbol':symbol,'image':None,'imageAlt':'','imageCredit':'','coordinateStatus':'representative position; exact entrance needs confirmation'})

def graph_for(mode):
 graph=defaultdict(list)
 for e in els:
  t=e['tags'];h=t.get('highway');g=e['geometry']
  if not h or len(g)<2 or t.get('access') in ['private','no'] or h in ['construction','proposed','platform','raceway']:continue
  if mode=='walk':
   if h in ['motorway','motorway_link','trunk','trunk_link'] or t.get('foot') in ['private','no']:continue
  else:
   if h not in major|{'residential','unclassified','living_street','service'} or t.get('motor_vehicle') in ['no','private'] or t.get('vehicle') in ['no','private']:continue
  coords=[(round(v['lon'],7),round(v['lat'],7)) for v in g]
  for a,b in zip(coords,coords[1:]):
   d=dist(a,b)
   if d==0:continue
   # Sidewalk/footpath preferences only; no claim of accessibility or safety.
   weight=d*(1.15 if mode=='walk' and h in major else 1)
   one=t.get('oneway') if mode=='transfer' else None
   if one!='-1':graph[a].append((b,weight))
   if one not in ['yes','1','true']:graph[b].append((a,weight))
 return graph
graphs={m:graph_for(m) for m in ['walk','transfer']}
def route(start,end,mode):
 graph=graphs[mode];a=min(graph,key=lambda v:dist(v,start));b=min(graph,key=lambda v:dist(v,end))
 heap=[(0,a)];cost={a:0};prev={}
 while heap:
  d,n=heapq.heappop(heap)
  if d!=cost[n]:continue
  if n==b:break
  for v,w in graph[n]:
   alt=d+w
   if alt<cost.get(v,float('inf')):cost[v]=alt;prev[v]=n;heapq.heappush(heap,(alt,v))
 if b not in cost:raise RuntimeError(f'No connected path: {start} {end} {mode}')
 line=[b]
 while line[-1]!=a:line.append(prev[line[-1]])
 line.reverse()
 print(mode,'snap',round(dist(start,a)),round(dist(end,b)),'meters; path',round(sum(dist(x,y) for x,y in zip(line,line[1:]))),flush=True)
 return [start]+line+[end]
legs=[]
for i in range(len(stops)-1):
 a,b=stops[i],stops[i+1];mode='transfer' if i in [9,10] else 'walk'
 cs=route((a['lon'],a['lat']),(b['lon'],b['lat']),mode)
 legs.append({'from':a['id'],'to':b['id'],'mode':mode,'status':'draft_osm_network_not_field_verified','coordinates':cs})
write('data/day-1.json',{'day':1,'name':'Архитектура — камень','stops':stops,'legs':legs,'routeStatus':'Draft: computed on OSM network, exact entrances, access and transfer paths require organizer review.'})
write('data/day-1.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','properties':{k:v for k,v in s.items() if k not in ['lat','lon']},'geometry':{'type':'Point','coordinates':[s['lon'],s['lat']]}} for s in stops]+[{'type':'Feature','properties':{k:v for k,v in l.items() if k!='coordinates'},'geometry':{'type':'LineString','coordinates':l['coordinates']}} for l in legs]})
print('Saved',len(features),'base features;',len(labels),'street/landscape labels;',len(stops),'stops')
