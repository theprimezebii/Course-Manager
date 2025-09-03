// ---------------------- Utility ----------------------
function showAlert(msg) {
  alert(msg);
  console.log("Alert:", msg);
}

// ---------------------- LocalStorage Helpers ----------------------
function getSemesters() {
  return JSON.parse(localStorage.getItem("semesters") || "[]");
}
function saveSemesters(data) {
  localStorage.setItem("semesters", JSON.stringify(data));
}

// ---------------------- Render Semesters ----------------------
function renderSemesters() {
  const container = document.getElementById("semesterList");
  container.innerHTML = "";

  const semesters = getSemesters();
  if (semesters.length === 0) {
    container.innerHTML = "<p>No semesters yet. Add one above.</p>";
    return;
  }

  semesters.forEach(sem => {
    const card = document.createElement("div");
    card.className = "semester-card";

    card.innerHTML = `
      <div class="semester-header">
        <span class="semester-name">${sem.name}</span>
        <div class="semester-actions">
          <button onclick="updateSemester(${sem.id}, '${sem.name}')">Update</button>
          <button onclick="deleteSemester(${sem.id})">Delete</button>
        </div>
      </div>
      <div class="subject-input">
        <input type="text" id="subjectInput-${sem.id}" placeholder="Add subject">
        <button onclick="addSubject(${sem.id})">Add Subject</button>
      </div>
      <ul class="subject-list" id="subjectList-${sem.id}"></ul>
    `;

    container.appendChild(card);
    renderSubjects(sem.id);
  });
}

// ---------------------- Add Semester ----------------------
function addSemester() {
  const input = document.getElementById("semesterInput");
  const name = input.value.trim();
  if (!name) return showAlert("Enter semester name!");

  const semesters = getSemesters();
  semesters.push({ id: Date.now(), name, subjects: [] });
  saveSemesters(semesters);

  input.value = "";
  renderSemesters();
}

// ---------------------- Update/Delete Semester ----------------------
function updateSemester(id, oldName) {
  const newName = prompt("Enter new semester name:", oldName);
  if (!newName) return;
  const semesters = getSemesters();
  const sem = semesters.find(s => s.id === id);
  if (sem) sem.name = newName;
  saveSemesters(semesters);
  renderSemesters();
}
function deleteSemester(id) {
  if (!confirm("Are you sure to delete this semester?")) return;
  let semesters = getSemesters();
  semesters = semesters.filter(s => s.id !== id);
  saveSemesters(semesters);
  renderSemesters();
}

// ---------------------- Add Subject ----------------------
function addSubject(semesterId) {
  const input = document.getElementById(`subjectInput-${semesterId}`);
  const name = input.value.trim();
  if (!name) return showAlert("Enter subject name!");

  const semesters = getSemesters();
  const sem = semesters.find(s => s.id === semesterId);
  if (!sem) return;

  sem.subjects.push({ id: Date.now(), name, files: { notes: [], quiz: [], assignment: [], other: [] } });
  saveSemesters(semesters);

  input.value = "";
  renderSubjects(semesterId);
}

// ---------------------- Render Subjects ----------------------
function renderSubjects(semesterId) {
  const ul = document.getElementById(`subjectList-${semesterId}`);
  ul.innerHTML = "";

  const semesters = getSemesters();
  const sem = semesters.find(s => s.id === semesterId);
  if (!sem || sem.subjects.length === 0) {
    ul.innerHTML = "<li>No subjects yet</li>";
    return;
  }

  sem.subjects.forEach(sub => {
    const li = document.createElement("li");
    li.className = "subject-item";
    li.innerHTML = `
      <div class="subject-header">
        <span>${sub.name}</span>
        <button onclick="toggleSubject(${semesterId}, ${sub.id})">Open</button>
      </div>
      <div class="files-box" id="files-${sub.id}" style="display:none;"></div>
    `;
    ul.appendChild(li);
  });
}

// ---------------------- Toggle Subject (Show Files UI) ----------------------
function toggleSubject(semesterId, subjectId) {
  const box = document.getElementById(`files-${subjectId}`);
  if (box.style.display === "none") {
    box.style.display = "block";
    renderFiles(semesterId, subjectId);
  } else {
    box.style.display = "none";
  }
}

// ---------------------- Render Files ----------------------
function renderFiles(semesterId, subjectId) {
  const semesters = getSemesters();
  const sem = semesters.find(s => s.id === semesterId);
  const subject = sem.subjects.find(s => s.id === subjectId);

  const box = document.getElementById(`files-${subjectId}`);
  box.innerHTML = "";

  ["notes", "quiz", "assignment", "other"].forEach(type => {
    const section = document.createElement("div");
    section.className = "file-section";
    section.innerHTML = `
      <h4>${type.toUpperCase()}</h4>
      <input type="file" id="file-${subjectId}-${type}">
      <button onclick="uploadFile(${semesterId}, ${subjectId}, '${type}')">Upload</button>
      <div class="file-list" id="list-${subjectId}-${type}"></div>
    `;
    box.appendChild(section);

    renderFileList(subject, subjectId, type);
  });
}

// ---------------------- Upload File ----------------------
function uploadFile(semesterId, subjectId, type) {
  const input = document.getElementById(`file-${subjectId}-${type}`);
  if (!input.files[0]) return showAlert("Choose a file first!");
  const file = input.files[0];

  const semesters = getSemesters();
  const sem = semesters.find(s => s.id === semesterId);
  const subject = sem.subjects.find(s => s.id === subjectId);

  subject.files[type].push(file.name); // only save name
  saveSemesters(semesters);

  input.value = "";
  renderFileList(subject, subjectId, type);
}

// ---------------------- Render File List ----------------------
function renderFileList(subject, subjectId, type) {
  const list = document.getElementById(`list-${subjectId}-${type}`);
  list.innerHTML = "";
  if (subject.files[type].length === 0) {
    list.innerHTML = "<p>No files yet</p>";
    return;
  }

  subject.files[type].forEach((f, idx) => {
    const div = document.createElement("div");
    div.className = "file-item";
    div.innerHTML = `
      <span>${f}</span>
      <button onclick="deleteFile(${subjectId}, '${type}', ${idx})">Delete</button>
    `;
    list.appendChild(div);
  });
}

// ---------------------- Delete File ----------------------
function deleteFile(subjectId, type, index) {
  const semesters = getSemesters();
  semesters.forEach(sem => {
    const subject = sem.subjects.find(s => s.id === subjectId);
    if (subject) {
      subject.files[type].splice(index, 1);
    }
  });
  saveSemesters(semesters);

  // refresh lists
  semesters.forEach(sem => {
    const subject = sem.subjects.find(s => s.id === subjectId);
    if (subject) renderFileList(subject, subjectId, type);
  });
}

// ---------------------- Initialize ----------------------
document.addEventListener("DOMContentLoaded", () => {
  renderSemesters();
  document.getElementById("addSemester").addEventListener("click", addSemester);
});
