/**
 * Urest - Background Service Worker
 * 
 * Manages global settings and exclusions.
 * Uses MV3 Service Worker patterns.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Urest] Extension installed.');
  
  // Initialize storage
  chrome.storage.local.get(['excludedDomains', 'enabled'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({ enabled: true });
    }
    if (result.excludedDomains === undefined) {
      chrome.storage.local.set({ excludedDomains: [] });
    }
  });
});

// Listen for storage changes if needed for logging or sync
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    console.log('[Urest] Storage updated:', changes);
  }
});
