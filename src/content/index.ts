/**
 * Urest - Isolated World Manager
 * SSOT v1.0.1 (Public - Bulletproof)
 * 
 * Patched for handshake race conditions, stats aggregation, and config caching.
 */

(function() {
  const root = document.documentElement;
  let isActive = false;
  let handshakeOk = false;
  let enabled = true;
  let excluded = false;
  let blocksNeutralized = 0;
  let blocksPending = 0;
  let blocksFlushTimer: number | null = null;

  const injectStyles = () => {
    if (document.getElementById('urest-surgical-styles')) return;
    const style = document.createElement('style');
    style.id = 'urest-surgical-styles';
    style.textContent = `html, body, *, *::before, *::after { -webkit-user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important; user-select: text !important; }`;
    (document.head || document.documentElement).appendChild(style);
  };

  const removeRestrictions = (el: Element) => {
    ['oncontextmenu', 'onselectstart', 'oncopy'].forEach(attr => {
      if (el.hasAttribute(attr)) el.removeAttribute(attr);
    });
  };

  const flushBlocks = () => {
    if (blocksPending === 0) return;
    blocksNeutralized += blocksPending;
    blocksPending = 0;
    chrome.storage.local.set({ blocksNeutralized });
    blocksFlushTimer = null;
  };

  const recordBlocks = (count: number) => {
    if (!isActive || count <= 0) return;
    blocksPending += count;
    if (blocksFlushTimer !== null) return;
    blocksFlushTimer = window.setTimeout(flushBlocks, 800);
  };

  const waitForHandshake = (timeoutMs = 700): Promise<string | null> => {
    const readId = () => (root ? root.getAttribute('data-ur-handshake') : null);
    return new Promise(resolve => {
      const existing = readId();
      if (existing) {
        root?.removeAttribute('data-ur-handshake');
        resolve(existing);
        return;
      }
      if (!root) {
        resolve(null);
        return;
      }
      const observer = new MutationObserver(() => {
        const id = readId();
        if (!id) return;
        observer.disconnect();
        root.removeAttribute('data-ur-handshake');
        resolve(id);
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-ur-handshake'] });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  };

  const sendMessageWithTimeout = <T,>(message: unknown, timeoutMs: number): Promise<T | null> => {
    return new Promise(resolve => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve(null);
      }, timeoutMs);
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve((response as T) ?? null);
        });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  };

  const getConfig = async (host: string) => {
    const cached = await sendMessageWithTimeout<{ enabled: boolean; excluded: boolean }>(
      { type: 'UR_GET_CONFIG', host },
      150
    );
    if (cached) return cached;

    const result = await chrome.storage.local.get(['excludedDomains', 'enabled']);
    return {
      enabled: result.enabled !== false,
      excluded: (result.excludedDomains || []).includes(host)
    };
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
      } else if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) nodesToProcess.add(node);
        });
      }
    });
    
    nodesToProcess.forEach(node => {
      removeRestrictions(node);
      node.querySelectorAll('[oncontextmenu], [onselectstart], [oncopy]').forEach(el => {
        removeRestrictions(el as Element);
      });
    });
  });

  // Attach immediately at document_start
  observer.observe(document, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['oncontextmenu', 'onselectstart', 'oncopy'] 
  });

  const init = async () => {
    const host = window.location.hostname;
    const handshakeId = await waitForHandshake(800);
    const storedStats = await chrome.storage.local.get(['blocksNeutralized']);
    blocksNeutralized = typeof storedStats.blocksNeutralized === 'number' ? storedStats.blocksNeutralized : 0;

    const config = await getConfig(host);
    enabled = config.enabled;
    excluded = config.excluded;

    if (handshakeId) {
      document.addEventListener(`UR_ACK_${handshakeId}`, () => {
        handshakeOk = true;
      }, { once: true });

      document.addEventListener(`UR_STAT_${handshakeId}`, (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const count = typeof detail?.c === 'number' ? detail.c : 0;
        recordBlocks(count);
      });

      // Dispatch the handshake to the MAIN world (inject.ts)
      document.dispatchEvent(new CustomEvent(`UR_INIT_${handshakeId}`, {
        detail: { e: enabled, x: excluded } 
      }));
    }

    if (enabled && !excluded) {
      isActive = true; // Activate the observer processing logic
      injectStyles();
      // Catch any nodes that were parsed between script execution and this storage callback
      document.querySelectorAll('[oncontextmenu], [onselectstart], [oncopy]').forEach(el => {
        removeRestrictions(el as Element);
      });
    } else {
      // Disconnect if disabled to free up browser resources
      observer.disconnect(); 
    }
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'UR_GET_STATUS') {
      sendResponse({
        active: isActive,
        handshake: handshakeOk,
        enabled,
        excluded,
        blocksNeutralized
      });
      return true;
    }
    return false;
  });

  init();
})();
