/**
 * Urest - Background Service Worker
 * 
 * Manages global settings, exclusions, and context menu actions.
 * Uses MV3 Service Worker patterns.
 */

const state = {
  enabled: true,
  excludedDomains: new Set<string>()
};

const tabCache = new Map<number, { host: string; excluded: boolean }>();

const isWebUrl = (url?: string) => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

const getHost = (url?: string) => {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const updateTabCache = async (tabId: number, url?: string) => {
  let resolvedUrl = url;
  if (!resolvedUrl) {
    try {
      const tab = await chrome.tabs.get(tabId);
      resolvedUrl = tab.url;
    } catch {
      return;
    }
  }
  const host = getHost(resolvedUrl);
  if (!host) {
    tabCache.set(tabId, { host: '', excluded: false });
    return;
  }
  tabCache.set(tabId, { host, excluded: state.excludedDomains.has(host) });
};

const updateContextMenuForTab = async (tabId: number) => {
  const entry = tabCache.get(tabId);
  if (!entry || !entry.host) {
    chrome.contextMenus.update('urest-toggle-site', {
      title: 'Urest: Disable on this site',
      enabled: false
    });
    return;
  }
  chrome.contextMenus.update('urest-toggle-site', {
    title: entry.excluded ? 'Urest: Enable on this site' : 'Urest: Disable on this site',
    enabled: true
  });
};

const refreshActiveTabMenu = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const tabId = activeTab?.id;
    if (tabId === undefined) return;
    updateTabCache(tabId, activeTab.url).then(() => {
      updateContextMenuForTab(tabId);
    });
  });
};

const ensureContextMenu = () => {
  chrome.contextMenus.create({
    id: 'urest-toggle-site',
    title: 'Urest: Disable on this site',
    contexts: ['all']
  }, () => {
    if (chrome.runtime.lastError) return;
    refreshActiveTabMenu();
  });
};

const loadState = async () => {
  const result = await chrome.storage.local.get(['excludedDomains', 'enabled']);
  state.enabled = result.enabled !== false;
  state.excludedDomains = new Set<string>(result.excludedDomains || []);
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['excludedDomains', 'enabled'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({ enabled: true });
    }
    if (result.excludedDomains === undefined) {
      chrome.storage.local.set({ excludedDomains: [] });
    }
  });
  loadState().then(ensureContextMenu);
});

chrome.runtime.onStartup.addListener(() => {
  loadState().then(ensureContextMenu);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) {
    state.enabled = changes.enabled.newValue !== false;
  }
  if (changes.excludedDomains) {
    state.excludedDomains = new Set<string>(changes.excludedDomains.newValue || []);
  }
  refreshActiveTabMenu();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateTabCache(tabId).then(() => updateContextMenuForTab(tabId));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || tab.status === 'complete') {
    updateTabCache(tabId, tab.url).then(() => {
      if (tab.active) updateContextMenuForTab(tabId);
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'urest-toggle-site') return;
  if (!tab?.id || !isWebUrl(tab.url)) return;
  const host = getHost(tab.url);
  if (!host) return;

  const nextExcluded = new Set(state.excludedDomains);
  if (nextExcluded.has(host)) {
    nextExcluded.delete(host);
  } else {
    nextExcluded.add(host);
  }
  state.excludedDomains = nextExcluded;
  chrome.storage.local.set({ excludedDomains: Array.from(nextExcluded) });

  tabCache.set(tab.id, { host, excluded: nextExcluded.has(host) });
  updateContextMenuForTab(tab.id);
  chrome.tabs.reload(tab.id);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'UR_GET_CONFIG') {
    const host = typeof message.host === 'string' ? message.host : '';
    sendResponse({
      enabled: state.enabled,
      excluded: host ? state.excludedDomains.has(host) : false
    });
    return true;
  }
  return false;
});
