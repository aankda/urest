import React, { useEffect, useState } from 'react';
import { MousePointer2, ShieldCheck, ShieldAlert, Globe, X, List, ArrowLeft, ArrowUpRight, FlaskConical } from 'lucide-react';

const App: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isExcluded, setIsExcluded] = useState(false);
  const [excludedDomains, setExcludedDomains] = useState<string[]>([]);
  const [currentHost, setCurrentHost] = useState('');
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [handshakeActive, setHandshakeActive] = useState(false);
  const [blocksNeutralized, setBlocksNeutralized] = useState(0);
  const iconUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL('icon128.png') : '';

  useEffect(() => {
    const init = async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab?.url) return;
        let hostLabel = 'System Page';
        let isWeb = false;
        try {
          const url = new URL(tab.url);
          isWeb = url.protocol === 'http:' || url.protocol === 'https:';
          hostLabel = isWeb ? url.hostname : 'System Page';
        } catch {
          hostLabel = 'System Page';
        }
        setCurrentHost(hostLabel);

        const result = await chrome.storage.local.get(['excludedDomains', 'enabled', 'blocksNeutralized']);
        const excluded = result.excludedDomains || [];
        setIsEnabled(result.enabled !== false);
        setIsExcluded(isWeb ? excluded.includes(hostLabel) : false);
        setExcludedDomains(excluded);
        setBlocksNeutralized(typeof result.blocksNeutralized === 'number' ? result.blocksNeutralized : 0);

        if (!isWeb || !tab.id) {
          setHandshakeActive(false);
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'UR_GET_STATUS' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            setHandshakeActive(false);
            return;
          }
          setHandshakeActive(Boolean(response.handshake && response.active));
          if (typeof response.blocksNeutralized === 'number') {
            setBlocksNeutralized(response.blocksNeutralized);
          }
        });
      });
    };

    init();
  }, []);

  const toggleGlobal = async () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    await chrome.storage.local.set({ enabled: newState });
    reloadAllTabs();
  };

  const toggleExclusion = async () => {
    if (currentHost === 'System Page') return;

    let newExclusions = [...excludedDomains];
    if (isExcluded) {
      newExclusions = newExclusions.filter(h => h !== currentHost);
    } else {
      newExclusions.push(currentHost);
    }
    
    await chrome.storage.local.set({ excludedDomains: newExclusions });
    setExcludedDomains(newExclusions);
    setIsExcluded(!isExcluded);
    reloadCurrentTab();
  };

  const removeExclusion = async (domain: string) => {
    const newExclusions = excludedDomains.filter(d => d !== domain);
    await chrome.storage.local.set({ excludedDomains: newExclusions });
    setExcludedDomains(newExclusions);
    
    if (domain === currentHost) {
      setIsExcluded(false);
    }
    
    reloadTabsForDomain(domain);
  };

  const reloadAllTabs = () => {
    const allowedSchemes = ['http:', 'https:', 'file:'];
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && tab.url) {
          try {
            const url = new URL(tab.url);
            if (allowedSchemes.includes(url.protocol)) {
              chrome.tabs.reload(tab.id);
            }
          } catch (e) {
            // Skip invalid/unparseable URLs
          }
        }
      });
    });
  };

  const reloadCurrentTab = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.reload(activeTab.id);
      }
    });
  };

  const reloadTabsForDomain = (domain: string) => {
    const allowedSchemes = ['http:', 'https:', 'file:'];
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (!tab.id || !tab.url || !tab.url.includes(domain)) return;
        try {
          const url = new URL(tab.url);
          if (allowedSchemes.includes(url.protocol)) {
            chrome.tabs.reload(tab.id);
          }
        } catch {
          // Skip invalid/unparseable URLs
        }
      });
    });
  };

  const openVerificationPage = () => {
    chrome.tabs.create({ url: 'https://aankda.github.io/urest/verification.html' });
  };

  const isSystemPage = currentHost === 'System Page';

  if (view === 'settings') {
    return (
      <div className="p-4 bg-slate-900 min-h-[400px] flex flex-col gap-4">
        <header className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="font-bold text-lg">Manage Exclusions</h1>
        </header>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
          {excludedDomains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
              <Globe className="w-8 h-8 opacity-20" />
              <span className="text-xs font-medium">No excluded domains yet</span>
            </div>
          ) : (
            excludedDomains.map(domain => (
              <div key={domain} className="glass-card flex items-center justify-between py-3">
                <span className="text-xs font-medium text-slate-300 truncate max-w-[200px]">{domain}</span>
                <button 
                  onClick={() => removeExclusion(domain)}
                  className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-900 min-h-[400px] flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt="Urest"
                className="w-8 h-8"
                style={{
                  filter: handshakeActive ? 'drop-shadow(0 0 8px rgba(107,142,247,0.65))' : 'none'
                }}
              />
            ) : (
              <MousePointer2 className={`w-5 h-5 ${handshakeActive ? 'text-brand-300' : 'text-white'}`} />
            )}
          </div>
          <h1 className="font-bold text-lg tracking-tight">Urest</h1>
        </div>
        <button 
          onClick={() => setView('settings')}
          className="p-2 hover:bg-white/5 rounded-xl transition-colors relative group"
        >
          <List className="w-5 h-5 text-slate-400 group-hover:text-white" />
          {excludedDomains.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full border border-slate-900" />
          )}
        </button>
      </header>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Global Configuration</label>
        <div className="glass-card flex items-center justify-between group hover:border-brand-500/30">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isEnabled ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-500'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-100">Master Switch</span>
              <span className="text-[10px] text-slate-500">{isEnabled ? "Active everywhere" : "Paused globally"}</span>
            </div>
          </div>
          <button 
            onClick={toggleGlobal}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none ${isEnabled ? 'bg-brand-500 shadow-[0_0_18px_rgba(107,142,247,0.45)]' : 'bg-slate-700'}`}
          >
            <span className={`${isEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Presence</label>
        <div className="glass-card flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-100">Blocks Neutralized</span>
            <span className="text-[10px] text-slate-500">Local only</span>
          </div>
          <span className="text-xl font-bold text-brand-400">{blocksNeutralized.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Current Site</label>
        <div className={`glass-card flex flex-col gap-4 ${isSystemPage ? 'opacity-50 select-none' : 'hover:border-brand-500/30'}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl bg-slate-800 ${isExcluded ? 'text-amber-400' : 'text-brand-400'}`}>
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-100 truncate">{currentHost}</span>
              <span className="text-[10px] text-slate-500">
                {isExcluded ? "Disabled for this site" : isEnabled ? "Surgery active" : "Surgery paused"}
              </span>
              {!isSystemPage && (
                <span className={`text-[10px] ${handshakeActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {handshakeActive ? 'Handshake confirmed' : 'Handshake pending'}
                </span>
              )}
            </div>
          </div>

          {!isSystemPage && (
            <button 
              onClick={toggleExclusion}
              disabled={!isEnabled}
              className={`w-full text-xs font-bold py-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                !isEnabled ? 'bg-slate-800 text-slate-600 border-white/5 cursor-not-allowed' :
                isExcluded ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' : 
                'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isExcluded ? (
                <><ShieldCheck className="w-4 h-4" /> Re-enable on this Site</>
              ) : (
                <><ShieldAlert className="w-4 h-4 text-amber-400" /> Disable on this Site</>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Utilities</label>
        <button
          onClick={openVerificationPage}
          className="glass-card w-full flex items-center justify-between hover:border-brand-500/30 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-brand-400">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-100">Open Verification Page</span>
              <span className="text-[10px] text-slate-500">Test URest on our first-party demo page</span>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <footer className="mt-auto pt-4 flex items-center justify-center gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        <a 
          href="https://github.com/aankda/urest/issues" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-brand-400 transition-colors"
        >
          Feedback
        </a>
        <span className="text-slate-800">•</span>
        <a 
          href="https://aankda.github.io/urest/privacy.html" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-brand-400 transition-colors"
        >
          Privacy
        </a>
        <span className="text-slate-800">•</span>
        <span className="text-[10px] text-slate-500">v1.0.1</span>
      </footer>
    </div>
  );
};

export default App;
