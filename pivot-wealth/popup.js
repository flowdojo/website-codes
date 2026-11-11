(function () {
  'use strict';

  // ==================== Form placement: inline on mobile, modal on desktop (or inline for the A/B variant) ====================
  // The form's home is the hero block (.vsl-ancor / [vsl-ancor] / [vsl-inline-form]). Below 768px the Designer shows
  // that block (display:flex), so the form is simply inline and the modal is not used.
  //  - 768px and up: the script moves the form into the modal [vsl-form-modal]; any button/link inside
  //    [vsl-form-button-group] opens it.
  //  - A/B variant: window.dispatchEvent(new Event('vsl:form-inline')) (or window.__vslFormInline = true before this
  //    script loads) keeps the form in the hero block on every screen size, shows it, removes the modal, and the
  //    buttons scroll to it.
  function formPlacement() {
    var EVENT = 'vsl:form-inline';
    var WRAP = '.vsl-qf-wrap, .vsl-form-owners-wrap';
    var modal = document.querySelector('[vsl-form-modal]');
    var content = modal && modal.querySelector('.vsl-form-modal-content');
    // the form goes inside .vsl-form-container when the modal has one (it carries the form's width/padding)
    var slot = modal && (modal.querySelector('.vsl-form-container') || content);
    var overlay = document.querySelector('.vsl-form-modal-overlay');
    var anchor = document.querySelector('[vsl-inline-form], [vsl-ancor], .vsl-ancor');
    var hasGsap = typeof window.gsap !== 'undefined';
    var mq = window.matchMedia ? window.matchMedia('(max-width: 767px)') : { matches: false };
    var forcedInline = false; // set by the A/B event, or when the page has no modal
    var isOpen = false;
    var lastFocus = null;
    var unit = null; // the top-level child of the anchor that holds the form

    // keep the hero block hidden before first paint on desktop so the form never flashes there; the Designer
    // decides what it looks like on mobile
    var hide = document.createElement('style');
    hide.textContent =
      '@media (min-width:768px){[vsl-inline-form],[vsl-ancor],.vsl-ancor{display:none}}' +
      // inside the modal the glass card needs a solid fill, or the dimmed page shows through the form
      '[vsl-form-modal] .vsl-qf-wrap{background-color:#102b4b}';
    document.head.appendChild(hide);

    // exactly one form on the page: keep the one in the anchor (else the first), drop duplicates
    (function dedupe() {
      var wraps = Array.prototype.slice.call(document.querySelectorAll(WRAP));
      if (wraps.length < 2) return;
      var keep = wraps.filter(function (w) { return anchor && anchor.contains(w); })[0] || wraps[0];
      wraps.forEach(function (w) {
        if (w === keep) return;
        var holder = w.closest('.container-medium') || w;
        if (holder.contains(keep)) holder = w;
        holder.remove();
      });
    })();

    var formWrap = document.querySelector(WRAP);
    if (formWrap && anchor && anchor.contains(formWrap)) {
      unit = formWrap;
      while (unit.parentElement && unit.parentElement !== anchor) unit = unit.parentElement;
    } else if (formWrap) {
      unit = formWrap.closest('.container-medium') || formWrap;
    }

    function inlineNow() {
      return forcedInline || mq.matches || !modal || !content || !slot;
    }

    function closedState() {
      if (!modal) return;
      modal.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      if (hasGsap && content) window.gsap.set(content, { yPercent: 100 });
    }

    function openModal() {
      if (!modal || isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      modal.style.display = 'flex';
      if (overlay) overlay.style.display = 'block';
      modal.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      if (hasGsap) {
        var g = window.gsap;
        g.killTweensOf([modal, content, overlay]);
        g.fromTo(modal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
        if (overlay) g.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
        if (content) g.fromTo(content, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' });
      } else {
        modal.style.opacity = '1';
      }
    }

    function closeModal() {
      if (!isOpen) return;
      isOpen = false;
      document.documentElement.style.overflow = '';
      var finished = false;
      function done() {
        if (finished) return;
        finished = true;
        closedState();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      // animations pause in a hidden tab, so never rely on the tween's onComplete alone
      setTimeout(done, 800);
      if (hasGsap) {
        var g = window.gsap;
        g.killTweensOf([modal, content, overlay]);
        if (content) g.to(content, { yPercent: 100, duration: 0.4, ease: 'power3.in' });
        if (overlay) g.to(overlay, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' });
        g.to(modal, { autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
      } else {
        done();
      }
    }

    // A/B inline variant: the form is already on the page, so the hero CTA group ([vsl-form-button-group="hero"]) goes away
    function hideHeroCta() {
      Array.prototype.forEach.call(document.querySelectorAll('[vsl-form-button-group="hero"]'), function (el) {
        el.style.display = 'none';
      });
    }

    // put the form where the current mode wants it
    function applyLayout() {
      if (forcedInline) hideHeroCta();
      if (inlineNow()) {
        if (isOpen) closeModal();
        if (unit && anchor && !anchor.contains(unit)) anchor.appendChild(unit);
        // on mobile the Designer already shows the block; otherwise (A/B variant) show it ourselves
        if (anchor) anchor.style.display = mq.matches && !forcedInline ? '' : 'flex';
      } else {
        if (unit && !slot.contains(unit)) slot.appendChild(unit);
        if (anchor) anchor.style.display = '';
      }
    }

    function scrollToForm() {
      if (!anchor) return;
      if (window.lenis && typeof window.lenis.scrollTo === 'function') window.lenis.scrollTo(anchor);
      else anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function switchToInline() {
      if (forcedInline) return;
      if (!anchor) {
        console.warn('[pivot-vsl-owners] vsl:form-inline fired but there is no hero block (.vsl-ancor / [vsl-inline-form]); keeping the modal');
        return;
      }
      forcedInline = true;
      applyLayout();
      if (modal) modal.remove();
      if (overlay) overlay.remove();
      modal = content = slot = overlay = null;
      document.documentElement.style.overflow = '';
    }

    document.addEventListener('click', function (e) {
      var group = e.target.closest('[vsl-form-button-group]');
      if (group && e.target.closest('a, button, input[type="button"], input[type="submit"], [role="button"]')) {
        e.preventDefault();
        if (inlineNow()) scrollToForm();
        else openModal();
        return;
      }
      if (isOpen && (e.target === overlay || e.target === modal || e.target.closest('.vsl-form-modal-close'))) {
        closeModal();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    window.addEventListener(EVENT, switchToInline);
    window.vslFormMode = function (m) {
      if (m === 'inline') switchToInline();
    };
    // crossing the 768px breakpoint (rotate, resize) moves the form between the hero block and the modal
    if (mq.addEventListener) mq.addEventListener('change', applyLayout);
    else if (mq.addListener) mq.addListener(applyLayout);

    closedState();
    if (window.__vslFormInline) forcedInline = true;
    applyLayout();
    if (forcedInline && modal) {
      modal.remove();
      if (overlay) overlay.remove();
      modal = content = slot = overlay = null;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', formPlacement);
  else formPlacement();
})();
