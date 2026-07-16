function renderTestHistoryAuditLogs(project) {
    let logsHtml = '';
    if (project.testHistory && project.testHistory.length > 0) {
        [...project.testHistory].reverse().forEach(log => {
            logsHtml += `
                <div class="audit-log-item" style="margin-bottom: 6px; border-left: 3px solid var(--warning-amber);">
                    <div><strong>${log.action}</strong></div>
                    <div class="log-meta">By <strong>${log.author}</strong> on ${log.timestamp}</div>
                </div>
            `;
        });
    } else {
        logsHtml = `<div style="font-size:0.75rem; color:var(--dark-gray); font-style:italic; padding:5px;">No test modifications logged yet.</div>`;
    }
    sidebarAuditLogList.innerHTML = logsHtml;
}

function renderTestManagementSuite(project) {
    const hasModificationAccess = (role === 'admin' || role === 'qa');

    let testingListRowsHtml = '';
    if (project.testSuite && project.testSuite.length > 0) {
        project.testSuite.forEach((item, idx) => {
            let mediaBlockHtml = '';
            if (item.attachments && item.attachments.length > 0) {
                item.attachments.forEach(file => {
                    mediaBlockHtml += file.type.startsWith('image/') ? 
                        `<div class="preview-media-wrapper"><a href="${file.url}" target="_blank"><img src="${file.url}"></a></div>` : 
                        `<div class="preview-media-wrapper"><video src="${file.url}" controls></video></div>`;
                });
            }

            testingListRowsHtml += `
                <div class="test-case-card">
                    <div style="position:absolute; top:1.5rem; right:1.5rem; display:flex; gap:10px; align-items:center;">
                        <span class="role-badge" style="background:#fef3c7; color:#d97706; padding: 4px 8px;">v1.0</span>
                        ${hasModificationAccess ? `
                            <button class="btn-primary" style="background:none; color:var(--accent-blue); font-weight:600; font-size:0.8rem; border:1px solid var(--border-color); padding:4px 8px; border-radius:4px;" onclick="openEditTestCaseModal(${idx})">✎ Edit</button>
                            <button class="btn-primary" style="background:none; color:var(--danger-red); font-weight:600; font-size:0.8rem; border:1px solid #fee; padding:4px 8px; border-radius:4px;" onclick="removeTestCaseItem(${idx})">🗑 Delete</button>
                        ` : ''}
                    </div>
                    <div>
                        <div class="metadata-label" style="color:var(--accent-blue);">Test Scenario</div>
                        <div style="font-weight:700; font-size:1.1rem; margin-top:3px; max-width:80%;">${item.scenario}</div>
                    </div>
                    <div class="test-grid-3">
                        <div>
                            <div class="metadata-label">Acceptance Criteria</div>
                            <div style="font-size:0.85rem; margin-top:4px; line-height:1.4; white-space:pre-wrap;">${item.acceptanceCriteria}</div>
                        </div>
                        <div>
                            <div class="metadata-label">Execution Steps</div>
                            <div style="font-size:0.85rem; margin-top:4px; line-height:1.4; white-space:pre-wrap; color:${!item.steps ? 'var(--dark-gray)' : 'inherit'}; font-style:${!item.steps ? 'italic' : 'normal'};">${item.steps || 'No execution steps specified.'}</div>
                        </div>
                        <div>
                            <div class="metadata-label">Attached Artifact Evidence</div>
                            <div class="media-preview-row">${mediaBlockHtml || '<span style="font-style:italic; font-size:0.8rem; color:var(--dark-gray);">No recordings attached.</span>'}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        testingListRowsHtml = `
            <div style="text-align:center; padding:3rem; color:var(--dark-gray);">
                <p style="font-size:1.5rem; font-weight:500;">No test cases defined.</p>
                <p style="font-size:0.85rem; margin-top:5px;">${hasModificationAccess ? 'Click "+ Add Test Plan" above to create validations.' : 'Review logs here once defined by QA.'}</p>
            </div>
        `;
    }

    wikiContentArea.innerHTML = `
        <div class="wiki-header">
            <div>
                <h2>🧪 Dynamic QA Test Suite</h2>
                <p style="font-size:0.8rem; color:var(--dark-gray); font-weight:500; margin-top:2px;">Integrated scenario mapping</p>
            </div>
            ${hasModificationAccess ? `<button class="btn-primary" onclick="openTestCaseModal()">+ Add Test Plan</button>` : ''}
        </div>
        <div class="test-management-container">${testingListRowsHtml}</div>
    `;
}

// --- SECURE HANDSHAKE DROPZONE UPLOADS ---
async function handleFileDrop(e) {
    e.preventDefault();
    const dropzone = document.getElementById('mediaDropzone');
    dropzone.classList.remove('hover');
    dropzone.textContent = "⏳ Requesting secure S3 channel...";

    const files = e.dataTransfer.files;
    for (let file of files) {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const uniqueFileName = `evidence_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            
            try {
                const signResponse = await fetch(SECURE_UPLOAD_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: uniqueFileName, fileType: file.type })
                });

                if (!signResponse.ok) throw new Error("Handshake failed.");
                const { presignedUrl, publicUrl } = await signResponse.json();

                dropzone.textContent = "⏳ Streaming to AWS S3...";

                const uploadResponse = await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file
                });

                if (!uploadResponse.ok) throw new Error("Upload failed.");

                temporaryAWSMediaUrls.push({ type: file.type, url: publicUrl });
                renderMediaPreviews();
            } catch (err) {
                console.error(err);
                alert("Upload failed.");
            }
        }
    }
    dropzone.textContent = "📂 Drag & Drop Execution Screenshots or Video Recordings here";
}

// --- TEST CASE SUBMISSIONS ---
document.getElementById('testCaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const project = projects.find(p => p.id === currentActiveProjectId);
    const editIndexStr = document.getElementById('editTestCaseIndex').value;
    const scenarioText = document.getElementById('testScenarioInput').value.trim();
    
    const payload = {
        scenario: scenarioText,
        acceptanceCriteria: document.getElementById('testACInput').value.trim(),
        steps: document.getElementById('testStepsInput').value.trim(),
        attachments: temporaryAWSMediaUrls
    };

    if (!project.testSuite) project.testSuite = [];
    if (!project.testHistory) project.testHistory = [];

    let logActionText = "";
    if (editIndexStr !== "") {
        const idx = parseInt(editIndexStr);
        project.testSuite[idx] = payload;
        logActionText = `Updated Scenario: "${scenarioText.substring(0, 25)}..."`;
    } else {
        project.testSuite.push(payload);
        logActionText = `Created Scenario: "${scenarioText.substring(0, 25)}..."`;
    }

    project.testHistory.push({ author: getAuthorName(), timestamp: getCurrentFormattedTimestamp(), action: logActionText });

    try {
        const { error } = await supabaseClient.from('projects').update({ test_suite: project.testSuite, test_history: project.testHistory }).eq('id', project.id);
        if (error) throw error;
        closeTestCaseModal();
        renderWorkspaceContent();
    } catch (err) { console.error(err); }
});

async function removeTestCaseItem(index) {
    if (!confirm("Remove this scenario?")) return;
    const project = projects.find(p => p.id === currentActiveProjectId);
    const deletedScenarioName = project.testSuite[index]?.scenario || "Unknown";
    project.testSuite.splice(index, 1);

    project.testHistory.push({
        author: getAuthorName(),
        timestamp: getCurrentFormattedTimestamp(),
        action: `Deleted Scenario: "${deletedScenarioName.substring(0, 25)}..."`
    });

    try {
        await supabaseClient.from('projects').update({ test_suite: project.testSuite, test_history: project.testHistory }).eq('id', project.id);
        renderWorkspaceContent();
    } catch (err) { console.error(err); }
}