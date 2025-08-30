// ---------------------- Utility ----------------------
function showAlert(msg){
    alert(msg);
    console.log('Alert:', msg);
}

// ---------------------- Fetch Semesters ----------------------
async function fetchSemesters(){
    const container = document.getElementById('semestersContainer');
    container.innerHTML = '';
    const res = await fetch('/semesters');
    const data = await res.json();
    if(!data.semesters || data.semesters.length === 0){
        container.innerHTML = '<p>No semesters found. Add one above.</p>';
        return;
    }

    data.semesters.forEach(sem => {
        const card = document.createElement('div');
    card.innerHTML = `
    <div class="semester-header">
        <span class="semester-name">${sem.name}</span>
        <div class="semester-actions">
            <button class="update-btn" onclick="updateSemester(${sem.id},'${sem.name}')">Update</button>
            <button class="delete-btn" onclick="deleteSemester(${sem.id})">Delete</button>
        </div>
    </div>
    <div class="subject-input">
        <input type="text" id="subjectInput-${sem.id}" placeholder="Add subject">
        <button onclick="addSubject(${sem.id})">Add Subject</button>
    </div>
    <ul class="subject-list" id="subjectList-${sem.id}"></ul>
`;

        container.appendChild(card);
        fetchSubjects(sem.id);
    });
}

// ---------------------- Add Semester ----------------------
async function addSemester(){
    const nameInput = document.getElementById('semesterName');
    const name = nameInput.value.trim();
    if(!name) return showAlert('Enter semester name!');

    const res = await fetch('/add-semester', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name})
    });
    const data = await res.json();
    if(data.error) return showAlert(data.error);
    nameInput.value='';
    fetchSemesters();
}

// ---------------------- Update Semester ----------------------
async function updateSemester(id, oldName){
    const newName = prompt('Enter new semester name:', oldName);
    if(!newName) return;
    const res = await fetch('/update-semester', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({id, name:newName})
    });
    const data = await res.json();
    if(data.error) return showAlert(data.error);
    fetchSemesters();
}

// ---------------------- Delete Semester ----------------------
async function deleteSemester(id){
    if(!confirm('Are you sure to delete this semester?')) return;
    const res = await fetch(`/delete-semester?id=${id}`, {method:'DELETE'});
    const data = await res.json();
    if(data.error) return showAlert(data.error);
    fetchSemesters();
}

// ---------------------- Add Subject ----------------------
async function addSubject(semesterId){
    const input = document.getElementById(`subjectInput-${semesterId}`);
    const name = input.value.trim();
    if(!name) return showAlert('Enter subject name!');
    const res = await fetch('/add-subject', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name, semesterId})
    });
    const data = await res.json();
    if(data.error) return showAlert(data.error);
    input.value='';
    fetchSubjects(semesterId);
}

// ---------------------- Fetch Subjects ----------------------
async function fetchSubjects(semesterId){
    const ul = document.getElementById(`subjectList-${semesterId}`);
    ul.innerHTML='';
    const res = await fetch('/subjects');
    const data = await res.json();
    const subjects = data.subjects.filter(s=>s.semester_id===semesterId);
    if(subjects.length===0){
        ul.innerHTML='<li>No subjects added yet</li>';
        return;
    }
    subjects.forEach(s=>{
        const li = document.createElement('li');
        li.textContent = s.name;
        li.className = 'subject-item';
        li.onclick = ()=> openSubject(s.name);
        ul.appendChild(li);
    });
}

// ---------------------- Open Subject ----------------------
function openSubject(subjectName){
    localStorage.setItem('currentSubjectName', subjectName);
    window.location.href='subject.html';
}

// ---------------------- Fetch & Display Files ----------------------
function fetchAllFiles(section){
    const types = ['notes','quiz','assignment','other'];
    const container = document.getElementById(`${section}-files-list`);
    if(!container) return;
    container.innerHTML='';

    const subject = localStorage.getItem('currentSubjectName');
    if(!subject) return;

    types.forEach(type=>{
        fetch(`/files?subject=${encodeURIComponent(subject)}&section=${section}&type=${type}`)
        .then(res=>res.json())
        .then(data=>{
            const files = data.files||[];
            const heading = document.createElement('h4');
            heading.textContent = type.charAt(0).toUpperCase()+type.slice(1);
            container.appendChild(heading);

            if(files.length===0){
                const p = document.createElement('p');
                p.textContent='No files uploaded yet';
                container.appendChild(p);
            }

            files.forEach(f=>{
                const div = document.createElement('div');
                div.className='file-item';
               div.innerHTML = `
    <input type="checkbox" value="${f.filename}" data-type="${type}">
    <a href="/uploads/${subject}/${section}/${type}/${f.filename}" target="_blank">${f.filename}</a>
`;
                container.appendChild(div);
            });
        }).catch(err=>console.error(err));
    });
}

// ---------------------- Upload Files ----------------------
function uploadSection(section){
    const types = ['notes','quiz','assignment','other'];
    const subject = localStorage.getItem('currentSubjectName');
    if(!subject) return showAlert('No subject selected');

    types.forEach(type=>{
        const input = document.getElementById(`${section}-${type}-input`);
        if(!input || !input.files[0]) return;
        const formData = new FormData();
        formData.append('file', input.files[0]);
        formData.append('subject', subject);
        formData.append('section', section);
        formData.append('type', type);

        fetch('/upload', {method:'POST', body: formData})
        .then(res=>res.json())
        .then(data=>{
            if(data.error) return showAlert(data.error);
            input.value='';
            fetchAllFiles(section);
        }).catch(err=>console.error(err));
    });
}

// ---------------------- Update Files ----------------------
function updateSection(section){
    const checkboxes = document.querySelectorAll(`#${section}-files-list input[type="checkbox"]:checked`);
    if(checkboxes.length===0) return showAlert('Select file(s) to update');
    const subject = localStorage.getItem('currentSubjectName');
    if(!subject) return;

    checkboxes.forEach(cb=>{
        const type = cb.dataset.type;
        const filename = cb.value;

        const input = document.createElement('input');
        input.type='file';
        input.onchange = e=>{
            const file = e.target.files[0];
            if(!file) return;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('subject', subject);
            formData.append('section', section);
            formData.append('type', type);
            formData.append('update', true);
            formData.append('filename', filename);

            fetch('/upload', {method:'POST', body: formData})
            .then(()=>fetchAllFiles(section))
            .catch(err=>console.error(err));
        };
        input.click();
    });
}

// ---------------------- Delete Files ----------------------
function deleteSection(section){
    const checkboxes = document.querySelectorAll(`#${section}-files-list input[type="checkbox"]:checked`);
    if(checkboxes.length===0) return showAlert('Select file(s) to delete');
    const subject = localStorage.getItem('currentSubjectName');
    if(!subject) return;
    if(!confirm('Are you sure you want to delete selected files?')) return;

    checkboxes.forEach(cb=>{
        const type = cb.dataset.type;
        const filename = cb.value;
        fetch('/delete-file',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({subject, section, type, filename})
        }).then(()=>fetchAllFiles(section))
        .catch(err=>console.error(err));
    });
}
function goHome() {
    window.location.href = 'index.html'; // your home page
}
// ---------------------- Initialize ----------------------
window.addEventListener('DOMContentLoaded', fetchSemesters);
