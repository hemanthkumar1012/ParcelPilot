document.addEventListener('DOMContentLoaded', () => {
    fetch('/health')
        .then(response => response.json())
        .then(data => {
            const statusDiv = document.getElementById('status');
            if (data.status === 'ok') {
                statusDiv.innerText = 'System Status: Online';
                statusDiv.style.color = 'green';
            } else {
                statusDiv.innerText = 'System Status: Unknown';
                statusDiv.style.color = 'orange';
            }
        })
        .catch(error => {
            console.error('Error fetching health status:', error);
            const statusDiv = document.getElementById('status');
            statusDiv.innerText = 'System Status: Offline';
            statusDiv.style.color = 'red';
        });
});
