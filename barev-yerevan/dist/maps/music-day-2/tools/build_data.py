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


raw=[
 ('Музей-институт Комитаса','Музей Комитаса',40.16240,44.50242,'Прошлое','Комитас — музыковед и композитор','Знакомство с армянским музыкальным наследием, народными мелодиями и творчеством Комитаса, сыгравшего ключевую роль в сохранении музыкальной традиции Армении.'),
 ('Ереванская государственная консерватория имени Комитаса','Консерватория Комитаса',40.1871311,44.5169182,'Настоящее','Поколение музыкантов Армении','Пространство музыкального образования, где академические традиции передаются следующим поколениям и рождаются новые творческие направления. По программе участники попробуют себя в роли студентов консерватории.'),
 ('Malkhas Jazz Club','Malkhas Jazz Club',40.1843556,44.51059,'Будущее','Левон Малхасян (Malkhas)','Знакомство с ереванской джазовой сценой и её историей. Здесь маршрут обращается к роли джаза в современной музыкальной культуре города.')
]
stops=[{'id':f'd2-{i+1:02}','name':n,'shortName':short,'lat':lat,'lon':lon,'stage':stage,'symbol':symbol,'description':desc,'image':None,'imageAlt':'','imageCredit':'','coordinateStatus':'venue location; exact meeting point and entrance require organizer confirmation'} for i,(n,short,lat,lon,stage,symbol,desc) in enumerate(raw)]
routing_elements=els
def graph_for(mode):
 graph=defaultdict(list)
 for e in routing_elements:
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
# Isolated service drives cannot serve as transit-network start/end nodes.
def main_component(graph):
 links=defaultdict(set)
 for a,neighbors in graph.items():
  for b,_ in neighbors:links[a].add(b);links[b].add(a)
 unseen=set(links);largest=set()
 while unseen:
  seed=unseen.pop();component={seed};todo=[seed]
  while todo:
   a=todo.pop()
   for b in links[a]:
    if b in unseen:unseen.remove(b);component.add(b);todo.append(b)
  if len(component)>len(largest):largest=component
 return {a:neighbors for a,neighbors in graph.items() if a in largest}
graphs={mode:main_component(graph) for mode,graph in graphs.items()}
def route(start,end,mode):
 graph=graphs[mode]
 candidates=set(graph)
 if mode=='transfer':
  public_roads={(round(v['lon'],7),round(v['lat'],7)) for e in routing_elements if e['tags'].get('highway') in major|{'residential','unclassified','living_street'} for v in e['geometry']}
  candidates &= public_roads
 a=min(candidates,key=lambda v:dist(v,start));b=min(candidates,key=lambda v:dist(v,end))
 heap=[(0,a)];cost={a:0};prev={}
 while heap:
  d,n=heapq.heappop(heap)
  if d!=cost[n]:continue
  if n==b:break
  for v,w in graph.get(n,[]):
   alt=d+w
   if alt<cost.get(v,float('inf')):cost[v]=alt;prev[v]=n;heapq.heappush(heap,(alt,v))
 if b not in cost:raise RuntimeError(f'No connected path: {start} {end} {mode}')
 line=[b]
 while line[-1]!=a:line.append(prev[line[-1]])
 line.reverse()
 print(mode,'snap',round(dist(start,a)),round(dist(end,b)),'meters; path',round(sum(dist(x,y) for x,y in zip(line,line[1:]))),flush=True)
 return [start]+line+[end]

legs=[]
for i,(a,b) in enumerate(zip(stops,stops[1:])):
 mode='transfer' if i==0 else 'walk'
 cs=route((a['lon'],a['lat']),(b['lon'],b['lat']),mode)
 segments=[(mode,'main',cs)]
 if mode=='transfer':
  segments=[('walk','to_pickup',route(cs[0],cs[1],'walk')),('transfer','main',cs[1:-1]),('walk','from_dropoff',route(cs[-2],cs[-1],'walk'))]
 for segment_mode,role,points in segments:
  legs.append({'from':a['id'],'to':b['id'],'mode':segment_mode,'role':role,'status':'computed_osm_network_not_field_verified','coordinates':points})
day={'day':2,'name':'Музыка — звук','stops':stops,'legs':legs,'routeStatus':'Computed on OSM. Transfer from museum to conservatory and walking onward are proposed map logistics, not confirmed organizer transport plans.'}
(P/'data/day-2.json').write_text(json.dumps(day,ensure_ascii=False,indent=2),encoding='utf-8')
write('data/day-2.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','properties':{k:v for k,v in s.items() if k not in ['lat','lon']},'geometry':{'type':'Point','coordinates':[s['lon'],s['lat']]}} for s in stops]+[{'type':'Feature','properties':{k:v for k,v in l.items() if k!='coordinates'},'geometry':{'type':'LineString','coordinates':l['coordinates']}} for l in legs]})
print('Saved day 2:',len(stops),'stops,',len(legs),'legs;',len(features),'base features')
