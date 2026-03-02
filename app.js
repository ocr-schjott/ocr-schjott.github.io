// ============================
// 6 Timers OCR — Event Page App
// ============================
// Each event page sets EVENT_KEY before loading this script.

const EVENT_CONFIG = {
  "2026_winter": {
    file: "results_2026_winter.json",
    format: "v2",
    label: "6 timers OCR Vinter 2026",
    date: "28. februar 2026",
    lapKm: 5,
  },
  "2025_winter": {
    file: "results_2025_winter.json",
    format: "v1",
    label: "6 timers OCR Sommer 2025",
    date: "7. juni 2025",
    lapKm: 5,
  },
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let currentCategory = "all";

// ---- DOM refs ----
const resultsContainer = document.getElementById("resultsContainer");
const overlayBackdrop = document.getElementById("overlayBackdrop");
const detailOverlay = document.getElementById("detailOverlay");

// ---- Theme toggle ----
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("ocr-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("ocr-theme", next);
});

// ---- Category filter pills ----
document.getElementById("categoryFilters").addEventListener("click", (e) => {
  const pill = e.target.closest(".pill");
  if (!pill || pill.classList.contains("active")) return;
  document
    .querySelectorAll(".pill")
    .forEach((p) => p.classList.remove("active"));
  pill.classList.add("active");
  currentCategory = pill.dataset.category;
  filterCategories();
});

// ---- Overlay close ----
overlayBackdrop.addEventListener("click", (e) => {
  if (e.target === overlayBackdrop) closeOverlay();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeOverlay();
});

// ============================
// Data loading & normalization
// ============================

async function loadEvent(eventKey) {
  const cfg = EVENT_CONFIG[eventKey];

  resultsContainer.innerHTML = `<div class="loading">Indlæser resultater…</div>`;

  try {
    const res = await fetch(cfg.file);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const raw = await res.json();
    const normalized =
      cfg.format === "v1" ? normalizeV1(raw) : normalizeV2(raw);
    renderResults(normalized, cfg);
  } catch (err) {
    console.error(err);
    resultsContainer.innerHTML = `<div class="loading" style="color:var(--bronze)">Kunne ikke indlæse data.</div>`;
  }
}

// -- V1 (2025) normalizer --
function normalizeV1(data) {
  const dateStr = data.date; // "2025-06-07"
  const baseDate = new Date(dateStr + "T00:00:00").getTime();
  const soloStartMs = parseTime(data.startTime);
  const soloEndMs = parseTime(data.endTime);
  const teamStartMs = parseTime(data.teamStartTime);
  const teamEndMs = parseTime(data.teamEndTime);

  function mapSolo(arr) {
    return arr
      .map((a) => {
        const rounds = buildRoundsV1(
          a.rounds,
          a.registrations,
          baseDate + soloStartMs,
        );
        const endAbsolute = baseDate + soloEndMs;
        markValidity(rounds, endAbsolute);
        const validLaps = rounds.filter((r) => r.valid).length;
        return {
          name: `${a.firstName} ${a.lastName}`,
          club: a.clubOrCompany || null,
          laps: validLaps,
          totalLaps: rounds.length,
          members: null,
          rounds,
        };
      })
      .filter((a) => a.totalLaps > 0)
      .sort((a, b) => b.laps - a.laps || lastValidTime(a) - lastValidTime(b))
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }

  function mapTeams(arr) {
    return arr
      .map((a) => {
        const rounds = buildRoundsV1(
          a.rounds,
          a.registrations,
          baseDate + teamStartMs,
        );
        const endAbsolute = baseDate + teamEndMs;
        markValidity(rounds, endAbsolute);
        const validLaps = rounds.filter((r) => r.valid).length;
        return {
          name: a.name,
          club: null,
          laps: validLaps,
          totalLaps: rounds.length,
          members: a.athletes || null,
          rounds,
        };
      })
      .filter((a) => a.totalLaps > 0)
      .sort((a, b) => b.laps - a.laps || lastValidTime(a) - lastValidTime(b))
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }

  return {
    soloMales: mapSolo(data.soloMales || []),
    soloFemales: mapSolo(data.soloFemales || []),
    teams: mapTeams(data.teams || []),
  };
}

function buildRoundsV1(rounds, registrations, raceStartAbsolute) {
  if (rounds && rounds.length) {
    return rounds.map((r, i) => ({
      num: i + 1,
      durationMs: r.duration,
      time: r.registrationTime,
      timeMs: new Date(r.registrationTime).getTime(),
      valid: true, // will be set by markValidity
    }));
  }
  if (!registrations || !registrations.length) return [];
  const sorted = [...registrations].sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = new Date(sorted[i].time).getTime();
    const prev =
      i === 0 ? raceStartAbsolute : new Date(sorted[i - 1].time).getTime();
    result.push({
      num: i + 1,
      durationMs: t - prev,
      time: sorted[i].time,
      timeMs: t,
      valid: true,
    });
  }
  return result;
}

// -- V2 (2026) normalizer --
function normalizeV2(data) {
  const dateStr = data.startDate; // "2026-02-28"
  const baseDate = new Date(dateStr + "T00:00:00").getTime();
  const raceMap = {};

  for (const race of data.races) {
    const key = mapRaceName(race.name);
    const startMs = parseTime(race.startTime);
    const endMs = parseTime(race.endTime);
    const endAbsolute = baseDate + endMs;

    raceMap[key] = race.entries
      .map((e) => {
        let members = null;
        if (e.memberNames) {
          try {
            members = JSON.parse(e.memberNames);
          } catch {}
        }
        const rounds = buildRoundsV2(e.registrations, baseDate + startMs);
        markValidity(rounds, endAbsolute);
        const validLaps = rounds.filter((r) => r.valid).length;
        return {
          name: e.name,
          club: e.clubOrCompany || null,
          laps: validLaps,
          totalLaps: rounds.length,
          members,
          rounds,
        };
      })
      .filter((e) => e.totalLaps > 0)
      .sort((a, b) => b.laps - a.laps || lastValidTime(a) - lastValidTime(b))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  return {
    soloMales: raceMap.soloMales || [],
    soloFemales: raceMap.soloFemales || [],
    teams: raceMap.teams || [],
  };
}

function mapRaceName(name) {
  const n = name.toLowerCase();
  if (n.includes("herrer") || n.includes("mænd")) return "soloMales";
  if (n.includes("damer") || n.includes("kvinder")) return "soloFemales";
  if (n.includes("hold")) return "teams";
  return name;
}

function buildRoundsV2(registrations, raceStartAbsolute) {
  if (!registrations || !registrations.length) return [];
  const sorted = [...registrations].sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = new Date(sorted[i].time).getTime();
    const prev =
      i === 0 ? raceStartAbsolute : new Date(sorted[i - 1].time).getTime();
    result.push({
      num: i + 1,
      durationMs: t - prev,
      time: sorted[i].time,
      timeMs: t,
      valid: true,
    });
  }
  return result;
}

// Mark rounds as valid/invalid based on the race end time
function markValidity(rounds, endAbsoluteMs) {
  for (const r of rounds) {
    r.valid = r.timeMs <= endAbsoluteMs;
  }
}

function lastValidTime(entry) {
  const validRounds = entry.rounds.filter((r) => r.valid);
  if (!validRounds.length) return Infinity;
  return validRounds[validRounds.length - 1].timeMs;
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(":").map(Number);
  return ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000;
}

// ============================
// Rendering
// ============================

function renderResults(data, cfg) {
  const categories = [
    {
      key: "soloMales",
      label: "Solo Herrer",
      icon: "🏃",
      data: data.soloMales,
    },
    {
      key: "soloFemales",
      label: "Solo Damer",
      icon: "🏃‍♀️",
      data: data.soloFemales,
    },
    { key: "teams", label: "Hold", icon: "👥", data: data.teams },
  ];

  resultsContainer.innerHTML = "";

  for (const cat of categories) {
    const section = document.createElement("div");
    section.className = "category-section";
    section.dataset.category = cat.key;

    if (currentCategory !== "all" && currentCategory !== cat.key) {
      section.classList.add("hidden");
    }

    section.innerHTML = `
      <div class="category-title">
        <span class="cat-icon">${cat.icon}</span>
        ${cat.label}
        <span class="cat-count">${cat.data.length} deltagere</span>
      </div>
    `;

    const table = document.createElement("div");
    table.className = "results-table";

    const headerRow = document.createElement("div");
    headerRow.className = "results-row table-header";
    headerRow.innerHTML = `
      <div>#</div>
      <div>Navn</div>
      <div>Runder</div>
      <div>Tid</div>
      <div>Dist.</div>
    `;
    table.appendChild(headerRow);

    for (const entry of cat.data) {
      const row = document.createElement("div");
      row.className = "results-row";
      row.addEventListener("click", () => showDetail(entry, cfg));

      const rankClass =
        entry.rank === 1
          ? "gold"
          : entry.rank === 2
            ? "silver"
            : entry.rank === 3
              ? "bronze"
              : "";

      const clubHtml = entry.club
        ? `<span class="athlete-club">${entry.club}</span>`
        : entry.members
          ? `<span class="athlete-club">${entry.members.join(", ")}</span>`
          : "";

      const validRounds = entry.rounds.filter((r) => r.valid);
      const totalMs = validRounds.reduce((sum, r) => sum + r.durationMs, 0);

      row.innerHTML = `
        <div class="rank-cell ${rankClass}">${entry.rank}</div>
        <div class="name-cell">
          <span class="athlete-name">${entry.name}</span>
          ${clubHtml}
        </div>
        <div class="laps-cell">${entry.laps}</div>
        <div class="time-cell">${formatDuration(totalMs)}</div>
        <div class="distance-cell">${entry.laps * cfg.lapKm} km</div>
      `;

      table.appendChild(row);
    }

    section.appendChild(table);
    resultsContainer.appendChild(section);
  }
}

function filterCategories() {
  document.querySelectorAll(".category-section").forEach((s) => {
    if (currentCategory === "all" || s.dataset.category === currentCategory) {
      s.classList.remove("hidden");
    } else {
      s.classList.add("hidden");
    }
  });
}

// ============================
// Detail overlay
// ============================

function showDetail(entry, cfg) {
  const membersHtml = entry.members
    ? `<div class="detail-members">${entry.members.join(" &amp; ")}</div>`
    : "";

  const validRounds = entry.rounds.filter((r) => r.valid);
  const totalMs = validRounds.reduce((sum, r) => sum + r.durationMs, 0);

  let html = `
    <div class="detail-header">
      <div class="detail-event">${cfg.label}</div>
      <div class="detail-name">${entry.name}</div>
      ${membersHtml}
      <div class="detail-stats">
        <div class="detail-stat">
          <div class="stat-value">${entry.laps}</div>
          <div class="stat-label">Runder</div>
        </div>
        <div class="detail-stat">
          <div class="stat-value">${entry.laps * cfg.lapKm}</div>
          <div class="stat-label">Kilometer</div>
        </div>
        <div class="detail-stat">
          <div class="stat-value">${formatDuration(totalMs)}</div>
          <div class="stat-label">Samlet tid</div>
        </div>
      </div>
    </div>
    <div class="rounds-list">
      <div class="round-row round-header">
        <div>Runde</div>
        <div>Tid</div>
        <div style="text-align:right">Klokkeslæt</div>
      </div>
  `;

  for (const r of entry.rounds) {
    const invalidClass = r.valid ? "" : " round-invalid";
    html += `
      <div class="round-row${invalidClass}">
        <div class="round-num">${r.num}</div>
        <div class="round-duration">${formatDuration(r.durationMs)}</div>
        <div class="round-time">${formatClock(r.time)}</div>
      </div>
    `;
  }

  html += `</div>
    <button class="detail-close" id="detailClose">Luk</button>
  `;

  detailOverlay.innerHTML = html;
  overlayBackdrop.classList.add("open");

  document
    .getElementById("detailClose")
    .addEventListener("click", closeOverlay);
}

function closeOverlay() {
  overlayBackdrop.classList.remove("open");
}

// ============================
// Formatting helpers
// ============================

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatClock(dateStr) {
  const d = new Date(dateStr);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

// ============================
// Init — uses EVENT_KEY set by the HTML page
// ============================
if (typeof EVENT_KEY !== "undefined") {
  loadEvent(EVENT_KEY);
}
