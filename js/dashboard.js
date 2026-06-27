/**
 * Dashboard-specific functions for rendering recent entries
 * and handling dashboard interactions
 */

function renderRecentEntries() {
  const recentPanel = document.getElementById("recentEntriesPanel");
  if (!recentPanel) return;

  const recent = state.entries.slice(0, 5);

  if (recent.length === 0) {
    recentPanel.innerHTML = `
      <div class="empty-state">
        <p>No entries yet. Start by adding your first glucose reading.</p>
      </div>
    `;
    return;
  }

  recentPanel.innerHTML = `
    <div class="recent-entries-list">
      ${recent
        .map(
          (entry) => `
        <div class="recent-entry">
          <div class="entry-time-status">
            <span class="entry-time">${formatDateTime(entry.datetime)}</span>
            <span class="entry-status-badge ${getStatus(entry.glucose)}">${statusLabel(getStatus(entry.glucose))}</span>
          </div>
          <div class="entry-value">
            <strong>${formatNumber(entry.glucose, state.settings.unit === "mmol/L" ? 1 : 0)}</strong>
            <span class="entry-unit">${state.settings.unit}</span>
          </div>
          ${entry.insulin ? `<div class="entry-detail">💉 ${formatNumber(entry.insulin, 1)}u</div>` : ""}
          ${entry.carbs ? `<div class="entry-detail">🍽️ ${formatNumber(entry.carbs, 0)}g</div>` : ""}
          ${entry.notes ? `<div class="entry-notes">"${entry.notes}"</div>` : ""}
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function handleQuickActionClick(event) {
  const action = event.currentTarget.dataset.action;

  switch (action) {
    case "add-glucose":
      switchView("logbook");
      setTimeout(() => {
        setDefaultEntryDateTime();
        document.getElementById("entryGlucose")?.focus();
      }, 50);
      break;
    case "add-meal":
      switchView("logbook");
      setTimeout(() => {
        setDefaultEntryDateTime();
        document.getElementById("entryMeal")?.focus();
      }, 50);
      break;
    case "add-insulin":
      switchView("logbook");
      setTimeout(() => {
        setDefaultEntryDateTime();
        document.getElementById("entryInsulin")?.focus();
      }, 50);
      break;
    case "view-logbook":
      switchView("logbook");
      break;
    default:
      break;
  }
}

function setupDashboardEventListeners() {
  const quickActionButtons = document.querySelectorAll(".quick-action-button");
  quickActionButtons.forEach((button) => {
    button.addEventListener("click", handleQuickActionClick);
  });
}

