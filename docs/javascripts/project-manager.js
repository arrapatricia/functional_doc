// --- FETCH PROJECTS ---
async function fetchProjectsFromDB() {
    try {
        const { data, error } = await supabaseClient.from('projects').select('*');
        if (error) throw error;
        if (data) {
            projects = data.map(p => ({
                id: p.id,
                name: p.name,
                desc: p.desc,
                objectives: p.objectives,
                requestor: p.requestor,
                status: p.status,
                devAssignee: p.dev_assignee,
                qaAssignee: p.qa_assignee,
                baAssignee: p.ba_assignee,
                dateCreated: p.date_created,
                createdBy: p.created_by,
                customTags: p.custom_tags || [],
                pages: p.pages || [],
                notesHistory: p.notes_history || [],
                testSuite: p.test_suite || [],
                testHistory: p.test_history || []
            }));
            renderDashboard();
        }
    } catch (err) { console.error("Error fetching projects:", err); }
}

// --- RENDER CARD GRID ---
function renderDashboard() {
    projectGrid.innerHTML = '';
    projects.forEach(project => {
        const dateText = project.dateCreated;
        const hasOwnership = (role === 'admin') || (project.createdBy === activeUser);
        const canDelete = permissions.canDeleteProjects && hasOwnership;

        let pillColor = '#64748b'; let pillBg = '#f1f5f9';
        if (project.status === 'Launched') { pillColor = 'var(--success-green)'; pillBg = '#e2fcdb'; }
        else if (project.status === 'In Progress') { pillBg = '#ebf3fc'; pillColor = 'var(--accent-blue)'; }

        const card = `
            <div class="project-card">
                <div class="card-header">
                    <div class="card-title">${project.name}</div>
                    <div class="status-pill" style="color: ${pillColor}; background: ${pillBg}; border: 1px solid ${pillColor}40;">${project.status || 'To Do'}</div>
                </div>
                <div class="card-desc">${project.desc}</div>
                <div class="card-meta">📅 Created: ${dateText}</div>
                <div class="card-meta" style="color:var(--accent-blue);">👤 Owner: ${project.createdBy || 'admin'}</div>
                <div class="card-footer">
                    <button class="btn-primary" onclick="openProjectWorkspace('${project.id}')">Open Folder</button>
                    <div style="display: flex; gap: 8px;">
                        ${canDelete ? `<button class="btn-icon delete-btn" onclick="deleteProject('${project.id}')">🗑</button>` : '<span style="font-size:0.75rem; color:var(--dark-gray); align-self:center;">View Only</span>'}
                    </div>
                </div>
            </div>
        `;
        projectGrid.insertAdjacentHTML('beforeend', card);
    });
}

// --- SUBMIT NEW PROJECT ---
document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('projName').value.trim();
    const desc = document.getElementById('projDesc').value.trim();
    const objectives = document.getElementById('projObjectives').value.trim();
    const requestor = document.getElementById('projRequestor').value.trim();
    const status = document.getElementById('projStatus').value;
    const dev = document.getElementById('projDev').value.trim();
    const qa = document.getElementById('projQA').value.trim();
    const ba = document.getElementById('projBA').value.trim();

    const newProject = {
        name: name,
        desc: desc,
        objectives: objectives,
        requestor: requestor,
        status: status,
        dev_assignee: dev,
        qa_assignee: qa,
        ba_assignee: ba,
        date_created: getCurrentFormattedDate(),
        created_by: getAuthorName(),
        custom_tags: ['[sso]', '[database]', '[payment]', '[maintenance]', '[reports]'],
        pages: [
            {
                title: "Overview",
                content: `<h1>${name} Overview</h1><p>Welcome to the documentation workspace for ${name}. Use the navigation panel on the left to track wording tags, review audit logs, and manage QA testing scenarios.</p>`,
                history: [{ version: "v1.0", author: getAuthorName(), timestamp: getCurrentFormattedTimestamp(), action: "Initial project setup" }]
            }
        ],
        notes_history: [],
        test_suite: [],
        test_history: []
    };

    try {
        const { error } = await supabaseClient.from('projects').insert([newProject]);
        if (error) throw error;
        
        document.getElementById('projectModal').style.display = 'none';
        document.getElementById('projectForm').reset();
        await fetchProjectsFromDB();
    } catch (err) {
        console.error("Failed to insert new project:", err);
        alert("Failed to save project to Supabase.");
    }
});

// --- DELETE PROJECT ---
async function deleteProject(projectId) {
    if (!confirm("Are you sure you want to permanently delete this project? This is irreversible.")) return;
    try {
        const { error } = await supabaseClient.from('projects').delete().eq('id', projectId);
        if (error) throw error;
        await fetchProjectsFromDB();
    } catch (err) { console.error("Error deleting project:", err); }
}

// --- OPEN / NAVIGATION INTERFACES ---
function openProjectWorkspace(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    currentActiveProjectId = projectId;
    currentActivePageIndex = 0;
    
    headerSubtitle.textContent = `/ ${project.name}`;
    dashboardView.classList.remove('active');
    workspaceView.classList.add('active');
    
    document.getElementById('addPageBtn').style.display = permissions.canManagePages ? 'block' : 'none';
    document.getElementById('importPageBtn').style.display = permissions.canManagePages ? 'block' : 'none';
    document.getElementById('addTagBtn').style.display = permissions.canManageTags ? 'block' : 'none';

    renderWorkspaceSidebar();
    renderWorkspaceContent();
    calculateWordingTags();
}

function showDashboardView() {
    currentActiveProjectId = null;
    headerSubtitle.textContent = "/ Projects Directory";
    workspaceView.classList.remove('active');
    dashboardView.classList.add('active');
}