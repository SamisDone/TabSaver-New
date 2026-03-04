/* ================================================================
   TABSAVER - ENHANCED BACKGROUND SERVICE WORKER
   ================================================================
   
   Background features:
   - Auto-save with configurable intervals
   - Context menu integration (right-click to save)
   - Badge counter showing session count
   - Keyboard shortcuts (Ctrl+Shift+S)
   - Storage limit monitoring
   - Message handling for popup communication
   
   Author: Samonwita
   Enhanced: 2025
   ================================================================ */

// ================================================================
// CONSTANTS
// ================================================================

const ALARM_AUTOSAVE = 'autoSaveAlarm';
const ALARM_LIVESYNC = 'liveSyncAlarm';
const DEFAULT_SETTINGS = {
  autoSave: false,
  autoSaveInterval: 30,
  duplicateDetection: true,
  liveSync: false,
  liveSyncInterval: 30
};

// ================================================================
// INITIALIZATION HELPERS
// ================================================================

async function initializeExtension() {
  try {
    console.log('Initializing TabSaver...');

    if (!chrome?.storage?.local) {
      console.warn('Storage API not available yet');
      return;
    }

    // Ensure storage is ready
    const result = await chrome.storage.local.get(['sessions', 'tabSaverSettings']);

    if (!result?.sessions) {
      await chrome.storage.local.set({ sessions: [] });
    }

    if (!result?.tabSaverSettings) {
      await chrome.storage.local.set({ tabSaverSettings: DEFAULT_SETTINGS });
    }

    // Setup Context Menu
    await createContextMenu();

    // Setup Alarms
    const settings = result?.tabSaverSettings || DEFAULT_SETTINGS;
    await setupAlarms(settings);

    // Update Badge
    await updateBadge();

    console.log('TabSaver initialization complete.');
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// ================================================================
// INSTALLATION & STARTUP HANDLERS
// ================================================================

// Use persistent registration to ensure service worker stability
if (typeof chrome !== 'undefined') {
  // 1. Installation & Startup
  chrome.runtime?.onInstalled?.addListener(async (details) => {
    console.log('Extension installed/updated:', details.reason);
    await initializeExtension();
  });

  chrome.runtime?.onStartup?.addListener(async () => {
    console.log('Browser startup - initializing extension');
    await initializeExtension();
  });

  // 2. Context Menu Actions
  chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
    if (!info || !tab) return;
    switch (info.menuItemId) {
      case 'saveToTabSaver':
        await saveAllTabs();
        break;
      case 'saveThisTab':
        await saveCurrentTab(tab);
        break;
      case 'openTabSaver':
        if (chrome.action?.openPopup) {
           await chrome.action.openPopup();
        }
        break;
    }
  });

  // 3. Keyboard Shortcut Commands
  chrome.commands?.onCommand?.addListener(async (command) => {
    if (!command) return;
    console.log('Command received:', command);
    switch (command) {
      case 'save-tabs':
        await saveAllTabs();
        break;
      case 'open-popup':
        if (chrome.action?.openPopup) {
          await chrome.action.openPopup();
        }
        break;
    }
  });

  // 4. Alarms handlers
  chrome.alarms?.onAlarm?.addListener(async (alarm) => {
    if (alarm?.name === ALARM_AUTOSAVE) {
      console.log('Auto-save alarm triggered');
      await createAutoSaveSession();
    } else if (alarm?.name === ALARM_LIVESYNC) {
      console.log('Live Sync alarm triggered');
      await syncSessions();
    }
  });

  // 5. Message Handling
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (!request) return;
    handleMessage(request, sender)
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error('Message handling error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  });

  // 6. Storage Change Listeners
  chrome.storage?.onChanged?.addListener(async (changes, areaName) => {
    try {
      if (changes?.sessions) {
        const newSessions = changes.sessions.newValue || [];
        await updateBadge(newSessions.length);
      }
      if (changes?.tabSaverSettings) {
        const newSettings = changes.tabSaverSettings.newValue;
        if (newSettings) {
          await setupAlarms(newSettings);
        }
      }
    } catch (error) {
      console.log('Storage change handler skipped:', error.message);
    }
  });
} else {
  console.error('CRITICAL: chrome object is totally undefined in background.js');
}

// ================================================================
// CONTEXT MENU
// ================================================================

async function createContextMenu() {
  // Remove existing menu items first
  await chrome.contextMenus.removeAll();
  
  // Create "Save to TabSaver" menu item
  chrome.contextMenus.create({
    id: 'saveToTabSaver',
    title: 'Save all tabs to TabSaver',
    contexts: ['page', 'action']
  });
  
  chrome.contextMenus.create({
    id: 'saveThisTab',
    title: 'Add this tab to new session',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'separator1',
    type: 'separator',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: 'openTabSaver',
    title: 'Open TabSaver',
    contexts: ['action']
  });
  
  console.log('Context menu created');
}

// Handle context menu clicks (Moved to top-level safe block)

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================

// Commands (Moved to top-level safe block)

// ================================================================
// AUTO-SAVE FUNCTIONALITY
// ================================================================

// Handle alarm events (Moved to top-level safe block)

async function setupAlarms(settings) {
  // 1. Handle Auto-save Alarm
  await chrome.alarms.clear(ALARM_AUTOSAVE);
  if (settings.autoSave && settings.autoSaveInterval > 0) {
    chrome.alarms.create(ALARM_AUTOSAVE, {
      periodInMinutes: settings.autoSaveInterval
    });
    console.log(`Auto-save alarm set: every ${settings.autoSaveInterval} mins`);
  }

  // 2. Handle Live Sync Alarm
  await chrome.alarms.clear(ALARM_LIVESYNC);
  if (settings.liveSync && settings.liveSyncInterval > 0) {
    chrome.alarms.create(ALARM_LIVESYNC, {
      periodInMinutes: settings.liveSyncInterval
    });
    console.log(`Live Sync alarm set: every ${settings.liveSyncInterval} mins`);
  }
}

/**
 * Shared helper to capture current state
 */
async function getCurrentWindowState() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (tabs.length === 0) return null;

  const tabData = tabs.map(tab => ({
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl || '',
    groupId: tab.groupId || -1
  }));

  let tabGroups = {};
  try {
    const groups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
    groups.forEach((group) => {
      tabGroups[group.id] = { title: group.title, color: group.color };
    });
  } catch (e) {}

  let screenshot = null;
  try {
    screenshot = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 40 });
  } catch (e) {}

  return { tabData, tabGroups, screenshot };
}

async function createAutoSaveSession() {
  try {
    const settings = await getSettings();
    if (!settings.autoSave) return;

    const state = await getCurrentWindowState();
    if (!state) return;

    const { tabData, tabGroups, screenshot } = state;
    const now = new Date();
    const sessionName = `Auto-save ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    const newSession = {
      name: sessionName,
      tabs: tabData,
      tabGroups: tabGroups,
      timestamp: Date.now(),
      tabCount: tabData.length,
      tags: ["auto"],
      isAutoSave: true,
      screenshot: screenshot,
    };

    const storage = chrome.storage.local;
    const result = await storage.get(['sessions']);
    const sessions = result.sessions || [];

    // Limit auto-saves
    const autoSaves = sessions.filter(s => s.isAutoSave);
    if (autoSaves.length >= 5) {
      const oldestAutoSave = autoSaves.sort((a, b) => a.timestamp - b.timestamp)[0];
      const index = sessions.findIndex(s => s.timestamp === oldestAutoSave.timestamp);
      if (index !== -1) sessions.splice(index, 1);
    }

    sessions.push(newSession);
    await storage.set({ sessions });
    await updateBadge();
    console.log('Auto-save session created:', sessionName);
  } catch (error) {
    console.error('Auto-save error:', error);
  }
}

async function syncSessions() {
  try {
    const settings = await getSettings();
    if (!settings.liveSync) return;

    const state = await getCurrentWindowState();
    if (!state) return;

    const { tabData, tabGroups, screenshot } = state;
    const storage = chrome.storage.local;
    const result = await storage.get(['sessions']);
    const sessions = result.sessions || [];

    let syncUpdated = false;
    for (const session of sessions) {
      if (session.autoSync) {
        session.tabs = tabData;
        session.tabGroups = tabGroups;
        session.tabCount = tabData.length;
        session.timestamp = Date.now();
        session.screenshot = screenshot;
        syncUpdated = true;
      }
    }

    if (syncUpdated) {
      await storage.set({ sessions });
      console.log('Live Sync sessions updated');
    }
  } catch (error) {
    console.error('Live Sync error:', error);
  }
}

// ================================================================
// SAVE FUNCTIONS
// ================================================================

async function saveAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    if (tabs.length === 0) {
      console.log('No tabs to save');
      return;
    }
    
    // Get tab groups if available
    let tabGroups = {};
    try {
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      groups.forEach(group => {
        tabGroups[group.id] = { title: group.title, color: group.color };
      });
    } catch (e) {
      // Tab groups API might not be available
    }
    
    const tabData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl || '',
      groupId: tab.groupId || -1
    }));
    
    const now = new Date();
    const sessionName = `Quick Save ${now.toLocaleString()}`;
    
    // Feature: Visual Layouts
    let screenshot = null;
    try {
      screenshot = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 50 });
    } catch (e) {}

    const newSession = {
      name: sessionName,
      tabs: tabData,
      tabGroups: tabGroups,
      timestamp: Date.now(),
      tabCount: tabData.length,
      tags: [],
      screenshot: screenshot
    };
    
    // Get settings to determine storage type
    const storage = chrome.storage.local;
    const result = await storage.get(['sessions']);
    const sessions = result.sessions || [];
    
    sessions.push(newSession);
    await storage.set({ sessions });
    
    // Update badge
    await updateBadge();
    
    // Show notification
    await showNotification('Session Saved', `Saved ${tabData.length} tabs as "${sessionName}"`);
    
    console.log('Quick save completed:', sessionName);
  } catch (error) {
    console.error('Save error:', error);
  }
}

async function saveCurrentTab(tab) {
  try {
    const tabData = {
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl || '',
      groupId: -1
    };
    
    const now = new Date();
    const sessionName = `Single Tab ${now.toLocaleString()}`;
    
    // Feature: Visual Layouts
    let screenshot = null;
    try {
      screenshot = await chrome.tabs.captureVisibleTab(null, {
        format: "jpeg",
        quality: 60,
      });
    } catch (e) {
      console.warn("Single tab save screenshot failed:", e);
    }

    const newSession = {
      name: sessionName,
      tabs: [tabData],
      timestamp: Date.now(),
      tabCount: 1,
      tags: [],
      screenshot: screenshot
    };
    
    const storage = chrome.storage.local;
    const result = await storage.get(['sessions']);
    const sessions = result.sessions || [];
    
    sessions.push(newSession);
    await storage.set({ sessions });
    
    await updateBadge();
    
    console.log('Single tab saved:', tab.title);
  } catch (error) {
    console.error('Save tab error:', error);
  }
}

// ================================================================
// BADGE COUNTER
// ================================================================

async function updateBadge(count) {
  try {
    if (count === undefined) {
      const settings = await getSettings();
      const storage = chrome.storage.local;
      const result = await storage.get(['sessions']);
      count = (result.sessions || []).length;
    }
    
    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Badge update error:', error);
  }
}

// ================================================================
// NOTIFICATIONS
// ================================================================

async function showNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.png',
      title: title,
      message: message
    });
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// ================================================================
// MESSAGE HANDLING
// ================================================================

// Message Handling (Moved to top-level safe block)

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'updateBadge':
      await updateBadge(request.count);
      return { success: true };
      
    case 'settingsUpdated':
      await setupAlarms(request.settings);
      return { success: true };
      
    case 'saveTabs':
      await saveAllTabs();
      return { success: true };
      
    case 'getStorageUsage':
      return await getStorageUsage();
      
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

async function getSettings() {
  try {
    const result = await chrome.storage.local.get(['tabSaverSettings']);
    return result.tabSaverSettings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Get settings error:', error);
    return DEFAULT_SETTINGS;
  }
}

async function getStorageUsage() {
  try {
    const storage = chrome.storage.local;
    
    return new Promise((resolve) => {
      storage.getBytesInUse(null, (bytesInUse) => {
        const maxBytes = 5242880;
        resolve({
          success: true,
          bytesInUse,
          maxBytes,
          percent: Math.round((bytesInUse / maxBytes) * 100)
        });
      });
    });
  } catch (error) {
    console.error('Storage usage error:', error);
    return { success: false, error: error.message };
  }
}

// Note: Initialization is handled by onInstalled and onStartup at the top level.

// ================================================================
// STORAGE CHANGE LISTENER
// ================================================================

// Storage change listener (Moved to top-level safe block)

// ================================================================
// INITIAL SETUP
// ================================================================

// Note: Initialization is handled by onInstalled (for new installs/updates)
// and onStartup (for browser restarts). No IIFE needed.
console.log('TabSaver background script loaded');
