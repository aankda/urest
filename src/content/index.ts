/**
 * Urest - Isolated World Manager
 * SSOT v1.0.0 (Public - Bulletproof)
 * 
 * Patched for "Async DOM Miss" race condition and MutationRecord property typos.
 */

(function() {
  const handshakeId = document.documentElement.getAttribute('data-ur-handshake');
  if (handshakeId) document.documentElement.removeAttribute('data-ur-handshake');

  let isActive = false; // Controls the synchronous observer logic

  const injectStyles = () => {
    if (document.getElementById('urest-surgical-styles')) return;
    const style = document.createElement('style');
    style.id = 'urest-surgical-styles';
    style.textContent = `html, body, *, *::before, *::after { -webkit-user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important; user-select: text !important; }`;
    (document.head || document.documentElement).appendChild(style);
  };

  const removeRestrictions = (el: Element) => {
    ['oncontextmenu', 'onselectstart', 'oncopy'].forEach(attr => { if (el.hasAttribute(attr)) el.removeAttribute(attr); });
  };

  /**
   * 1. Start Observer SYNCHRONOUSLY to prevent the "Async DOM Miss"
   * Attaching here at document_start ensures we don't miss nodes parsed during 
   * the async window of the storage fetch.
   */
  const observer = new MutationObserver((mutations) => {
    if (!isActive) return; // Ignore mutations if extension is disabled on this site
    
    const nodesToProcess = new Set<Element>();
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName) {
        removeRestrictions(mutation.target as Element);
      } else if (mutation.type === 'childList') { // TYPO FIXED: mutation.childList -> mutation.type === 'childList'
        mutation.addedNodes.forEach(node => { if (node instanceof Element) nodesToProcess.add(node); });
      }
    });
    
    nodesToProcess.forEach(node => {
      removeRestrictions(node);
      node.querySelectorAll('[oncontextmenu], [onselectstart], [oncopy]').forEach(el => removeRestrictions(el as Element));
    });
  });

  // Attach immediately at document_start
  observer.observe(document, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['oncontextmenu', 'onselectstart', 'oncopy'] 
  });

  /**
   * 2. Perform a SINGLE Storage Read
   * Consolidation ensures absolute consistency between the handshake and the observer state.
   */
  chrome.storage.local.get(['excludedDomains', 'enabled'], (result) => {
    const enabled = result.enabled !== false;
    const excluded = (result.excludedDomains || []).includes(window.location.hostname);

    // Dispatch the handshake to the MAIN world (inject.ts)
    if (handshakeId) {
      document.dispatchEvent(new CustomEvent(`UR_INIT_${handshakeId}`, {
        detail: { e: enabled, x: excluded } 
      }));
    }

    if (enabled && !excluded) {
      isActive = true; // Activate the observer processing logic
      injectStyles();
      // Catch any nodes that were parsed between script execution and this storage callback
      document.querySelectorAll('[oncontextmenu], [onselectstart], [oncopy]').forEach(el => removeRestrictions(el as Element));
    } else {
      // Disconnect if disabled to free up browser resources
      observer.disconnect(); 
    }
  });
})();
