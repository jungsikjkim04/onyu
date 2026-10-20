'use strict';
(() => {
  const story = document.getElementById('ourStory');
  if (!story) return;
  const stage = story.querySelector('.story-stage');
  const scenes = [...story.querySelectorAll('.story-scene')];
  const captions = scenes.map(scene => scene.querySelector('.story-caption'));
  const videos = scenes.map(scene => scene.querySelector('video'));
  const chapterButtons = [...story.querySelectorAll('[data-story-chapter]')];
  const playButton = story.querySelector('[data-story-play]');
  const playLabel = playButton.querySelector('[data-play-label]');
  const progressBar = story.querySelector('.story-progress span');
  const message = story.querySelector('.story-media-message');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const loaded = new Set();
  const pending = new Set();
  let cinematic = false;
  let wantsPlayback = false;
  let mediaBlocked = false;
  let inView = true;
  let nearViewport = true;
  let frame = 0;
  let state = { current: 0, next: 1, mix: 0, active: 0, progress: 0 };

  // Pure timeline mapping: hold each chapter, then crossfade into the next.
  function calculateSceneState(progress) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    const position = clamped * 4;
    const current = Math.min(3, Math.floor(position));
    const next = Math.min(3, current + 1);
    const mix = current === 3 ? 0 : Math.max(0, Math.min(1, (position - current - 0.64) / 0.36));
    return { current, next, mix, active: mix >= 0.5 ? next : current, progress: clamped };
  }

  function headerHeight() {
    return parseFloat(getComputedStyle(story).getPropertyValue('--story-header')) || 0;
  }

  function pauseAll() { videos.forEach(video => video.pause()); }

  function updatePlaybackButton() {
    playLabel.textContent = wantsPlayback ? '영상 멈추기' : (mediaBlocked ? '영상 다시 재생' : '영상 재생');
    playButton.setAttribute('aria-label', wantsPlayback ? '배경 영상 일시 정지' : '배경 영상 재생');
    playButton.setAttribute('aria-pressed', String(wantsPlayback));
    playButton.querySelector('[data-pause-icon]').toggleAttribute('hidden', !wantsPlayback);
    playButton.querySelector('[data-play-icon]').toggleAttribute('hidden', wantsPlayback);
  }

  function stopForMediaFailure() {
    wantsPlayback = false;
    mediaBlocked = true;
    pauseAll();
    updatePlaybackButton();
    message.textContent = '사진으로 이야기를 이어갑니다. 원하시면 영상을 재생해 주세요.';
    message.hidden = false;
  }

  function loadVideo(index) {
    const video = videos[index];
    if (!loaded.has(index)) {
      loaded.add(index);
      video.src = video.dataset.src;
      video.preload = 'auto';
      video.load();
    }
    return video;
  }

  function syncMedia() {
    if (!wantsPlayback || !inView || document.hidden) {
      pauseAll();
      return;
    }
    const wanted = new Set(cinematic ? [state.current, state.next] : [state.active]);
    videos.forEach((video, index) => {
      if (!wanted.has(index)) {
        video.pause();
        if (loaded.has(index)) {
          loaded.delete(index);
          video.removeAttribute('src');
          video.classList.remove('is-ready');
          video.load();
        }
        return;
      }
      loadVideo(index);
      // Only the visible scene plays; the next clip is buffered for its fade.
      const visible = !cinematic || index === state.current || state.mix > 0;
      if (!visible) { video.pause(); return; }
      if (!video.paused || pending.has(index)) return;
      pending.add(index);
      const result = video.play();
      if (result && typeof result.then === 'function') {
        result.then(() => {
          pending.delete(index);
          const stillVisible = cinematic ? index === state.current || (index === state.next && state.mix > 0) : state.active === index;
          if (!wantsPlayback || !inView || document.hidden || !stillVisible) video.pause();
        }).catch(error => {
          pending.delete(index);
          // A pause while a play request is pending is an ordinary lifecycle event.
          if (error?.name !== 'AbortError' && wantsPlayback && inView && !document.hidden) stopForMediaFailure();
        });
      } else pending.delete(index);
    });
  }

  function setCaptionAvailability(index, available) {
    const caption = captions[index];
    caption.inert = !available;
    caption.toggleAttribute('inert', !available);
    if (available) caption.removeAttribute('aria-hidden');
    else caption.setAttribute('aria-hidden', 'true');
    caption.querySelectorAll('a,button').forEach(control => {
      if (available) control.removeAttribute('tabindex');
      else control.setAttribute('tabindex', '-1');
    });
  }

  function render() {
    frame = 0;
    const bounds = story.getBoundingClientRect();
    const header = headerHeight();
    inView = bounds.bottom > header && bounds.top < window.innerHeight;
    if (cinematic) {
      const travel = Math.max(1, story.offsetHeight - stage.offsetHeight);
      state = calculateSceneState((header - bounds.top) / travel);
      scenes.forEach((scene, index) => {
        const alpha = index === state.current ? 1 - state.mix : (index === state.next ? state.mix : 0);
        // The final chapter has no incoming layer.
        scene.style.opacity = String(state.current === 3 && index === 3 ? 1 : alpha);
        captions[index].style.transform = `translateY(${index === state.current ? -16 * state.mix : 24 * (1 - state.mix)}px)`;
        setCaptionAvailability(index, index === state.active);
      });
      progressBar.style.transform = `scaleX(${state.progress})`;
    } else {
      const target = header + (window.innerHeight - header) / 2;
      let closest = 0;
      let distance = Infinity;
      scenes.forEach((scene, index) => {
        const box = scene.getBoundingClientRect();
        const nextDistance = Math.abs((box.top + box.bottom) / 2 - target);
        if (nextDistance < distance) { distance = nextDistance; closest = index; }
      });
      state = { current: closest, next: closest, mix: 0, active: closest, progress: closest / 3 };
    }
    chapterButtons.forEach((button, index) => {
      if (index === state.active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    syncMedia();
  }

  function scheduleRender() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  function configureMode() {
    const allowMotion = !motionPreference.matches && !connection?.saveData;
    cinematic = allowMotion;
    // Changing a system preference must never re-enable playback after a pause.
    if (!allowMotion) wantsPlayback = false;
    story.classList.toggle('story--cinematic', cinematic);
    scenes.forEach((scene, index) => {
      scene.style.removeProperty('opacity');
      captions[index].style.removeProperty('transform');
      setCaptionAvailability(index, !cinematic || index === state.active);
    });
    updatePlaybackButton();
    scheduleRender();
  }

  videos.forEach(video => {
    video.muted = true;
    video.addEventListener('playing', () => video.classList.add('is-ready'));
    video.addEventListener('error', () => {
      video.classList.remove('is-ready');
      if (wantsPlayback && inView) stopForMediaFailure();
    });
  });

  chapterButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const bounds = story.getBoundingClientRect();
      const travel = Math.max(1, story.offsetHeight - stage.offsetHeight);
      const top = cinematic
        ? window.scrollY + bounds.top - headerHeight() + travel * (index / 4)
        : window.scrollY + scenes[index].getBoundingClientRect().top - headerHeight();
      window.scrollTo({ top, behavior: motionPreference.matches ? 'instant' : 'smooth' });
    });
  });

  playButton.addEventListener('click', () => {
    wantsPlayback = !wantsPlayback;
    if (wantsPlayback) {
      mediaBlocked = false;
      message.hidden = true;
      videos.forEach((video, index) => { if (video.error) { loaded.delete(index); video.classList.remove('is-ready'); } });
    }
    updatePlaybackButton();
    // Keep play() in the gesture handler for browsers that require activation.
    syncMedia();
  });

  window.addEventListener('scroll', () => { if (nearViewport) scheduleRender(); }, { passive: true });
  window.addEventListener('resize', scheduleRender, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); else scheduleRender(); });
  window.addEventListener('pagehide', pauseAll);
  window.addEventListener('pageshow', scheduleRender);
  motionPreference.addEventListener('change', configureMode);
  connection?.addEventListener?.('change', configureMode);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      nearViewport = entries[0].isIntersecting;
      if (nearViewport) scheduleRender();
      else { inView = false; pauseAll(); }
    });
    observer.observe(story);
  } else window.addEventListener('scroll', scheduleRender, { passive: true });

  wantsPlayback = !motionPreference.matches && !connection?.saveData;
  playButton.hidden = false;
  configureMode();
})();
