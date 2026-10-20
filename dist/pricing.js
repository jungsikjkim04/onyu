(() => {
  'use strict';
  const section = document.getElementById('cost');
  if (!section) return;
  const tablist = section.querySelector('[data-pricing-tabs]');
  const tabs = Array.from(section.querySelectorAll('[data-pricing-tab]'));
  const panels = tabs.map(tab => document.getElementById(tab.dataset.pricingTab));
  if (!tablist || !tabs.length || panels.some(panel => !panel)) return;

  // Without enhancement, both price lists remain fully readable.
  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[index].id);
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', tab.id);
    panels[index].tabIndex = 0;
  });
  const select = (index, moveFocus = false) => {
    tabs.forEach((tab, current) => {
      const selected = current === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[current].hidden = !selected;
    });
    if (moveFocus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
  });
  const revealHashPanel = () => {
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return; }
    if (!target) return;
    const index = panels.findIndex(panel => panel === target || panel.contains(target));
    if (index !== -1) select(index);
  };
  select(0);
  revealHashPanel();
  section.classList.add('pricing--enhanced');
  tablist.hidden = false;
  window.addEventListener('hashchange', revealHashPanel);
})();
