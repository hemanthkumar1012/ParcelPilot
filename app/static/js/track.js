async function trackShipment() {
    const trackingId = document.getElementById('tracking-id').value.trim();
    const errorDiv = document.getElementById('error-message');
    const resultDiv = document.getElementById('tracking-result');
    const timelineDiv = document.getElementById('timeline');
    
    errorDiv.style.display = 'none';
    resultDiv.style.display = 'none';
    timelineDiv.innerHTML = '<div class="state-message">Loading tracking history...</div>';

    if (!trackingId) {
        errorDiv.innerText = 'Please enter a tracking ID.';
        errorDiv.style.display = 'block';
        timelineDiv.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`/api/shipments/track/${trackingId}`);
        if (!response.ok) {
            throw new Error('Shipment not found or invalid ID.');
        }
        
        const data = await response.json();
        
        document.getElementById('res-tracking-id').innerText = data.tracking_id;
        document.getElementById('res-status').innerText = data.current_status.replace(/_/g, ' ');
        document.getElementById('res-status').className = `badge ${data.current_status.toLowerCase()}`;
        document.getElementById('res-origin').innerText = data.origin;
        document.getElementById('res-dest').innerText = data.destination;

        timelineDiv.innerHTML = '';
        if (data.tracking_events.length === 0) {
            timelineDiv.innerHTML = '<div class="state-message">No events found for this shipment.</div>';
        } else {
            data.tracking_events.forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'event';
                
                const date = new Date(event.created_at).toLocaleString();
                let html = `<div class="event-date">${date}</div>
                            <p class="event-desc">${event.status.replace(/_/g, ' ')} - ${event.description}</p>`;
                if (event.location) {
                    html += `<p class="event-loc">${event.location}</p>`;
                }
                
                eventDiv.innerHTML = html;
                timelineDiv.appendChild(eventDiv);
            });
        }

        resultDiv.style.display = 'block';
    } catch (err) {
        errorDiv.innerText = err.message;
        errorDiv.style.display = 'block';
        timelineDiv.innerHTML = '';
    }
}
