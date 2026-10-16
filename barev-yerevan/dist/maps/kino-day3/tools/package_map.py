"""Build a standalone preview and a handoff archive; no external packages needed."""
from pathlib import Path
import base64, json, re, zipfile
P = Path(__file__).resolve().parents[1]
read = lambda name: (P / name).read_text(encoding='utf-8')
html = read('day-2.html')
css = read('map.css').replace("fonts/Montserrat.ttf", 'data:font/ttf;base64,' + base64.b64encode((P/'fonts/Montserrat.ttf').read_bytes()).decode())
html = html.replace('<link rel="stylesheet" href="vendor/leaflet.css">', '<style>' + read('vendor/leaflet.css') + '</style>')
html = html.replace('<link rel="stylesheet" href="map.css">', '<style>' + css + '</style>')
leaflet = re.sub(r'//# sourceMappingURL=.*', '', read('vendor/leaflet.js'))
html = html.replace('<script src="vendor/leaflet.js"></script>', '<script>' + leaflet + '</script>')
data = [json.loads(read('data/base.json')), json.loads(read('data/day-2.json'))]
# Inline local photos if present, so the preview remains portable.
for stop in data[1]['stops']:
    if stop.get('image') and not stop['image'].startswith(('http:', 'https:', 'data:')):
        photo = (P / stop['image']).resolve()
        if not photo.is_relative_to(P.resolve()):
            raise ValueError('Photo must be inside the map directory')
        mime = {'.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp'}.get(photo.suffix.lower())
        if mime and photo.exists():
            stop['image'] = 'data:' + mime + ';base64,' + base64.b64encode(photo.read_bytes()).decode()
inline = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
html = re.sub(r'<script src="map.js[^\"]*"></script>', lambda m: '<script>window.MAP_DATA=' + inline + ';</script><script>' + read('map.js') + '</script>', html)
(P/'preview.html').write_text(html, encoding='utf-8')
archive=P.parent/'music-day-2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in P.rglob('*'):
        if file.is_file() and 'cache' not in file.parts and '__pycache__' not in file.parts:
            z.write(file, 'music-day-2/' + file.relative_to(P).as_posix())
print('Preview:', P/'preview.html')
print('Archive:', archive, archive.stat().st_size, 'bytes')
