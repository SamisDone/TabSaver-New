/* ================================================================
   TABSAVER - ENHANCED JAVASCRIPT
   ================================================================
   
   Complete feature set including:
   - Export/Import sessions (JSON)
   - Search & filter sessions
   - Session preview with selective tab opening
   - Tab Groups support
   - Duplicate detection
   - Undo delete with toast
   - Drag & drop reordering
   - Session tags/categories
   - Favicon display
   - Keyboard shortcuts
   - Storage limit warnings
   
   Author: Samonwita
   Enhanced: 2025
   ================================================================ */

// ================================================================
// GLOBAL STATE
// ================================================================

let sessions = [];
let filteredSessions = [];
let currentRenameTimestamp = null;
let currentTagTimestamp = null;
let deletedSession = null;
let undoTimeoutId = null;
let draggedElement = null;
let settings = {
  autoSave: false,
  autoSaveInterval: 30,
  duplicateDetection: true,
  liveSync: false,
  liveSyncInterval: 30,
};

// Available tags with their display names
const AVAILABLE_TAGS = {
  work: "Work",
  personal: "Personal",
  research: "Research",
  shopping: "Shopping",
  social: "Social",
  entertainment: "Entertainment",
};

// ================================================================
// INITIALIZATION
// ================================================================

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadSessions();
  initializeEventListeners();
  initializeDarkMode();
  checkStorageUsage();
  checkForDuplicates(); // Check on initial load
});

// ================================================================
// EVENT LISTENERS
// ================================================================

function initializeEventListeners() {
  // Save button
  document
    .getElementById("saveTabsBtn")
    .addEventListener("click", saveCurrentTabs);

  // Session name input - Enter key
  document
    .getElementById("sessionNameInput")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") saveCurrentTabs();
    });

  // Session name input - check for duplicates on input
  document
    .getElementById("sessionNameInput")
    .addEventListener("input", debounce(checkForDuplicates, 300));

  // Dark mode toggle
  document
    .getElementById("darkModeToggle")
    .addEventListener("click", toggleDarkMode);

  // Search
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);

  // Export/Import
  document
    .getElementById("exportBtn")
    .addEventListener("click", exportSessions);
  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });
  document
    .getElementById("importFileInput")
    .addEventListener("change", importSessions);

  // Cleanup
  document
    .getElementById("cleanupBtn")
    .addEventListener("click", cleanupDuplicates);

  // Settings
  document
    .getElementById("settingsBtn")
    .addEventListener("click", openSettingsModal);
  document
    .getElementById("closeSettingsBtn")
    .addEventListener("click", closeSettingsModal);
  document
    .getElementById("autoSaveToggle")
    .addEventListener("change", handleAutoSaveToggle);
  document
    .getElementById("autoSaveInterval")
    .addEventListener("change", handleAutoSaveIntervalChange);
  document
    .getElementById("duplicateDetectionToggle")
    .addEventListener("change", handleDuplicateDetectionToggle);
  document
    .getElementById("liveSyncToggle")
    .addEventListener("change", handleLiveSyncToggle);
  document
    .getElementById("liveSyncInterval")
    .addEventListener("change", handleLiveSyncIntervalChange);

  // Rename modal
  document
    .getElementById("cancelRenameBtn")
    .addEventListener("click", closeRenameModal);
  document
    .getElementById("confirmRenameBtn")
    .addEventListener("click", confirmRename);
  document.getElementById("renameInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") confirmRename();
  });
  document.getElementById("renameModal").addEventListener("click", (e) => {
    if (e.target.id === "renameModal") closeRenameModal();
  });

  // Tag modal
  document
    .getElementById("cancelTagBtn")
    .addEventListener("click", closeTagModal);
  document.getElementById("tagModal").addEventListener("click", (e) => {
    if (e.target.id === "tagModal") closeTagModal();
  });
  document.querySelectorAll(".tag-option").forEach((btn) => {
    btn.addEventListener("click", () => addTagToSession(btn.dataset.tag));
  });

  // Settings modal background click
  document.getElementById("settingsModal").addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") closeSettingsModal();
  });

  // Confirm modal
  document
    .getElementById("confirmModalCancel")
    .addEventListener("click", closeConfirmModal);
  document.getElementById("confirmModal").addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirmModal();
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcuts);

  // Global click listener for delegation
  document.addEventListener("click", (e) => {
    // Tag removal
    if (e.target.closest(".tag-remove")) {
      e.stopPropagation();
      const btn = e.target.closest(".tag-remove");
      removeTag(parseInt(btn.dataset.timestamp), btn.dataset.tag);
    }
  });
}

// ================================================================
// DARK MODE
// ================================================================

function initializeDarkMode() {
  chrome.storage.local.get(["darkMode"], (result) => {
    const isDark = result.darkMode || false;
    if (isDark) {
      document.documentElement.classList.add("dark");
      updateDarkModeIcon(true);
    }
  });
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle("dark");
  chrome.storage.local.set({ darkMode: isDark });
  updateDarkModeIcon(isDark);
}

function updateDarkModeIcon(isDark) {
  const sunIcon = document.getElementById("sunIcon");
  const moonIcon = document.getElementById("moonIcon");

  if (isDark) {
    sunIcon.classList.remove("hidden");
    moonIcon.classList.add("hidden");
  } else {
    sunIcon.classList.add("hidden");
    moonIcon.classList.remove("hidden");
  }
}

// ================================================================
// SETTINGS
// ================================================================

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(["tabSaverSettings"]);
    if (result.tabSaverSettings) {
      settings = { ...settings, ...result.tabSaverSettings };
    }
    applySettings();
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

function applySettings() {
  document.getElementById("autoSaveToggle").checked = settings.autoSave;
  document.getElementById("autoSaveInterval").value = settings.autoSaveInterval;
  document.getElementById("liveSyncInterval").value = settings.liveSyncInterval || 30;
  document.getElementById("duplicateDetectionToggle").checked =
    settings.duplicateDetection;
  document.getElementById("liveSyncToggle").checked = settings.liveSync || false;

  // Show/hide interval row based on auto-save
  document.getElementById("autoSaveIntervalRow").style.display =
    settings.autoSave ? "flex" : "none";
  document.getElementById("liveSyncIntervalRow").style.display =
    settings.liveSync ? "flex" : "none";
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ tabSaverSettings: settings });
    // Notify background script of settings change
    chrome.runtime.sendMessage({ action: "settingsUpdated", settings });
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

function openSettingsModal() {
  document.getElementById("settingsModal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.add("hidden");
}

function handleAutoSaveToggle(e) {
  settings.autoSave = e.target.checked;
  document.getElementById("autoSaveIntervalRow").style.display =
    settings.autoSave ? "flex" : "none";
  saveSettings();
}

function handleAutoSaveIntervalChange(e) {
  settings.autoSaveInterval = parseInt(e.target.value);
  saveSettings();
}


function handleDuplicateDetectionToggle(e) {
  settings.duplicateDetection = e.target.checked;
  saveSettings();

  if (!settings.duplicateDetection) {
    document.getElementById("duplicateWarning").classList.add("hidden");
  }
}

function handleLiveSyncToggle(e) {
  settings.liveSync = e.target.checked;
  document.getElementById("liveSyncIntervalRow").style.display =
    settings.liveSync ? "flex" : "none";
  saveSettings();
}

function handleLiveSyncIntervalChange(e) {
  settings.liveSyncInterval = parseInt(e.target.value);
  saveSettings();
}

// ================================================================
// STORAGE HELPERS
// ================================================================

function getStorage() {
  return chrome.storage.local;
}

async function loadSessions() {
  try {
    const result = await getStorage().get(["sessions"]);
    sessions = result.sessions || [];
    filteredSessions = [...sessions];
    renderSessions();
    updateSessionCount();
  } catch (error) {
    console.error("Error loading sessions:", error);
  }
}

async function saveSessions() {
  try {
    await getStorage().set({ sessions: sessions });
    // Update badge
    chrome.runtime.sendMessage({
      action: "updateBadge",
      count: sessions.length,
    });
  } catch (error) {
    console.error("Error saving sessions:", error);
    showToast("Error saving sessions", "error");
  }
}

// ================================================================
// SAVE CURRENT TABS
// ================================================================

async function saveCurrentTabs() {
  const sessionNameInput = document.getElementById("sessionNameInput");
  let sessionName = sessionNameInput.value.trim();

  if (!sessionName) {
    const timestamp = new Date().toLocaleString();
    sessionName = `Session ${timestamp}`;
  }

  try {
    // Feature: Visual Layouts (Capture screenshot of active tab)
    let screenshot = null;
    try {
      // captureVisibleTab works for the active tab in the current window
      screenshot = await chrome.tabs.captureVisibleTab(null, {
        format: "jpeg",
        quality: 50,
      });
    } catch (e) {
      console.warn("Could not capture screenshot:", e);
    }

    // Get all tabs in current window
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Get tab group info if available
    let tabGroups = {};
    try {
      const groups = await chrome.tabGroups.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      });
      groups.forEach((group) => {
        tabGroups[group.id] = { title: group.title, color: group.color };
      });
    } catch (e) {
      // Tab groups API might not be available in all Chrome versions
    }

    // Extract tab data with favicon and group info
    const tabData = tabs.map((tab) => ({
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl || "",
      groupId: tab.groupId || -1,
    }));

    const newSession = {
      name: sessionName,
      tabs: tabData,
      tabGroups: tabGroups,
      timestamp: Date.now(),
      tabCount: tabData.length,
      tags: [],
      screenshot: screenshot, // Save the visual layout
    };

    sessions.push(newSession);
    await saveSessions();

    sessionNameInput.value = "";
    document.getElementById("duplicateWarning").classList.add("hidden");

    filteredSessions = [...sessions];
    renderSessions();
    updateSessionCount();

    showToast("Session saved successfully!", "success");
  } catch (error) {
    console.error("Error saving tabs:", error);
    showToast("Error saving session", "error");
  }
}

async function addCurrentTabsToSession(timestamp) {
  try {
    // Get all tabs in current window
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    
    // Get tab group info if available
    let tabGroups = {};
    try {
      const groups = await chrome.tabGroups.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      });
      groups.forEach((group) => {
        tabGroups[group.id] = { title: group.title, color: group.color };
      });
    } catch (e) {}

    const index = sessions.findIndex((s) => s.timestamp === timestamp);
    if (index === -1) {
      showToast("Session not found", "error");
      return;
    }

    const session = sessions[index];
    const existingUrls = new Set(session.tabs.map(t => t.url));
    let tabsAdded = 0;

    currentTabs.forEach(tab => {
      if (!existingUrls.has(tab.url)) {
        session.tabs.push({
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl || "",
          groupId: tab.groupId || -1,
        });
        existingUrls.add(tab.url);
        tabsAdded++;
      }
    });

    if (tabsAdded === 0) {
      showToast("All current tabs are already in this session", "info");
      return;
    }

    // Update session metadata
    session.tabCount = session.tabs.length;
    
    // Merge tab groups
    session.tabGroups = { ...session.tabGroups, ...tabGroups };

    // Update screenshot (optional but good for visual consistency)
    try {
      const screenshot = await chrome.tabs.captureVisibleTab(null, {
        format: "jpeg",
        quality: 50,
      });
      session.screenshot = screenshot;
    } catch (e) {
      console.warn("Could not update screenshot:", e);
    }

    await saveSessions();
    filteredSessions = [...sessions];
    renderSessions();
    showToast(`Added ${tabsAdded} new tab${tabsAdded !== 1 ? 's' : ''} to session`, "success");
  } catch (error) {
    console.error("Error adding tabs to session:", error);
    showToast("Error updating session", "error");
  }
}

async function toggleSessionAutoSync(timestamp) {
  const index = sessions.findIndex((s) => s.timestamp === timestamp);
  if (index === -1) return;

  sessions[index].autoSync = !sessions[index].autoSync;
  await saveSessions();
  
  filteredSessions = [...sessions];
  renderSessions();
  
  const status = sessions[index].autoSync ? "enabled" : "disabled";
  showToast(`Live Sync ${status}`, "success");
}

// ================================================================
// DUPLICATE DETECTION
// ================================================================

async function checkForDuplicates() {
  if (!settings.duplicateDetection || sessions.length === 0) return;

  const warningEl = document.getElementById("duplicateWarning");
  const warningText = document.getElementById("duplicateWarningText");

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    // Filter out common internal/empty pages to get better similarity
    const filteredTabs = tabs.filter(
      (t) => t.url && !t.url.startsWith("chrome://") && t.url !== "about:blank"
    );

    if (filteredTabs.length === 0) {
      warningEl.classList.add("hidden");
      return;
    }

    const currentUrls = new Set(filteredTabs.map((t) => t.url));

    let mostSimilar = null;
    let highestSimilarity = 0;

    for (const session of sessions) {
      const sessionFilteredTabs = session.tabs.filter(
        (t) =>
          t.url && !t.url.startsWith("chrome://") && t.url !== "about:blank"
      );
      if (sessionFilteredTabs.length === 0) continue;

      const sessionUrls = new Set(sessionFilteredTabs.map((t) => t.url));
      const intersection = [...currentUrls].filter((url) =>
        sessionUrls.has(url)
      );
      const similarity =
        intersection.length / Math.max(currentUrls.size, sessionUrls.size);

      if (similarity > highestSimilarity && similarity >= 0.6) {
        highestSimilarity = similarity;
        mostSimilar = session;
      }
    }

    if (mostSimilar) {
      const percent = Math.round(highestSimilarity * 100);
      warningText.textContent = `"${mostSimilar.name}" is ${percent}% similar`;
      warningEl.classList.remove("hidden");
    } else {
      warningEl.classList.add("hidden");
    }
  } catch (error) {
    console.error("Error checking duplicates:", error);
  }
}

// ================================================================
// CLEANUP DUPLICATES
// ================================================================

async function cleanupDuplicates() {
  try {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map(); // url -> Array of tabIds
    const duplicates = [];

    tabs.forEach((tab) => {
      // Skip internal pages if desired, or treat them normally
      if (!tab.url) return;
      
      if (urlMap.has(tab.url)) {
        urlMap.get(tab.url).push(tab.id);
      } else {
        urlMap.set(tab.url, [tab.id]);
      }
    });

    urlMap.forEach((ids) => {
      if (ids.length > 1) {
        // Keep the first one, close the rest
        duplicates.push(...ids.slice(1));
      }
    });

    if (duplicates.length > 0) {
      await chrome.tabs.remove(duplicates);
      showToast(`Closed ${duplicates.length} duplicate tab${duplicates.length !== 1 ? 's' : ''}`, "success");
    } else {
      showToast("No duplicate tabs found", "info");
    }
  } catch (error) {
    console.error("Cleanup error:", error);
    showToast("Error during cleanup", "error");
  }
}

// ================================================================
// RENDER SESSIONS
// ================================================================

function renderSessions() {
  const sessionsList = document.getElementById("sessionsList");
  const emptyState = document.getElementById("emptyState");

  // Keep empty state and other non-card elements
  const children = Array.from(sessionsList.children);
  children.forEach(child => {
    if (child.classList.contains('session-card')) {
      child.remove();
    }
  });

  if (filteredSessions.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  // Render in reverse order (newest first)
  filteredSessions
    .slice()
    .reverse()
    .forEach((session) => {
      const card = createSessionCard(session);
      sessionsList.insertBefore(card, emptyState);
    });
}

function updateSessionCount() {
  document.getElementById("sessionCount").textContent = sessions.length;
}

// ================================================================
// CREATE SESSION CARD
// ================================================================

function createSessionCard(session) {
  const card = document.createElement("div");
  card.className = "session-card";
  card.dataset.timestamp = session.timestamp;
  card.draggable = true;

  // Drag events
  card.addEventListener("dragstart", handleDragStart);
  card.addEventListener("dragend", handleDragEnd);
  card.addEventListener("dragover", handleDragOver);
  card.addEventListener("drop", handleDrop);
  card.addEventListener("dragleave", handleDragLeave);

  // Build card HTML
  card.innerHTML = `
    <div class="session-card-header">
      <!-- Drag Handle -->
      <div class="drag-handle" title="Drag to reorder">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
        </svg>
      </div>
      
      <div class="session-content">
        <div class="session-info">
          <div class="session-name-row">
            <h3 class="session-name" title="${escapeHtml(
              session.name
            )}">${escapeHtml(session.name)}</h3>
            ${renderFavicons(session.tabs)}
          </div>
          <div class="session-meta">
            <span class="tab-badge">${session.tabCount} tab${
    session.tabCount !== 1 ? "s" : ""
  }</span>
            <span>${formatTimestamp(session.timestamp)}</span>
          </div>
          ${renderTags(session)}
        </div>
        
        ${
          session.screenshot
            ? `
          <div class="session-thumbnail-wrapper">
            <img src="${session.screenshot}" class="session-hero-image" alt="Session preview">
          </div>
        `
            : ""
        }
        
        <div class="session-actions">
          <!-- Expand/Preview Button -->
          <button class="action-btn expand-btn" title="Preview tabs" data-timestamp="${
            session.timestamp
          }">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          <!-- Open Button -->
          <button class="action-btn always-visible" title="Open all tabs" data-timestamp="${
            session.timestamp
          }">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </button>
          
          <!-- Live Sync Toggle -->
          <button class="action-btn sync-btn ${session.autoSync ? 'active' : ''}" title="${session.autoSync ? 'Disable Live Sync' : 'Enable Live Sync'}" data-timestamp="${
            session.timestamp
          }" data-action="sync">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>

          <!-- Add Tabs Button -->
          <button class="action-btn" title="Add current tabs to this session" data-timestamp="${
            session.timestamp
          }" data-action="add-tabs">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>
          
          <!-- Tag Button -->
          <button class="action-btn" title="Add tag" data-timestamp="${
            session.timestamp
          }" data-action="tag">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
          </button>
          
          <!-- Rename Button -->
          <button class="action-btn" title="Rename session" data-timestamp="${
            session.timestamp
          }" data-action="rename">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          
          <!-- Delete Button -->
          <button class="action-btn delete" title="Delete session" data-timestamp="${
            session.timestamp
          }" data-action="delete">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Expandable Preview -->
    <div class="session-preview" id="preview-${session.timestamp}">
      <div class="session-preview-content">
        <div class="preview-header">
          <span class="preview-title">Select tabs to open</span>
          <div class="preview-actions">
            <button class="btn btn-ghost btn-sm select-all-btn" data-timestamp="${
              session.timestamp
            }">Select All</button>
          </div>
        </div>
        <div class="tabs-list">
          ${session.tabs
            .map(
              (tab, i) => `
            <label class="tab-item">
              <input type="checkbox" checked data-tab-index="${i}">
              <img class="tab-favicon" src="${
                tab.favIconUrl ||
                "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%239ca3af%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>"
              }" 
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%239ca3af%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>'">
              <span class="tab-title" title="${escapeHtml(
                tab.title
              )}">${escapeHtml(tab.title)}</span>
              <span class="tab-url">${getDomain(tab.url)}</span>
            </label>
          `
            )
            .join("")}
        </div>
        <button class="btn btn-primary btn-sm open-selected-btn" data-timestamp="${
          session.timestamp
        }">
          Open Selected Tabs
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  attachCardEventListeners(card, session);

  return card;
}

function attachCardEventListeners(card, session) {
  const timestamp = session.timestamp;

  // Expand button
  card.querySelector(".expand-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    togglePreview(timestamp);
  });

  // Open all button
  card
    .querySelector(".action-btn.always-visible")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      openSessionByTimestamp(timestamp);
    });

  // Tag button
  card.querySelector('[data-action="tag"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openTagModal(timestamp);
  });

  // Add tabs button
  card.querySelector('[data-action="add-tabs"]').addEventListener("click", (e) => {
    e.stopPropagation();
    addCurrentTabsToSession(timestamp);
  });

  // Sync button
  card.querySelector('[data-action="sync"]').addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSessionAutoSync(timestamp);
  });

  // Rename button
  card
    .querySelector('[data-action="rename"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameModalByTimestamp(timestamp);
    });

  // Delete button
  card
    .querySelector('[data-action="delete"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSessionByTimestamp(timestamp);
    });

  // Select all button
  const selectAllBtn = card.querySelector(".select-all-btn");
  selectAllBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const preview = document.getElementById(`preview-${timestamp}`);
    const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
    const allChecked = [...checkboxes].every((cb) => cb.checked);
    checkboxes.forEach((cb) => (cb.checked = !allChecked));
    selectAllBtn.textContent = allChecked ? "Select All" : "Deselect All";
  });

  // Checkbox listeners to update "Select All" text
  card.querySelectorAll('.tab-item input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const preview = document.getElementById(`preview-${timestamp}`);
      const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
      const allChecked = [...checkboxes].every((c) => c.checked);
      selectAllBtn.textContent = allChecked ? "Deselect All" : "Select All";
    });
  });

  // Open selected button
  card.querySelector(".open-selected-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openSelectedTabs(timestamp);
  });

  // Card click - toggle preview
  card.addEventListener("click", (e) => {
    if (
      e.target.closest(".session-actions") ||
      e.target.closest(".session-preview")
    )
      return;
    togglePreview(timestamp);
  });
}

// ================================================================
// HELPER RENDER FUNCTIONS
// ================================================================

function renderFavicons(tabs) {
  const maxFavicons = 4;
  const favicons = tabs.slice(0, maxFavicons).filter((t) => t.favIconUrl);
  const remaining = tabs.length - maxFavicons;

  if (favicons.length === 0) return "";

  let html = '<div class="session-favicons">';
  favicons.forEach((tab) => {
    html += `<img class="favicon" src="${tab.favIconUrl}" 
             onerror="this.style.display='none'" 
             title="${escapeHtml(tab.title)}">`;
  });
  if (remaining > 0) {
    html += `<span class="favicon-more">+${remaining}</span>`;
  }
  html += "</div>";
  return html;
}

function renderTags(session) {
  if (!session.tags || session.tags.length === 0) return "";

  let html = '<div class="session-tags">';
  session.tags.forEach((tag) => {
    html += `<span class="tag tag-${tag}" data-tag="${tag}">
      ${AVAILABLE_TAGS[tag]}
      <span class="tag-remove" data-timestamp="${session.timestamp}" data-tag="${tag}">×</span>
    </span>`;
  });
  html += "</div>";
  return html;
}

// ================================================================
// PREVIEW / EXPAND
// ================================================================

function togglePreview(timestamp) {
  const preview = document.getElementById(`preview-${timestamp}`);
  const expandBtn = document.querySelector(
    `.expand-btn[data-timestamp="${timestamp}"]`
  );

  if (preview && expandBtn) {
    preview.classList.toggle("expanded");
    expandBtn.classList.toggle("expanded");
  }
}

// ================================================================
// OPEN SESSION
// ================================================================

async function openSessionByTimestamp(timestamp) {
  const session = sessions.find((s) => s.timestamp === timestamp);
  if (!session) {
    showToast("Session not found", "error");
    return;
  }

  try {
    const createdTabs = [];
    for (const tab of session.tabs) {
      const newTab = await chrome.tabs.create({ url: tab.url, active: false });
      createdTabs.push({ id: newTab.id, groupId: tab.groupId });
    }

    // Restore Groups if metadata exists
    if (session.tabGroups && Object.keys(session.tabGroups).length > 0) {
      const groupsToCreate = {}; // originalGroupId -> [newTabId]
      createdTabs.forEach((item) => {
        if (item.groupId !== -1) {
          if (!groupsToCreate[item.groupId]) groupsToCreate[item.groupId] = [];
          groupsToCreate[item.groupId].push(item.id);
        }
      });

      for (const [origId, tabIds] of Object.entries(groupsToCreate)) {
        const groupMeta = session.tabGroups[origId];
        if (groupMeta) {
          const newGroupId = await chrome.tabs.group({ tabIds: tabIds });
          await chrome.tabGroups.update(newGroupId, {
            title: groupMeta.title,
            color: groupMeta.color,
          });
        }
      }
    }

    showToast(
      `Opened ${session.tabs.length} tab${
        session.tabs.length !== 1 ? "s" : ""
      }`,
      "success"
    );
  } catch (error) {
    console.error("Error opening session:", error);
    showToast("Error opening session", "error");
  }
}

async function openSelectedTabs(timestamp) {
  const session = sessions.find((s) => s.timestamp === timestamp);
  const preview = document.getElementById(`preview-${timestamp}`);

  if (!session || !preview) return;

  const checkboxes = preview.querySelectorAll('input[type="checkbox"]:checked');
  const selectedIndices = [...checkboxes].map((cb) =>
    parseInt(cb.dataset.tabIndex)
  );

  if (selectedIndices.length === 0) {
    showToast("No tabs selected", "error");
    return;
  }

  try {
    const createdTabs = [];
    for (const index of selectedIndices) {
      if (session.tabs[index]) {
        const newTab = await chrome.tabs.create({
          url: session.tabs[index].url,
          active: false,
        });
        createdTabs.push({
          id: newTab.id,
          groupId: session.tabs[index].groupId,
        });
      }
    }

    // Restore Groups for selected tabs
    if (session.tabGroups && Object.keys(session.tabGroups).length > 0) {
      const groupsToCreate = {};
      createdTabs.forEach((item) => {
        if (item.groupId !== -1) {
          if (!groupsToCreate[item.groupId]) groupsToCreate[item.groupId] = [];
          groupsToCreate[item.groupId].push(item.id);
        }
      });

      for (const [origId, tabIds] of Object.entries(groupsToCreate)) {
        const groupMeta = session.tabGroups[origId];
        if (groupMeta) {
          const newGroupId = await chrome.tabs.group({ tabIds: tabIds });
          await chrome.tabGroups.update(newGroupId, {
            title: groupMeta.title,
            color: groupMeta.color,
          });
        }
      }
    }

    showToast(
      `Opened ${selectedIndices.length} tab${
        selectedIndices.length !== 1 ? "s" : ""
      }`,
      "success"
    );
  } catch (error) {
    console.error("Error opening tabs:", error);
    showToast("Error opening tabs", "error");
  }
}

// ================================================================
// DELETE SESSION (with Undo)
// ================================================================

async function deleteSessionByTimestamp(timestamp) {
  const index = sessions.findIndex((s) => s.timestamp === timestamp);

  if (index === -1) {
    showToast("Session not found", "error");
    return;
  }

  // Store for undo
  deletedSession = { ...sessions[index], originalIndex: index };

  // Remove from array
  sessions.splice(index, 1);
  await saveSessions();

  filteredSessions = [...sessions];
  renderSessions();
  updateSessionCount();

  // Show undo toast
  showUndoToast(`"${deletedSession.name}" deleted`, undoDelete);
}

async function undoDelete() {
  if (!deletedSession) return;

  // Reinsert at original position
  sessions.splice(deletedSession.originalIndex, 0, {
    name: deletedSession.name,
    tabs: deletedSession.tabs,
    tabGroups: deletedSession.tabGroups,
    timestamp: deletedSession.timestamp,
    tabCount: deletedSession.tabCount,
    tags: deletedSession.tags || [],
  });

  await saveSessions();

  deletedSession = null;
  clearTimeout(undoTimeoutId);

  filteredSessions = [...sessions];
  renderSessions();
  updateSessionCount();

  showToast("Session restored", "success");
}

// ================================================================
// RENAME SESSION
// ================================================================

function openRenameModalByTimestamp(timestamp) {
  const session = sessions.find((s) => s.timestamp === timestamp);

  if (!session) {
    showToast("Session not found", "error");
    return;
  }

  currentRenameTimestamp = timestamp;

  const modal = document.getElementById("renameModal");
  const input = document.getElementById("renameInput");

  input.value = session.name;
  modal.classList.remove("hidden");

  setTimeout(() => input.focus(), 100);
}

function closeRenameModal() {
  document.getElementById("renameModal").classList.add("hidden");
  currentRenameTimestamp = null;
}

async function confirmRename() {
  if (currentRenameTimestamp === null) return;

  const newName = document.getElementById("renameInput").value.trim();

  if (!newName) {
    showToast("Please enter a name", "error");
    return;
  }

  const index = sessions.findIndex(
    (s) => s.timestamp === currentRenameTimestamp
  );

  if (index === -1) {
    showToast("Session not found", "error");
    return;
  }

  sessions[index].name = newName;
  await saveSessions();

  filteredSessions = [...sessions];
  renderSessions();

  closeRenameModal();
  showToast("Session renamed", "success");
}

// ================================================================
// TAGS
// ================================================================

function openTagModal(timestamp) {
  currentTagTimestamp = timestamp;
  document.getElementById("tagModal").classList.remove("hidden");
}

function closeTagModal() {
  document.getElementById("tagModal").classList.add("hidden");
  currentTagTimestamp = null;
}

async function addTagToSession(tagName) {
  if (currentTagTimestamp === null) return;

  const index = sessions.findIndex((s) => s.timestamp === currentTagTimestamp);

  if (index === -1) {
    showToast("Session not found", "error");
    return;
  }

  if (!sessions[index].tags) {
    sessions[index].tags = [];
  }

  if (!sessions[index].tags.includes(tagName)) {
    sessions[index].tags.push(tagName);
    await saveSessions();

    filteredSessions = [...sessions];
    renderSessions();

    showToast(`Added "${AVAILABLE_TAGS[tagName]}" tag`, "success");
  }

  closeTagModal();
}

async function removeTag(timestamp, tagName) {
  const index = sessions.findIndex((s) => s.timestamp === timestamp);

  if (index === -1) return;

  sessions[index].tags = sessions[index].tags.filter((t) => t !== tagName);
  await saveSessions();

  filteredSessions = [...sessions];
  renderSessions();
}

// ================================================================
// SEARCH
// ================================================================

function handleSearch() {
  const query = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();

  if (!query) {
    filteredSessions = [...sessions];
  } else {
    filteredSessions = sessions.filter((session) => {
      // Search in name
      if (session.name.toLowerCase().includes(query)) return true;

      // Search in tags
      if (
        session.tags &&
        session.tags.some((tag) => tag.toLowerCase().includes(query))
      )
        return true;

      // Search in tab titles
      if (session.tabs.some((tab) => tab.title.toLowerCase().includes(query)))
        return true;

      return false;
    });
  }

  renderSessions();
}

// ================================================================
// EXPORT / IMPORT
// ================================================================

function exportSessions() {
  if (sessions.length === 0) {
    showToast("No sessions to export", "error");
    return;
  }

  const exportData = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    sessions: sessions,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `tabsaver-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported ${sessions.length} sessions`, "success");
}

async function importSessions(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    let importedSessions = [];

    // Handle different formats
    if (Array.isArray(data)) {
      importedSessions = data;
    } else if (data.sessions && Array.isArray(data.sessions)) {
      importedSessions = data.sessions;
    } else {
      throw new Error("Invalid format");
    }

    // Validate sessions
    importedSessions = importedSessions.filter((session) => {
      return session.name && Array.isArray(session.tabs) && session.timestamp;
    });

    if (importedSessions.length === 0) {
      showToast("No valid sessions found in file", "error");
      return;
    }

    // Merge with existing (avoid duplicates by timestamp)
    const existingTimestamps = new Set(sessions.map((s) => s.timestamp));
    const newSessions = importedSessions.filter(
      (s) => !existingTimestamps.has(s.timestamp)
    );

    sessions = [...sessions, ...newSessions];
    await saveSessions();

    filteredSessions = [...sessions];
    renderSessions();
    updateSessionCount();

    showToast(`Imported ${newSessions.length} new sessions`, "success");
  } catch (error) {
    console.error("Import error:", error);
    showToast("Error importing file. Make sure it's a valid JSON.", "error");
  }

  // Reset file input
  event.target.value = "";
}

// ================================================================
// DRAG & DROP REORDERING
// ================================================================

function handleDragStart(e) {
  // Disable dragging during search/filter
  if (sessions.length !== filteredSessions.length) {
    e.preventDefault();
    showToast("Reordering disabled during search", "warning");
    return;
  }

  draggedElement = this;
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.timestamp);
}

function handleDragEnd() {
  this.classList.remove("dragging");
  document.querySelectorAll(".session-card").forEach((card) => {
    card.classList.remove("drag-over");
  });
  draggedElement = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  if (this !== draggedElement) {
    this.classList.add("drag-over");
  }
}

function handleDragLeave() {
  this.classList.remove("drag-over");
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");

  if (this === draggedElement) return;

  const draggedTimestamp = parseInt(e.dataTransfer.getData("text/plain"));
  const targetTimestamp = parseInt(this.dataset.timestamp);

  const draggedIndex = sessions.findIndex(
    (s) => s.timestamp === draggedTimestamp
  );
  const targetIndex = sessions.findIndex(
    (s) => s.timestamp === targetTimestamp
  );

  if (draggedIndex === -1 || targetIndex === -1) return;

  // Reorder
  const [draggedSession] = sessions.splice(draggedIndex, 1);
  sessions.splice(targetIndex, 0, draggedSession);

  await saveSessions();

  filteredSessions = [...sessions];
  renderSessions();

  showToast("Sessions reordered", "success");
}

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================

function handleKeyboardShortcuts(e) {
  // Save current tabs (Ctrl+Shift+S)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrentTabs();
  }

  // Escape to close modals
  if (e.key === "Escape") {
    closeRenameModal();
    closeTagModal();
    closeSettingsModal();
    closeConfirmModal();
  }

  // Ctrl/Cmd + F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    document.getElementById("searchInput").focus();
  }
}

// ================================================================
// STORAGE USAGE
// ================================================================

async function checkStorageUsage() {
  try {
    const storage = getStorage();

    if (storage.getBytesInUse) {
      const bytesInUse = await new Promise((resolve) => {
        storage.getBytesInUse(null, resolve);
      });

      // Local storage is about 5MB
      const maxBytes = 5242880;
      const percent = Math.round((bytesInUse / maxBytes) * 100);

      const warningEl = document.getElementById("storageWarning");
      const percentEl = document.getElementById("storagePercent");
      const progressBar = document.getElementById("storageProgressBar");

      if (percent >= 70) {
        percentEl.textContent = percent;
        progressBar.style.width = `${percent}%`;

        if (percent >= 90) {
          progressBar.className = "storage-progress-bar danger";
        } else if (percent >= 80) {
          progressBar.className = "storage-progress-bar warning";
        } else {
          progressBar.className = "storage-progress-bar";
        }

        warningEl.classList.remove("hidden");
      } else {
        warningEl.classList.add("hidden");
      }
    }
  } catch (error) {
    console.error("Error checking storage:", error);
  }
}

// ================================================================
// TOAST NOTIFICATIONS
// ================================================================

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon =
    type === "success"
      ? `<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
       </svg>`
      : type === "error"
      ? `<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
       </svg>`
      : `<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
       </svg>`;

  toast.innerHTML = `${icon}<span class="toast-message">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function showUndoToast(message, undoCallback) {
  const container = document.getElementById("toastContainer");

  // Clear any existing undo timeout
  if (undoTimeoutId) {
    clearTimeout(undoTimeoutId);
  }

  // Remove existing undo toasts
  container.querySelectorAll(".toast").forEach((t) => t.remove());

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
    </svg>
    <span class="toast-message">${message}</span>
    <button class="toast-action">Undo</button>
  `;

  container.appendChild(toast);

  toast.querySelector(".toast-action").addEventListener("click", () => {
    undoCallback();
    toast.remove();
  });

  undoTimeoutId = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
    deletedSession = null;
  }, 5000);
}

// ================================================================
// CONFIRM MODAL
// ================================================================

function closeConfirmModal() {
  document.getElementById("confirmModal").classList.add("hidden");
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ================================================================
// BACKWARDS COMPATIBILITY
// ================================================================

// Legacy functions for any code that might still reference them
async function openSession(index) {
  if (index >= 0 && index < sessions.length) {
    await openSessionByTimestamp(sessions[index].timestamp);
  }
}

async function deleteSession(index) {
  if (index >= 0 && index < sessions.length) {
    await deleteSessionByTimestamp(sessions[index].timestamp);
  }
}

function openRenameModal(index) {
  if (index >= 0 && index < sessions.length) {
    openRenameModalByTimestamp(sessions[index].timestamp);
  }
}

// Legacy showFeedback for backward compatibility
function showFeedback(message, type = "success") {
  showToast(message, type);
}
