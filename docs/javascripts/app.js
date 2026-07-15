document.addEventListener('DOMContentLoaded', () => {
    const actionBtn = document.getElementById('actionBtn');
    const statusMessage = document.getElementById('statusMessage');

    if (actionBtn && statusMessage) {
        actionBtn.addEventListener('click', () => {
            statusMessage.textContent = 'System Status: Environment is healthy and ready for testing.';
            statusMessage.style.color = '#002F6C'; 
            actionBtn.textContent = 'Verified ✓';
        });
    }
});