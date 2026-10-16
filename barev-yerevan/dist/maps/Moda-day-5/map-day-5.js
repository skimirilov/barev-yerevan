'use strict';
(async function () {
  const $ = id => document.getElementById(id);
  try {
    const [base, day] = window.MAP_DATA || await Promise.all(['data/base.json', 'data/day-5.json'].map(async url => {
      const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.json();
    }));
    const narrow = () => $('map').clientWidth <= 600;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = L.map('map', {zoomControl:false, minZoom:10, maxZoom:19, zoomSnap:.25, zoomDelta:.75, preferCanvas:true, closePopupOnClick:false, maxBounds:base.coverage, maxBoundsViscosity:1, zoomAnimation:!reduceMotion, fadeAnimation:!reduceMotion});
    map.setView([40.185,44.505],14);
    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>');
    const scale=L.control.scale({position:'bottomright',imperial:false,maxWidth:110}).addTo(map);
    const localizeScale=()=>{const el=scale.getContainer().querySelector('.leaflet-control-scale-line');if(el&&/m/.test(el.textContent))el.textContent=el.textContent.replace('km','км').replace('m','м');};
    new MutationObserver(localizeScale).observe(scale.getContainer(),{subtree:true,childList:true,characterData:true});
    map.on('moveend zoomend',localizeScale);
    const renderer = L.canvas({padding:.5});
    const roadGroups = {main:L.layerGroup().addTo(map), local:L.layerGroup(), minor:L.layerGroup()};
    for (const f of base.features) {
      const p=f.properties, points=f.geometry.coordinates.map(c=>[c[1],c[0]]);
      if(p.kind==='green') L.polygon(points,{renderer,interactive:false,color:'#d5d6bb',weight:.5,fillColor:'#d9dfc6',fillOpacity:.68}).addTo(map);
      if(p.kind==='water') L.polygon(points,{renderer,interactive:false,stroke:false,fillColor:'#2A658E',fillOpacity:.22}).addTo(map);
      if(p.kind==='river') L.polyline(points,{renderer,interactive:false,color:'#83a8b4',weight:9,opacity:.8}).addTo(map);
    }
    // Draw casings first, then road interiors, so intersections remain clean.
    for (const casing of [true,false]) for (const f of base.features) {
      const p=f.properties; if(p.kind!=='road')continue;
      if(casing && p.level==='minor')continue;
      const points=f.geometry.coordinates.map(c=>[c[1],c[0]]);
      const width=p.level==='main'?5:p.level==='local'?2.8:1.2;
      L.polyline(points,{renderer,interactive:false,color:casing?'#d9ceb8':'#fffbed',weight:width+(casing?2:0),opacity:1}).addTo(roadGroups[p.level]);
    }
    const labels=L.layerGroup().addTo(map);
    const walkStyle={color:'#681923',weight:4.5,opacity:.95};
    for(const leg of day.legs){
      const pts=leg.coordinates.map(c=>[c[1],c[0]]);
      L.polyline(pts,{color:'#F8F3E0',weight:8,opacity:.95,interactive:false}).addTo(map);
      L.polyline(pts,{...walkStyle,...(leg.mode==='transfer'?{color:'#2A658E',dashArray:'9 8',weight:4}:{}),interactive:false}).addTo(map);
    }
    const markers=[];
    let ready=false,moving=false;
    map.on('movestart',()=>{moving=true;});map.on('moveend',()=>{moving=false;});
    function showStop(index, move=false){
      const marker=markers[index]; if(!marker)return;
      if(move) map.setView(marker.getLatLng(),Math.max(map.getZoom(),16.25),{animate:false});
      if(!marker.isPopupOpen())marker.openPopup();
    }
    function popupContent(stop,index){
      const box=document.createElement('article'); box.className='place-card';
      const stage=document.createElement('div');stage.className='place-stage';stage.textContent=`${String(index+1).padStart(2,'0')} / ${stop.stage}`;box.append(stage);
      const title=document.createElement('h2');title.className='place-title';title.textContent=stop.name;box.append(title);
      if(stop.image){const img=document.createElement('img');img.className='place-photo';img.src=stop.image;img.alt=stop.imageAlt||stop.name;img.addEventListener('error',()=>{img.remove();box.querySelector('.photo-credit')?.remove();});box.append(img);if(stop.imageCredit){const credit=document.createElement('div');credit.className='photo-credit';credit.textContent=stop.imageCredit;box.append(credit);}}
      const description=document.createElement('p');description.className='place-copy';description.textContent=stop.description;box.append(description);
      const symbol=document.createElement('div');symbol.className='place-symbol';symbol.textContent=stop.symbol;box.append(symbol);
      const nav=document.createElement('div');nav.className='place-navigation';
      for(const [label,delta] of [['← Назад',-1],['Далее →',1]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=index+delta<0||index+delta>=day.stops.length;b.onclick=()=>showStop(index+delta,true);nav.append(b);}box.append(nav);
      return box;
    }
    day.stops.forEach((stop,index)=>{
      const icon=L.divIcon({className:'stop-marker',html:`<span class="pin">${index+1}</span>`,iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-20]});
      const marker=L.marker([stop.lat,stop.lon],{icon,title:`${index+1}. ${stop.name}`,alt:`${index+1}. ${stop.name}`,keyboard:true,riseOnHover:true}).addTo(map);
      marker.bindPopup(()=>popupContent(stop,index),{maxWidth:320,minWidth:240,closeButton:true,autoClose:true,closeOnEscapeKey:true,autoPan:false});
      // A click after hover must keep the already opened card visible.
      marker.off('click');
      // Mouse hover is managed centrally, including after stage filters re-add pins.
      marker.on('click',()=>showStop(index));
      const el=marker.getElement();el.setAttribute('role','button');el.setAttribute('aria-label',`Открыть остановку ${index+1}: ${stop.name}`);
      el.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();showStop(index);}});
      markers.push(marker);
      const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.className='stop-link';
      const num=document.createElement('b');num.textContent=index+1;const name=document.createElement('span');name.textContent=stop.name;b.append(num,name);b.onclick=()=>{toggleList(false);showStop(index,true);};li.append(b);$('stops-list').append(li);
    });
    installMapHoverCards({map,markers,canOpen:()=>ready&&!moving,open:index=>showStop(index)});
    map.on('popupopen',e=>{
      const el=e.popup.getElement(),close=el.querySelector('.leaflet-popup-close-button');close.setAttribute('aria-label','Закрыть карточку места');close.setAttribute('title','Закрыть');
      requestAnimationFrame(()=>{
        if(!e.popup.isOpen())return;
        const r=el.getBoundingClientRect(),m=$('map').getBoundingClientRect();
        const dx=r.left<m.left+16?r.left-m.left-16:r.right>m.right-16?r.right-m.right+16:0;
        const dy=r.top<m.top+90?r.top-m.top-90:r.bottom>m.bottom-95?r.bottom-m.bottom+95:0;
        if(dx||dy)map.panBy([dx,dy],{animate:false});
      });
    });
    function toggleList(open){$('stops-panel').hidden=!open;$('stops-toggle').setAttribute('aria-expanded',String(open));}
    $('stops-toggle').onclick=()=>toggleList($('stops-panel').hidden);$('close-list').onclick=()=>toggleList(false);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){map.closePopup();toggleList(false);}});
    const bounds=L.latLngBounds([...day.legs.flatMap(l=>l.coordinates.map(c=>[c[1],c[0]])),...day.stops.map(s=>[s.lat,s.lon])]);
    const coverage=L.latLngBounds(base.coverage);
    let overviewBounds=bounds, overview=true, framing=false;
    function fitOverview(){
      const size=map.getSize();if(!size.x||!size.y)return;
      framing=true;
      // Keep the viewport inside the downloaded geographic area at any screen size.
      const minimum=Math.ceil(map.getBoundsZoom(coverage,true)*4)/4;
      map.setMinZoom(Math.max(10,minimum));map.setMaxBounds(coverage);
      map.fitBounds(overviewBounds,{paddingTopLeft:[narrow()?35:90,90],paddingBottomRight:[narrow()?60:100,90],maxZoom:16,animate:false});
      framing=false;overview=true;
    }
    function fit(){map.closePopup();fitOverview();}
    map.on('dragstart',()=>{overview=false;});
    map.on('zoomstart',()=>{if(!framing)overview=false;});
    map.on('popupopen',()=>{overview=false;});
    $('fit').onclick=fit;$('zoom-in').onclick=()=>map.zoomIn();$('zoom-out').onclick=()=>map.zoomOut();
    function redrawLabels(){
      const zoom=map.getZoom();
      for(const [group,threshold] of [[roadGroups.local,12.5],[roadGroups.minor,16.25]]){if(zoom>=threshold){if(!map.hasLayer(group))map.addLayer(group);}else if(map.hasLayer(group))map.removeLayer(group);}
      labels.clearLayers();
      const occupied=[],size=map.getSize();
      // Reserve space for numbered stops, then place street names without collisions.
      for(const s of day.stops){const q=map.latLngToContainerPoint([s.lat,s.lon]);occupied.push([q.x-24,q.y-24,q.x+24,q.y+24]);}
      const fits=r=>r[0]>15&&r[1]>85&&r[2]<size.x-60&&r[3]<size.y-85&&!occupied.some(a=>r[0]<a[2]&&r[2]>a[0]&&r[1]<a[3]&&r[3]>a[1]);
      for(const s of base.labels){
        if(zoom<s.minZoom)continue;
        const q=map.latLngToContainerPoint([s.lat,s.lon]),w=Math.min(s.name.length*6.2,200),angle=s.angle||0;
        const rad=angle*Math.PI/180,bw=Math.abs(Math.cos(rad))*w+Math.abs(Math.sin(rad))*15,bh=Math.abs(Math.sin(rad))*w+Math.abs(Math.cos(rad))*15;
        const rect=[q.x-bw/2-5,q.y-bh/2-5,q.x+bw/2+5,q.y+bh/2+5];if(!fits(rect))continue;occupied.push(rect);
        const span=document.createElement('span');span.textContent=s.name;span.style.setProperty('--angle',`${angle}deg`);
        L.marker([s.lat,s.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:`street-label ${s.kind==='river'?'river-label':s.kind==='green'?'park-label':''}`,html:span,iconSize:[0,0]})}).addTo(labels);
      }
      markers.forEach((m,i)=>{if(m.getTooltip())m.unbindTooltip();if(zoom>=16.4)m.bindTooltip(day.stops[i].shortName||day.stops[i].name,{permanent:true,direction:i%2?'left':'right',offset:[19*(i%2?-1:1),0],className:'stop-label',opacity:1});});
      $('zoom-in').disabled=zoom>=map.getMaxZoom();$('zoom-out').disabled=zoom<=map.getMinZoom();
    }
    map.on('moveend zoomend',redrawLabels);fit();redrawLabels();localizeScale();setTimeout(()=>{ready=true;},300);
    let lastSize='';
    new ResizeObserver(()=>{
      const el=$('map'),key=el.clientWidth+'x'+el.clientHeight;
      if(!el.clientWidth||!el.clientHeight||key===lastSize)return;
      lastSize=key;map.invalidateSize({pan:false});
      if(overview)fitOverview();
      else {framing=true;map.setMinZoom(Math.max(10,Math.ceil(map.getBoundsZoom(coverage,true)*4)/4));map.setMaxBounds(coverage);framing=false;}
      redrawLabels();
    }).observe($('map'));

    // Host-page integration. Folder structure and relative asset URLs stay intact.
    const originalStops=day.stops.map(s=>({...s}));
    let hostLang='ru';
    function hostFilter(stage){
      map.closePopup();
      const visible=[];
      markers.forEach((m,i)=>{
        const stageIndex=['Прошлое','Настоящее','Будущее'].findIndex(x=>originalStops[i].stage.startsWith(x));
        const show=stage===-1||stageIndex===stage;
        if(show){if(!map.hasLayer(m))m.addTo(map);visible.push(m.getLatLng());}
        else if(map.hasLayer(m))map.removeLayer(m);
        const listItem=$('stops-list').children[i];if(listItem)listItem.hidden=!show;
      });
      if(visible.length){overviewBounds=stage===-1?bounds:L.latLngBounds(visible);fitOverview();}
    }
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==parent||event.data?.source!=='barev-parent')return;
      const msg=event.data;
      if(msg.type==='filter'&&Number.isInteger(msg.stage)&&msg.stage>=-1&&msg.stage<=2)hostFilter(msg.stage);
      if(msg.type==='focus'&&Number.isInteger(msg.index)&&markers[msg.index]){
        if(!map.hasLayer(markers[msg.index]))markers[msg.index].addTo(map);
        showStop(msg.index,true);
      }
      if(msg.type==='configure'&&Array.isArray(msg.stops)&&msg.stops.length===day.stops.length){
        hostLang=msg.lang==='hy'?'hy':'ru';document.documentElement.lang=hostLang;
        day.stops.forEach((s,i)=>{
          const translated=msg.stops[i];for(const key of ['name','description','stage','symbol'])if(typeof translated[key]==='string')s[key]=translated[key];
          s.shortName=s.name;s.imageAlt=s.name;
          const span=$('stops-list').children[i]?.querySelector('span');if(span)span.textContent=s.name;
          const el=markers[i].getElement();if(el){el.setAttribute('title',s.name);el.setAttribute('aria-label',(hostLang==='hy'?'Բացել կանգառը՝ ':'Открыть остановку: ')+s.name);}
        });
        const heading=document.querySelector('.day-label>span:last-child');if(heading)heading.textContent=msg.title;
        document.title=msg.title;
        $('stops-toggle').querySelector('span').textContent=hostLang==='hy'?'Կանգառներ':'Остановки';
        $('stops-toggle').setAttribute('aria-label',hostLang==='hy'?'Երթուղու կանգառներ':'Остановки маршрута');
        document.querySelector('.panel-heading>span').textContent=hostLang==='hy'?'Երթուղու հերթականությամբ':'По порядку маршрута';
        $('close-list').setAttribute('aria-label',hostLang==='hy'?'Փակել ցանկը':'Закрыть список остановок');
        $('zoom-in').setAttribute('aria-label',hostLang==='hy'?'Մոտեցնել':'Приблизить');
        $('zoom-out').setAttribute('aria-label',hostLang==='hy'?'Հեռացնել':'Отдалить');
        $('fit').setAttribute('aria-label',hostLang==='hy'?'Ամբողջ երթուղին':'Показать весь маршрут');
        document.querySelectorAll('.map-legend>span').forEach((el,i)=>{const line=el.querySelector('i');el.replaceChildren(line,document.createTextNode(hostLang==='hy'?(i?'Տրանսֆեր':'Ոտքով'):(i?'Трансфер':'Пешком')));});
        hostFilter(msg.stage);redrawLabels();
      }
    });
    map.on('popupopen',e=>{
      const index=markers.findIndex(m=>m.getPopup()===e.popup);
      if(index>=0&&parent!==window)parent.postMessage({source:'barev-map',type:'selected',index},location.origin);
      if(hostLang==='hy'){
        const popup=e.popup.getElement();popup.querySelectorAll('.place-navigation button').forEach((b,i)=>b.textContent=i?'Հաջորդը →':'← Նախորդը');
        popup.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label','Փակել');
      }
    });
    if(parent!==window)parent.postMessage({source:'barev-map',type:'ready'},location.origin);

    $('loading').hidden=true;
  }catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;}
})();
