(() => {
  const contact = document.getElementById('contact');
  const trigger = document.getElementById('contact-trigger');
  const label = document.getElementById('contact-label');
  const card = document.getElementById('contact-card');
  const portrait = document.getElementById('portrait');
  const email = document.getElementById('contact-email');
  const profile = window.hictorProfile || {};
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isOpen = false;
  let pinned = false;
  let closeTimer;
  let revealFrame;
  let restoringFocus = false;

  if (profile.name) document.getElementById('contact-name').textContent = profile.name;
  if (profile.email) {
    email.href = `mailto:${profile.email}`;
    document.getElementById('email-text').textContent = profile.email;
    email.hidden = false;
  }
  if (profile.photo) {
    const image = new Image();
    image.alt = profile.name || 'Hictor Nagel';
    image.draggable = false;
    image.addEventListener('load', () => {
      portrait.replaceChildren(image);
      portrait.removeAttribute('aria-hidden');
    });
    image.src = profile.photo;
  }
  portrait.addEventListener('dragstart', (event) => event.preventDefault());
  portrait.addEventListener('contextmenu', (event) => event.preventDefault());

  function positionCard() {
    const bounds = trigger.getBoundingClientRect();
    const width = card.offsetWidth;
    const viewportWidth = document.documentElement.clientWidth;
    const left = viewportWidth <= 600 ? bounds.left + bounds.width / 2 - width / 2 : bounds.right - width;
    const clampedLeft = Math.max(20, Math.min(left, viewportWidth - width - 20));
    contact.style.setProperty('--card-offset', `${clampedLeft - left}px`);
    if (viewportWidth <= 600) {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      card.style.setProperty('--card-max-height', `${Math.max(0, viewportHeight - bounds.bottom - 26)}px`);
    } else {
      card.style.removeProperty('--card-max-height');
    }
  }

  function open() {
    clearTimeout(closeTimer);
    if (isOpen) return;
    isOpen = true;
    card.hidden = false;
    card.inert = false;
    positionCard();
    card.getBoundingClientRect();
    trigger.setAttribute('aria-expanded', 'true');
    label.textContent = 'hablemos';
    cancelAnimationFrame(revealFrame);
    revealFrame = requestAnimationFrame(() => {
      if (isOpen) contact.classList.add('is-open');
    });
  }

  function close(restoreFocus = false) {
    clearTimeout(closeTimer);
    cancelAnimationFrame(revealFrame);
    pinned = false;
    isOpen = false;
    contact.classList.remove('is-open');
    card.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    label.textContent = 'contacto';
    if (restoreFocus) {
      restoringFocus = true;
      trigger.focus();
      restoringFocus = false;
    }
    closeTimer = setTimeout(() => {
      if (!isOpen) card.hidden = true;
    }, reduceMotion.matches ? 0 : 320);
  }

  contact.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse' && canHover.matches) open();
  });
  contact.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !pinned && !contact.contains(document.activeElement)) {
      closeTimer = setTimeout(() => close(), 180);
    }
  });
  contact.addEventListener('focusin', () => {
    if (!restoringFocus) open();
  });
  contact.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!contact.contains(document.activeElement) && !(canHover.matches && contact.matches(':hover'))) close();
    }, 0);
  });
  trigger.addEventListener('click', () => {
    if (pinned && isOpen) {
      close();
      return;
    }
    pinned = true;
    open();
  });
  document.addEventListener('pointerdown', (event) => {
    if (isOpen && !contact.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) close(true);
  });
  window.addEventListener('resize', () => { if (isOpen) positionCard(); }, { passive: true });
  window.visualViewport?.addEventListener('resize', () => { if (isOpen) positionCard(); }, { passive: true });
  document.fonts.ready.then(() => { if (isOpen) positionCard(); });
})();
