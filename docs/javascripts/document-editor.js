// --- SIDEBAR SUBPAGE RENDER ---
function renderWorkspaceSidebar() {
    wikiNavList.innerHTML = '';
    const project = projects.find(p => p.id === currentActiveProjectId);
    document.getElementById('testSuiteTabItem').classList.remove('active');
    
    project.pages.forEach((page, index) => {
        const isActive = (index === currentActivePageIndex && typeof currentActivePageIndex === 'number') ? 'active' : '';
        const item = `
            <li class="wiki-nav-item ${isActive}" onclick="switchPage(${index})">
                <span>📄 ${page.title}</span>
                ${(index !== 0 && permissions.canManagePages) ? `<span style="font-size:0.8rem; opacity:0.7; cursor:pointer;" onclick="deleteSubPage(event, ${index})">✕</span>` : ''}
            </li>
        `;
        wikiNavList.insertAdjacentHTML('beforeend', item);
    });

    if (currentActivePageIndex === 'test-suite') {
        document.getElementById('testSuiteTabItem').classList.add('active');
    }
}

// --- SUBPAGE SAVING CONTENT ---
async function savePageContent() {
    const newHTMLContent = quillEditor.getSemanticHTML(); 
    const project = projects.find(p => p.id === currentActiveProjectId);
    const page = project.pages[currentActivePageIndex];
    const nextVersionNumber = (parseFloat(page.history[page.history.length - 1].version.replace('v', '')) + 0.1).toFixed(1);
    
    page.history.push({ version: `v${nextVersionNumber}`, author: getAuthorName(), timestamp: getCurrentFormattedTimestamp(), action: "Updated documentation contents" });
    page.content = newHTMLContent;

    try {
        const { error } = await supabaseClient.from('projects').update({ pages: project.pages }).eq('id', project.id);
        if (error) throw error; 
        isEditingMode = false; 
        renderWorkspaceContent(); 
        calculateWordingTags();
    } catch (err) { console.error(err); }
}

// --- TAG CALCULATION ---
function calculateWordingTags() {
    const project = projects.find(p => p.id === currentActiveProjectId);
    if (!project) return;
    if (!project.customTags) { project.customTags = ['[sso]', '[database]', '[payment]', '[maintenance]', '[reports]']; }
    const tagCounts = {}; project.customTags.forEach(tag => { tagCounts[tag] = 0; });
    
    project.pages.forEach(page => {
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = page.content || '';
        const cleanText = tempDiv.innerText.toLowerCase();
        Object.keys(tagCounts).forEach(tag => {
            const cleanTag = tag.replace('[', '').replace(']', '');
            const regex = new RegExp('\\[' + cleanTag + '\\]', 'g');
            const matches = cleanText.match(regex); if (matches) { tagCounts[tag] += matches.length; }
        });
    });
    
    tagStatList.innerHTML = '';
    Object.entries(tagCounts).forEach(([tag, count]) => {
        tagStatList.insertAdjacentHTML('beforeend', `<div class="stat-tag-row"><span class="tag-pill">${tag}</span><div style="display:flex; align-items:center; gap:8px;"><span><strong>${count}</strong> used</span>${permissions.canManageTags ? `<button class="delete-tag-btn" onclick="deleteCustomTag('${tag}')">✕</button>` : ''}</div></div>`);
    });
}

// --- SUB-PAGE FORM CREATION ---
document.getElementById('subPageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('subPageTitle').value;
    const project = projects.find(p => p.id === currentActiveProjectId);
    project.pages.push({ title: title, content: `<h1>${title}</h1><p>Start editing content here...</p>`, history: [{ version: "v1.0", author: getAuthorName(), timestamp: getCurrentFormattedTimestamp(), action: "Created blank page" }] });

    try {
        const { error } = await supabaseClient.from('projects').update({ pages: project.pages }).eq('id', project.id);
        if (error) throw error; 
        closeSubPageModal(); 
        document.getElementById('subPageForm').reset(); 
        currentActivePageIndex = project.pages.length - 1; 
        renderWorkspaceSidebar(); 
        renderWorkspaceContent(); 
        calculateWordingTags();
    } catch (err) { console.error(err); }
});

// --- EDIT SPECS SYSTEM FORM ---
document.getElementById('editSpecsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const project = projects.find(p => p.id === currentActiveProjectId);
    project.name = document.getElementById('editProjName').value;
    project.desc = document.getElementById('editProjDesc').value;
    project.objectives = document.getElementById('editProjObjectives').value;
    project.requestor = document.getElementById('editProjRequestor').value;
    project.status = document.getElementById('editProjStatus').value;
    const dev = document.getElementById('editProjDev').value;
    const qa = document.getElementById('editProjQA').value;
    const ba = document.getElementById('editProjBA').value;

    const page = project.pages[currentActivePageIndex];
    const nextVersionNumber = (parseFloat(page.history[page.history.length - 1].version.replace('v', '')) + 0.1).toFixed(1);
    page.history.push({ version: `v${nextVersionNumber}`, author: getAuthorName(), timestamp: getCurrentFormattedTimestamp(), action: "Updated project metadata specifications" });

    try {
        const { error } = await supabaseClient.from('projects').update({ name: project.name, desc: project.desc, objectives: project.objectives, requestor: project.requestor, status: project.status, dev_assignee: dev, qa_assignee: qa, ba_assignee: ba, pages: project.pages }).eq('id', project.id);
        if (error) throw error; 
        project.devAssignee = dev; project.qaAssignee = qa; project.baAssignee = ba; 
        headerSubtitle.innerHTML = `/ ${project.name}`; 
        closeEditSpecsModal(); 
        renderWorkspaceContent();
    } catch (err) { console.error(err); }
});