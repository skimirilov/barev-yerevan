/* Mouse cards close on leave; touch and keyboard cards retain explicit dismissal. */
window.installMapHoverCards = function ({map, markers, canOpen, open}) {
  const container = map.getContainer();
  let active = null, managed = false, inside = false, input = 'keyboard', timer;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  const owns = target => {
    if (!(target instanceof Element) || !active) return false;
    const marker = markers.find(m => m.getPopup() === active);
    return !!(active.getElement()?.contains(target) || marker?.getElement()?.contains(target));
  };
  const schedule = () => {
    cancel();
    if (!managed || !active) return;
    const popup = active;
    // Allow the pointer to cross the small gap between the pin and the card.
    timer = setTimeout(() => {
      if (active === popup && managed && !inside) map.closePopup(popup);
    }, 280);
  };
  const pointerDown = event => {
    input = event.pointerType;
    if (input !== 'mouse') { managed = false; cancel(); }
  };
  const keyDown = () => { input = 'keyboard'; managed = false; cancel(); };
  const over = event => {
    if (event.pointerType !== 'mouse') return;
    input = 'mouse';
    const pin = event.target.closest?.('.stop-marker');
    const index = pin ? markers.findIndex(m => m.getElement() === pin) : -1;
    if (index >= 0 && !pin.contains(event.relatedTarget) && canOpen()) open(index);
    if (owns(event.target)) { managed = true; inside = true; cancel(); }
  };
  const out = event => {
    if (event.pointerType !== 'mouse' || !owns(event.target)) return;
    inside = owns(event.relatedTarget);
    if (inside) cancel(); else schedule();
  };
  const leave = event => {
    if (event.pointerType === 'mouse') { inside = false; schedule(); }
  };
  const opened = event => {
    cancel(); active = event.popup; managed = input === 'mouse'; inside = false;
  };
  const closed = event => {
    if (event.popup === active) { cancel(); active = null; managed = false; inside = false; }
  };
  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('keydown', keyDown, true);
  container.addEventListener('pointerover', over);
  container.addEventListener('pointerout', out);
  container.addEventListener('pointerleave', leave);
  map.on('popupopen', opened);
  map.on('popupclose', closed);
  map.once('unload', () => {
    cancel();
    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('keydown', keyDown, true);
    container.removeEventListener('pointerover', over);
    container.removeEventListener('pointerout', out);
    container.removeEventListener('pointerleave', leave);
    map.off('popupopen', opened); map.off('popupclose', closed);
  });
};
