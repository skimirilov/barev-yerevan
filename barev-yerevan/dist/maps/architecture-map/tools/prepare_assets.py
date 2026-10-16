from pathlib import Path
import urllib.request, urllib.error, xml.etree.ElementTree as ET, json, time
P=Path(__file__).resolve().parents[1]
for d in ['vendor','fonts','data','images','sources','tools/cache']:(P/d).mkdir(parents=True,exist_ok=True)
def download(url,path):
 if path.exists():return path.read_bytes()
 req=urllib.request.Request(url,headers={'User-Agent':'YerevanStudyMap/1.0 educational prototype'})
 raw=urllib.request.urlopen(req,timeout=60).read();path.write_bytes(raw);return raw
for name,url in {
 'vendor/leaflet.js':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
 'vendor/leaflet.css':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
 'vendor/LEAFLET-LICENSE.txt':'https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE',
 'fonts/Montserrat.ttf':'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
 'fonts/OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt'
}.items():
 download(url,P/name);print('asset',name,flush=True)
nodes={};ways={};pois=[]
for i in range(3):
 for j in range(3):
  west=44.475+i*.020;south=40.17+j*.010
  bbox=f'{west:.5f},{south:.5f},{west+.020:.5f},{south+.010:.5f}'
  raw=download('https://api.openstreetmap.org/api/0.6/map?bbox='+bbox,P/f'tools/cache/{i}-{j}.osm')
  root=ET.fromstring(raw)
  for n in root.findall('node'):
   nodes[n.get('id')]={'lat':float(n.get('lat')),'lon':float(n.get('lon'))}
   tags={t.get('k'):t.get('v') for t in n.findall('tag')}
   if tags.get('name') or tags.get('amenity')=='fountain':pois.append({'type':'node','id':n.get('id'),'tags':tags,**nodes[n.get('id')]})
  for w in root.findall('way'):
   tags={t.get('k'):t.get('v') for t in w.findall('tag')}
   ways[w.get('id')]={'type':'way','id':int(w.get('id')),'tags':tags,'nodes':[n.get('ref') for n in w.findall('nd')]}
  print('OSM area',i,j,len(raw),flush=True)
els=[]
for w in ways.values():
 w['geometry']=[nodes[r] for r in w['nodes'] if r in nodes]
 if not w['geometry']:continue
 t=w['tags']
 if t.get('name') or t.get('amenity')=='fountain':
  pois.append({'type':'way','id':w['id'],'tags':t,'lat':sum(g['lat'] for g in w['geometry'])/len(w['geometry']),'lon':sum(g['lon'] for g in w['geometry'])/len(w['geometry'])})
 if 'highway' in t or t.get('leisure') in ['park','garden'] or t.get('landuse') in ['grass','forest','cemetery'] or t.get('natural') in ['water','wood'] or t.get('waterway')=='river':els.append(w)
(P/'sources/osm.json').write_text(json.dumps({'elements':els}),encoding='utf-8')
(P/'sources/pois.json').write_text(json.dumps(pois,ensure_ascii=False),encoding='utf-8')
print('Done',len(els),'features',flush=True)
