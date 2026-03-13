/**
 * Urest - Page World Neutralizer (MAIN World)
 * SSOT v1.0.0 (Public)
 * 
 * This script runs in the site's own JavaScript context to intercept
 * native API calls that isolated content scripts cannot reach.
 */

(function() {
  // 1. Secure handshake initialization
  // Generates a unique ID and passes it to the ISOLATED world via the DOM.
  const handshakeId = crypto.randomUUID();
  document.documentElement.setAttribute('data-ur-handshake', handshakeId);

  const restrictedEvents = ['contextmenu', 'selectstart', 'copy'];

  /**
   * Enhanced Input Guard: Detects if the target is an editable or selectable input element.
   * Traverses Shadow DOM boundaries natively (Critical for Monaco/CodeMirror).
   */
  const isInputElement = (target: EventTarget | null): boolean => {
    // Handle SVGs, MathML, and Text Nodes natively
    if (!(target instanceof Element)) {
      if (target instanceof Node && target.nodeType === Node.TEXT_NODE && target.parentElement) {
        target = target.parentElement;
      } else {
        return false; 
      }
    }

    let current: Element | null = target as Element;

    // Traverse Shadow DOM boundaries recursively
    while (current) {
      if (
        current.tagName === 'INPUT' || 
        current.tagName === 'TEXTAREA' || 
        current.tagName === 'SELECT' || 
        (current as HTMLElement).isContentEditable || 
        current.closest('[contenteditable="true"], .CodeMirror, .monaco-editor, [data-mode-id]') !== null ||
        current.getAttribute('role') === 'textbox' || 
        current.getAttribute('role') === 'spinbutton'
      ) {
        return true;
      }
      
      // Jump the shadow boundary to the host if we hit the top of a ShadowRoot
      const root = current.getRootNode();
      current = (root instanceof ShadowRoot && root.host) ? root.host : null;
    }
    
    return false;
  };

  const initNeutralizer = (enabled: boolean, excluded: boolean) => {
    if (!enabled || excluded) return;

    const originalPreventDefault = Event.prototype.preventDefault;
    
    // Lock the native reference against malicious re-patching (Performance & Security)
    Object.defineProperty(Event.prototype, 'preventDefault', {
      value: function(this: Event) {
        if (restrictedEvents.includes(this.type)) {
          if (isInputElement(this.target)) {
            return originalPreventDefault.apply(this, arguments as any);
          }
          return; // Surgical unblocking: Drop the preventDefault call
        }
        return originalPreventDefault.apply(this, arguments as any);
      },
      writable: false,
      configurable: false
    });

    // Secondary fallback for legacy property assignment blockers
    ['contextmenu', 'selectstart', 'copy'].forEach(type => {
      try {
        Object.defineProperty(document, `on${type}`, { 
          set: () => {}, 
          get: () => null, 
          configurable: true 
        });
      } catch (e) {
        // Silently swallow errors (e.g., Strict Mode or TrustedTypes)
      }
    });
  };

  // 2. Fallback Timer (Fail-Closed): Prevents extension activation if storage hangs
  const fallbackTimer = setTimeout(() => {
    initNeutralizer(false, true); // Do nothing on timeout
  }, 500);

  // 3. Secure listener with { once: true } memory hygiene
  // Listens for the config payload dispatched from the ISOLATED world.
  document.addEventListener(`UR_INIT_${handshakeId}`, (e: Event) => {
    clearTimeout(fallbackTimer);
    const config = (e as CustomEvent).detail;
    // Explicit boolean casting to close type-coercion attack surface
    initNeutralizer(config.e === true, config.x === true); 
  }, { once: true });
})();
