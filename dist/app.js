'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const config = window.ONYU_CONFIG || {};
  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  // Navigation remains usable through ordinary anchor links.
  const menuToggle = $('#menuToggle');
  const mobileNav = $('#mobileNav');
  function closeMenu() {
    mobileNav.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '메뉴 열기');
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    mobileNav.hidden = isOpen;
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? '메뉴 열기' : '메뉴 닫기');
  });
  $$('#mobileNav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileNav.hidden) {
      closeMenu();
      menuToggle.focus();
    }
  });
  const desktopMedia = window.matchMedia('(min-width: 681px)');
  desktopMedia.addEventListener('change', event => { if (event.matches) closeMenu(); });
  const header = $('.site-header');
  function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 16); }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // Native dialogs provide focus trapping and Escape support.
  let activeDialog = null;
  let opener = null;
  function openDialog(id, trigger) {
    const target = $(id);
    if (target.open) return;
    if (!trigger?.closest('dialog')) opener = trigger || document.activeElement;
    const previous = activeDialog;
    activeDialog = target;
    if (previous?.open) previous.close();
    closeMenu();
    target.showModal();
    document.body.classList.add('modal-open');
    target.querySelector('[data-close]')?.focus();
  }
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (activeDialog !== dialog) return;
      activeDialog = null;
      document.body.classList.remove('modal-open');
      if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
  });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('[data-close-link]').forEach(link => link.addEventListener('click', () => {
    opener = null;
    link.closest('dialog').close();
    const section = $(link.getAttribute('href'));
    if (section) {
      section.setAttribute('tabindex', '-1');
      section.focus({ preventScroll: true });
    }
  }));
  $$('[data-contact]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    setConsultationPackage(button.dataset.package, button.dataset.price);
    openDialog('#contactDialog', button);
  }));
  $$('[data-checklist]').forEach(button => button.addEventListener('click', () => openDialog('#checklistDialog', button)));
  $$('[data-site-info]').forEach(button => button.addEventListener('click', () => openDialog('#infoDialog', button)));

  // Only real, configured contact destinations become actionable links.
  function safeHttps(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function safePhone(raw) {
    if (typeof raw !== 'string' || !/^[+\d ()-]+$/.test(raw)) return null;
    const normalized = raw.replace(/[ ()-]/g, '');
    return /^\+?\d{7,15}$/.test(normalized) ? normalized : null;
  }
  function safeEmail(raw) {
    if (typeof raw !== 'string') return null;
    const email = raw.trim();
    if (email.length > 254 || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email)) return null;
    const local = email.split('@')[0];
    return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') ? email : null;
  }
  function consultationEmail(email, selectedPackage = '') {
    const subject = '온유 장례 상담 및 비용 문의';
    const body = [
      '안녕하세요. 반려동물 장례 상담을 문의드립니다.', '',
      ...(selectedPackage ? [`관심 구성 및 기준 요금: ${selectedPackage}`, '체중·용품 변경·이동 비용을 포함한 최종 견적을 요청합니다.', ''] : []),
      '반려동물 종류:', '대략적인 체중:', '희망 날짜와 시간:', '출발 지역:',
      '방문·이동 필요 여부:', '지정 화장 장소 안내 요청:', '메모리얼스톤 관심 여부:', '',
      '추가로 궁금한 내용:', '', '연락 가능한 번호 (전화 답변을 원하시는 경우):'
    ].join('\n');
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const channels = [];
  const phone = safePhone(config.phone);
  const email = safeEmail(config.email);
  const emailHref = email ? consultationEmail(email) : null;
  const chatUrl = safeHttps(config.chatUrl);
  const bookingUrl = safeHttps(config.bookingUrl);
  if (phone) channels.push({ label: '전화로 장례 상담', detail: config.phone, href: `tel:${phone}`, external: false });
  if (email) channels.push({ label: '이메일로 비용 문의', detail: email, href: emailHref, external: false, isEmail: true });
  if (chatUrl) channels.push({ label: '채팅 상담', href: chatUrl, external: true });
  if (bookingUrl) channels.push({ label: '예약 문의', href: bookingUrl, external: true });
  const channelContainer = $('#contactChannels');
  channels.forEach(channel => {
    const link = document.createElement('a');
    link.href = channel.href;
    if (channel.isEmail) link.dataset.consultationEmail = '';
    const caption = document.createElement('span');
    caption.className = 'channel-caption';
    const label = document.createElement('strong');
    label.textContent = channel.label;
    caption.append(label);
    if (channel.detail) {
      const detail = document.createElement('small');
      detail.textContent = channel.detail;
      caption.append(detail);
    }
    link.append(caption);
    if (channel.external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `${channel.label} (새 창)`); }
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);
    channelContainer.append(link);
  });
  $$('[data-phone-link]').forEach(link => {
    link.hidden = !phone;
    if (phone) link.href = `tel:${phone}`;
  });
  $$('[data-phone-text]').forEach(element => { if (phone) element.textContent = config.phone; });
  $$('[data-email-link]').forEach(link => {
    link.hidden = !email;
    if (email) link.href = emailHref;
  });
  $$('[data-email-text]').forEach(element => { if (email) element.textContent = email; });
  if (channels.length && typeof config.consultationHours === 'string' && config.consultationHours.trim()) {
    const hours = document.createElement('p');
    hours.textContent = `상담 운영시간\n${config.consultationHours}`;
    channelContainer.append(hours);
  }
  $('#contactUnavailable').hidden = channels.length > 0;
  channelContainer.hidden = channels.length === 0;
  if (channels.length) $('.drawer-guide h3').textContent = '상담 전, 먼저 살펴보세요.';
  function setConsultationPackage(name, rawPrice) {
    const selection = $('#selectedPackage');
    const price = Number(rawPrice);
    const selectedPackage = typeof name === 'string' && name.trim() && Number.isSafeInteger(price) && price > 0
      ? `${name.trim()} · ${price.toLocaleString('ko-KR')}원 (부가세 포함)` : '';
    if (selection) {
      selection.hidden = !selectedPackage;
      $('#selectedPackageName').textContent = selectedPackage;
    }
    const emailLink = $('[data-consultation-email]');
    if (email && emailLink) emailLink.href = consultationEmail(email, selectedPackage);
  }
  const businessFields = [
    ['businessName', '상호'], ['representative', '대표자'], ['registrationNumber', '사업자등록번호'],
    ['facilityLicense', '동물장묘업 등록번호'], ['address', '주소']
  ];
  const businessLines = businessFields.filter(([key]) => typeof config[key] === 'string' && config[key].trim()).map(([key, label]) => `${label} ${config[key].trim()}`);
  if (businessLines.length) { $('#businessInfo').textContent = businessLines.join(' · '); $('#businessInfo').hidden = false; }
  $('#year').textContent = String(new Date().getFullYear());

  // Step cards share one state for tabs, sequential controls and deep links.
  const tabs = $$('.journey-tabs [role="tab"]');
  const panels = $$('.journey-panel');
  const journeyGridMedia = window.matchMedia('(max-width: 700px)');
  const journeyPrevious = $('#journeyPrevious');
  const journeyNext = $('#journeyNext');
  let currentStep = 0;
  function activateStep(index, moveFocus = false) {
    if (!Number.isInteger(index) || index < 0 || index >= tabs.length) return;
    currentStep = index;
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (journeyPrevious) journeyPrevious.disabled = index === 0;
    if (journeyNext) journeyNext.disabled = index === tabs.length - 1;
    const status = $('#journeyStepStatus');
    if (status) status.textContent = `${String(index + 1).padStart(2, '0')} / ${String(tabs.length).padStart(2, '0')} · ${tabs[index].querySelector('strong').textContent}`;
    const progress = $('#journeyProgress');
    if (progress) progress.style.width = `${((index + 1) / tabs.length) * 100}%`;
    if (moveFocus) tabs[index].focus({ preventScroll: true });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateStep(index));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'ArrowDown' && journeyGridMedia.matches) next = (index + 2) % tabs.length;
      else if (event.key === 'ArrowUp' && journeyGridMedia.matches) next = (index - 2 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateStep(next, true);
    });
  });
  function moveJourney(amount) {
    const next = currentStep + amount;
    if (next < 0 || next >= tabs.length) return;
    activateStep(next);
    // Focus stays on visible content even when a boundary button becomes disabled.
    panels[next].focus({ preventScroll: true });
  }
  journeyPrevious?.addEventListener('click', () => moveJourney(-1));
  journeyNext?.addEventListener('click', () => moveJourney(1));
  function revealJourneyHash() {
    let target;
    try { target = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); }
    catch { return; }
    if (!target) return;
    const index = panels.findIndex(panel => panel === target || panel.contains(target));
    if (index !== -1) activateStep(index);
  }
  if (tabs.length && panels.length === tabs.length) {
    activateStep(0);
    revealJourneyHash();
    $('#journeyTabs').hidden = false;
    $('#journeyControls').hidden = false;
    window.addEventListener('hashchange', revealJourneyHash);
  }

  // Search is local and does not submit visitors' questions anywhere.
  let category = 'all';
  const faqItems = $$('#faqList details');
  const filters = $$('.faq-filters [data-category]');
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
  function filterFaq() {
    const search = normalize($('#faqSearch').value);
    let visibleCount = 0;
    faqItems.forEach(item => {
      const inCategory = category === 'all' || item.dataset.faqCategory === category;
      const matches = inCategory && normalize(item.textContent).includes(search);
      item.hidden = !matches;
      if (matches) visibleCount += 1;
      else item.open = false;
    });
    $('#faqEmpty').hidden = visibleCount !== 0;
    $('#faqCount').textContent = `${visibleCount}개의 질문이 있습니다.`;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    filterFaq();
  }));
  $('#faqSearch').addEventListener('input', filterFaq);
  faqItems.forEach(item => item.addEventListener('toggle', () => {
    if (item.open) faqItems.forEach(other => { if (other !== item) other.open = false; });
  }));
  filterFaq();

  // Checklist state is intentionally limited to this page session.
  const checklistInputs = $$('.checklist-items input[type="checkbox"]');
  function syncChecklist() {
    const checked = checklistInputs.filter(input => input.checked).length;
    $('#checkProgress').textContent = `${checked} / ${checklistInputs.length}개 선택`;
    $('#checkProgressBar').style.width = `${checked / checklistInputs.length * 100}%`;
    $('#copyChecklist').disabled = checked === 0;
    $('#copyStatus').textContent = '';
    $('#copyFallback').hidden = true;
  }
  checklistInputs.forEach(input => input.addEventListener('change', syncChecklist));
  $('#copyChecklist').addEventListener('click', async () => {
    const selected = checklistInputs.filter(input => input.checked);
    if (!selected.length) { $('#copyStatus').textContent = '복사할 질문을 먼저 선택해 주세요.'; return; }
    const text = ['[온유 상담 질문]', '', ...selected.map(input => `• ${input.value}`), '', '방문 전 일정·장소·총비용과 예약 확정 안내를 확인해 주세요.'].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      $('#copyStatus').textContent = '준비사항을 복사했습니다. 메모에 붙여넣어 보관하세요.';
      $('#copyFallback').hidden = true;
    } catch {
      $('#copyFallback').hidden = false;
      $('#checklistText').value = text;
      $('#checklistText').focus();
      $('#checklistText').select();
      $('#copyStatus').textContent = '자동 복사가 지원되지 않아 내용을 표시했습니다.';
    }
  });
  syncChecklist();

  if ('IntersectionObserver' in window) {
    const navLinks = $$('.desktop-nav a');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -55% 0px' });
    navLinks.forEach(link => { const section = $(link.getAttribute('href')); if (section) observer.observe(section); });
  }
})();
