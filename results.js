fetch("results.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Failed to load JSON");
    }
    return response.json();
  })
  .then((data) => {
    const obj = data;

    const soloMalesList = document.getElementById("soloMales");
    soloMalesList.appendChild(createHeader());
    const soloFemalesList = document.getElementById("soloFemales");
    soloFemalesList.appendChild(createHeader());
    const teamsList = document.getElementById("teams");
    teamsList.appendChild(createHeader());

    obj.soloMales.forEach((a) => {
      if (a.completedRounds == 0) return;
      const li = document.createElement("li");
      li.classList.add("athlete");
      li.onclick = () => showSolo(a);
      li.innerHTML = `
      <div>${a.rank}.</div>
      <div class="name">${a.firstName} ${a.lastName}</div>
      <div>${a.completedRounds}</div>`;
      soloMalesList.appendChild(li);
    });
    obj.soloFemales.forEach((a) => {
      if (a.completedRounds == 0) return;
      const li = document.createElement("li");
      li.onclick = () => showSolo(a);
      li.classList.add("athlete");
      li.innerHTML = `
      <div>${a.rank}.</div>
      <div class="name">${a.firstName} ${a.lastName}</div>
      <div>${a.completedRounds}</div>`;
      soloFemalesList.appendChild(li);
    });
    obj.teams.forEach((a) => {
      if (a.completedRounds == 0) return;
      const li = document.createElement("li");
      li.classList.add("athlete");
      li.onclick = () => showTeam(a);
      li.innerHTML = `
      <div>${a.rank}.</div>
      <div class="name">${a.name}</div>
      <div>${a.completedRounds}</div>
      `;
      teamsList.appendChild(li);
    });
  })
  .catch((error) => {
    console.error("Error:", error);
  });

function createHeader() {
  const li = document.createElement("li");
  li.classList.add("header");
  li.innerHTML = `
    <div>Placering</div>
    <div>Navn</div>
    <div>Omgange</div>
    `;
  return li;
}

function showTeam(team) {
  generateOverlay(team.name, team.rounds);
}

function showSolo(solo) {
  const name = solo.firstName + " " + solo.lastName;
  generateOverlay(name, solo.rounds);
}

function generateOverlay(name, rounds) {
  console.log(name);
  document.querySelector(".details")?.remove();
  const overlay = document.createElement("div");
  overlay.classList.add("details");

  const info = document.createElement("div");
  info.innerHTML = `
    
    <h2 class="text-center">6 timers OCR sommer edition </h2>
    <p>7. juni 2025</p>
    <h3 class="name">${name} </h3>
  <h4>${rounds.length} runder / ${rounds.length * 5} km</h4>
  `;

  overlay.appendChild(info);
  const ul = document.createElement("ul");
  const header = document.createElement("li");
  header.classList.add("header");
  header.innerHTML = `
  <div>Runde</div>
  <div>Tid</div>
  <div>Tidspunkt</div>
`;
  ul.appendChild(header);
  rounds.forEach((r, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
        <div>${i + 1}</div>
        <div>${formatDuration(r.duration)}</div>
        <div>${formatDate(r.registrationTime)}</div>
    `;
    ul.appendChild(li);
  });
  overlay.appendChild(ul);

  const closeButton = document.createElement("div");
  closeButton.classList.add("closeButton");
  closeButton.onclick = () => overlay.remove();
  closeButton.innerText = "Luk";

  overlay.appendChild(closeButton);

  const settings = document.createElement("div");
  settings.classList.add("settings");
  const label = document.createElement("label");
  label.classList.add("change-color");
  label.textContent = "Ændre baggrundsfarven: ";
  const bgChange = document.createElement("input");
  bgChange.type = "color";
  bgChange.value = "#2a2a35";
  label.appendChild(bgChange);
  settings.appendChild(label);

  bgChange.oninput = (e) => (overlay.style.backgroundColor = e.target.value);

  const label2 = document.createElement("label");
  label2.classList.add("change-color");
  label2.textContent = "Ændre tekstfarven: ";
  const bgChange2 = document.createElement("input");
  bgChange2.type = "color";
  bgChange2.value = "#ffffff";
  label2.appendChild(bgChange2);
  settings.appendChild(label2);

  bgChange2.oninput = (e) => (overlay.style.color = e.target.value);

  overlay.appendChild(settings);

  document.body.appendChild(overlay);
}

function formatDuration(duration) {
  const totalSeconds = Math.floor(duration / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  return `${hours > 0 ? hours + ":" : ""}${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);

  return `${date.getHours()}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}
