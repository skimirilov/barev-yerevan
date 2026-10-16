'use strict';
/* One animation controller, rebuilt safely when the interface language changes. */
window.SiteMotion=(()=>{
 let controller,observers=[],animations=new Set(),frame=0,pointerFrame=0,preview,loaderStarted=false;
 const disclosures=new WeakMap(),keys=new WeakMap();
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ease='cubic-bezier(.2,.7,.2,1)';
 function track(animation){animations.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));return animation;}
 function expand(details,open=!details.open){
  if(!details)return;
  const previous=disclosures.get(details),start=details.getBoundingClientRect().height;
  previous?.animation?.cancel();
  const state={open,animation:null};disclosures.set(details,state);
  if(reduce()||!details.animate){details.open=open;details.style.removeProperty('height');details.style.removeProperty('overflow');return;}
  details.open=true;details.style.height='auto';
  const summary=details.querySelector(':scope > summary');
  const target=open?details.getBoundingClientRect().height:summary.getBoundingClientRect().height+parseFloat(getComputedStyle(details).borderTopWidth||0)+parseFloat(getComputedStyle(details).borderBottomWidth||0);
  details.style.overflow='hidden';details.classList.toggle('disclosure-opening',open);details.classList.toggle('disclosure-closing',!open);
  const animation=track(details.animate([{height:start+'px'},{height:target+'px'}],{duration:open?620:420,easing:ease}));state.animation=animation;
  animation.onfinish=()=>{if(disclosures.get(details)!==state)return;details.open=open;details.style.removeProperty('height');details.style.removeProperty('overflow');details.classList.remove('disclosure-opening','disclosure-closing');};
 }
 function setKey(button,open){
  const entry=button.closest('.key-entry'),panel=document.getElementById(button.getAttribute('aria-controls'));
  if(!panel)return;
  const old=keys.get(panel),start=panel.hidden?0:panel.getBoundingClientRect().height;old?.cancel();
  button.setAttribute('aria-expanded',String(open));button.querySelector('.key-plus').textContent=open?'−':'+';entry.classList.toggle('is-open',open);panel.hidden=false;
  const end=open?panel.scrollHeight:0;
  if(reduce()||!panel.animate){panel.hidden=!open;return;}
  const animation=track(panel.animate([{height:start+'px',opacity:open?.4:1},{height:end+'px',opacity:open?1:0}],{duration:open?560:360,easing:ease}));keys.set(panel,animation);
  animation.onfinish=()=>{if(keys.get(panel)===animation){panel.hidden=!open;panel.style.removeProperty('height');}};
 }
 function destroy(){controller?.abort();observers.forEach(o=>o.disconnect());observers=[];animations.forEach(a=>a.cancel());animations.clear();cancelAnimationFrame(frame);cancelAnimationFrame(pointerFrame);frame=pointerFrame=0;preview?.remove();preview=null;}
 function startLoader(){
  if(loaderStarted)return;loaderStarted=true;
  if(reduce()){document.documentElement.classList.add('hero-ready');return;}
  const loader=document.createElement('div');loader.className='site-loader';loader.setAttribute('role','status');loader.setAttribute('aria-label',document.documentElement.lang==='hy'?'Երթուղին բեռնվում է':'Загружаем маршрут');
  loader.innerHTML='<div class="loader-content"><b lang="hy">Բարև</b><span class="loader-coordinates" aria-hidden="true"><span data-lat>0.0000</span>° N, <span data-lon>0.0000</span>° E</span><i aria-hidden="true"></i><span class="loader-caption" aria-hidden="true">ԲԱՐԵՎ · ЕРЕВАН</span></div>';
  document.body.append(loader);const app=document.getElementById('app');app.inert=true;
  const lat=loader.querySelector('[data-lat]'),lon=loader.querySelector('[data-lon]'),start=performance.now();
  let done=false;
  const finish=()=>{if(done)return;done=true;app.inert=false;document.documentElement.classList.add('hero-ready');loader.classList.add('loader-finished');setTimeout(()=>loader.remove(),1150);};
  const tick=now=>{if(done)return;const progress=Math.min(1,(now-start)/1400);lat.textContent=(40.1819*progress).toFixed(4);lon.textContent=(44.5131*progress).toFixed(4);if(progress<1)requestAnimationFrame(tick);else finish();};
  requestAnimationFrame(tick);setTimeout(finish,3500);
 }
 function mount(){
  controller=new AbortController();const signal=controller.signal,root=document.getElementById('app'),reduced=reduce(),hero=document.getElementById('home');
  document.documentElement.classList.add('motion-enabled');
  // Keep complete words and existing line breaks while revealing the hero typography.
  hero.querySelectorAll('h1>span').forEach((span,i)=>{span.classList.add('hero-line');const inner=document.createElement('span');inner.className='hero-word';inner.textContent=span.textContent;span.replaceChildren(inner);span.style.setProperty('--line-delay',i*160+'ms');});
  const statement=document.querySelector('.legend-statement');
  if(statement){const words=statement.textContent.trim().split(/\s+/);statement.replaceChildren();words.forEach((word,i)=>{const span=document.createElement('span');span.className='statement-word';span.textContent=word;statement.append(span);if(i<words.length-1)statement.append(' ');});}
  root.querySelectorAll('.key-illustration').forEach(svg=>{let i=0;svg.querySelectorAll('path,circle,rect,line,polygon').forEach(shape=>{if(shape.classList.contains('a'))return;shape.classList.add('art-line');shape.setAttribute('pathLength','1');shape.style.setProperty('--stroke-delay',i++*110+'ms');});});
  root.querySelectorAll('details.day-chapter, details.place, details.more-story, details.competencies').forEach(details=>{details.querySelector(':scope > summary')?.addEventListener('click',e=>{if(e.target.closest('a,button'))return;e.preventDefault();const state=disclosures.get(details);const opening=state?.animation?.playState==='running'?!state.open:!details.open;expand(details,opening);},{signal});});
  root.querySelectorAll('.key-card').forEach(button=>button.addEventListener('click',()=>setKey(button,button.getAttribute('aria-expanded')!=='true'),{signal}));
  root.querySelectorAll('.chapter-heading').forEach(summary=>summary.addEventListener('keydown',e=>{if(e.key==='Escape')expand(summary.parentElement,false);},{signal}));
  const revealTargets=root.querySelectorAll('.section-index,.legend h2,.section-head h2,.section-head>p,.extended-copy,.legend-explanation>p,.about-top>div>h2,.about-top>div>p,.feature,.stat,.edu-item,.final-keys h3,.partner,.day-chapter,.map-heading,.key-art,.key-entry');
  if(!reduced){const io=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add('is-visible');io.unobserve(entry.target);});},{threshold:.08,rootMargin:'0px 0px -24px 0px'});observers.push(io);revealTargets.forEach((el,i)=>{el.classList.add('scroll-reveal');el.style.setProperty('--reveal-delay',(el.matches('.key-art,.partner,.stat')?i%3*90:0)+'ms');io.observe(el);});}
  else revealTargets.forEach(el=>el.classList.add('is-visible'));
  root.addEventListener('focusin',e=>{let node=e.target;while(node&&node!==root){if(node.classList?.contains('scroll-reveal'))node.classList.add('is-visible');node=node.parentElement;}},{signal});
  const progress=root.querySelector('.reading-progress'),wordSpans=statement?[...statement.querySelectorAll('.statement-word')]:[],parallax=hero.querySelectorAll('[data-p]'),fine=innerWidth>767&&matchMedia('(hover: hover) and (pointer: fine)').matches;
  let heroVisible=true;
  const heroObserver=new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;hero.classList.toggle('ambient-paused',!heroVisible);},{rootMargin:'50px'});heroObserver.observe(hero);observers.push(heroObserver);
  const updateScroll=()=>{
   frame=0;const max=document.documentElement.scrollHeight-innerHeight;if(progress)progress.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;
   if(statement){const rect=statement.getBoundingClientRect(),value=reduced?1:Math.min(1,Math.max(0,(innerHeight*.85-rect.top)/(rect.height+innerHeight*.35)));wordSpans.forEach((span,i)=>span.classList.toggle('word-lit',i/wordSpans.length<=value));}
   if(!reduced&&fine&&heroVisible){const y=Math.min(scrollY,innerHeight*1.4);parallax.forEach(group=>group.style.transform=`translateY(${y*Number(group.dataset.p)}px)`);}
  };
  const queueScroll=()=>{if(!frame)frame=requestAnimationFrame(updateScroll);};window.addEventListener('scroll',queueScroll,{passive:true,signal});window.addEventListener('resize',queueScroll,{passive:true,signal});updateScroll();
  if(!reduced){
   const particles=document.createElement('div');particles.className='ambient-particles';particles.setAttribute('aria-hidden','true');
   for(let i=0;i<(fine?16:6);i++){const particle=document.createElement('i');particle.style.cssText=`--particle-x:${(i*37.3)%100}%;--particle-time:${10+(i%7)*1.7}s;--particle-delay:${-i*1.3}s;--particle-size:${4+i%4}px`;particles.append(particle);}hero.querySelector('.ambient-particles')?.remove();hero.append(particles);
   const onVisibility=()=>hero.classList.toggle('document-paused',document.hidden);document.addEventListener('visibilitychange',onVisibility,{signal});
   if(fine){
    root.querySelectorAll('.key-art').forEach(card=>{
     card.addEventListener('pointermove',e=>{const rect=card.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;card.style.setProperty('--spot-x',x*100+'%');card.style.setProperty('--spot-y',y*100+'%');card.style.setProperty('--tilt-x',((y-.5)*-8)+'deg');card.style.setProperty('--tilt-y',((x-.5)*8)+'deg');},{passive:true,signal});
     card.addEventListener('pointerleave',()=>{card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');},{signal});
    });
    hero.addEventListener('pointermove',e=>{const rect=hero.getBoundingClientRect();hero.style.setProperty('--pointer-x',(e.clientX-rect.left)/rect.width-.5);hero.style.setProperty('--pointer-y',(e.clientY-rect.top)/rect.height-.5);},{passive:true,signal});
    preview=document.createElement('div');preview.className='direction-preview';preview.setAttribute('aria-hidden','true');document.body.append(preview);
    root.querySelectorAll('.key-card,.chapter-heading').forEach(trigger=>{
     trigger.addEventListener('pointerenter',()=>{const source=trigger.closest('.key-entry')?.querySelector('.key-illustration')||trigger.closest('.day-chapter')?.querySelector('.key-illustration');if(!source)return;preview.replaceChildren(source.cloneNode(true));preview.classList.add('preview-visible');},{signal});
     trigger.addEventListener('pointerleave',()=>preview.classList.remove('preview-visible'),{signal});
     trigger.addEventListener('pointermove',e=>{const x=e.clientX,y=e.clientY;if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;preview.style.transform=`translate(${Math.min(x+28,innerWidth-250)}px,${Math.max(12,Math.min(y-100,innerHeight-200))}px)`;});},{passive:true,signal});
    });
   }
  }
  startLoader();
 }
 return {mount,destroy,expand};
})();
