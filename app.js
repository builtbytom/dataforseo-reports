// App state
let currentReport = null;

// Form handling
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const domain = document.getElementById('domain').value.trim();
    const reportType = document.querySelector('input[name="reportType"]:checked').value;
    const keywordsText = document.getElementById('keywords').value;
    const keywords = keywordsText ? keywordsText.split(',').map(k => k.trim()).filter(k => k) : [];
    
    // Show loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    document.querySelector('button[type="submit"]').disabled = true;
    
    try {
        console.log('Calling function with:', { domain, reportType, keywords });
        
        // Call our Netlify function
        const response = await fetch('/.netlify/functions/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                domain,
                reportType,
                keywords
            })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            let error;
            try {
                error = JSON.parse(errorText);
            } catch {
                error = { message: errorText };
            }
            throw new Error(error.message || 'Failed to generate report');
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        currentReport = data;
        displayReport(data);
        
    } catch (error) {
        console.error('Full error:', error);
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = error.message || 'Failed to generate report. Please try again.';
    } finally {
        document.getElementById('loading').style.display = 'none';
        document.querySelector('button[type="submit"]').disabled = false;
    }
});

// Report type change handler
document.querySelectorAll('input[name="reportType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const keywordsGroup = document.getElementById('keywordsGroup');
        keywordsGroup.style.display = e.target.value === 'detailed' ? 'block' : 'none';
    });
});

// Display report
function displayReport(data) {
    document.getElementById('generatorCard').style.display = 'none';
    document.getElementById('reportDisplay').style.display = 'block';
    
    let html = `
        <h1 style="margin-bottom: 1rem;">SEO Report: ${data.domain}</h1>
        <p style="color: #64748b; margin-bottom: 2rem;">Generated on ${new Date().toLocaleDateString()}</p>
    `;
    
    // Domain Overview
    if (data.overview) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">Domain Overview</h2>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-label">Organic Traffic</div>
                    <div class="metric-value">${formatNumber(data.overview.organic_traffic)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Keywords Ranking</div>
                    <div class="metric-value">${formatNumber(data.overview.organic_keywords)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Traffic Value</div>
                    <div class="metric-value">$${formatNumber(data.overview.traffic_value)}</div>
                </div>
            </div>
        `;
    }
    
    // Backlinks
    if (data.backlinks) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">Backlink Profile</h2>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-label">Total Backlinks</div>
                    <div class="metric-value">${formatNumber(data.backlinks.total)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Referring Domains</div>
                    <div class="metric-value">${formatNumber(data.backlinks.domains)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">DoFollow Links</div>
                    <div class="metric-value">${formatNumber(data.backlinks.dofollow)}</div>
                </div>
            </div>
        `;
    }
    
    // Keywords
    if (data.keywords && data.keywords.length > 0) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">Keyword Analysis</h2>
            <table>
                <thead>
                    <tr>
                        <th>Keyword</th>
                        <th>Monthly Searches</th>
                        <th>Competition</th>
                        <th>CPC</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.keywords.forEach(kw => {
            html += `
                <tr>
                    <td>${kw.keyword}</td>
                    <td>${formatNumber(kw.volume)}</td>
                    <td>${kw.competition || 'N/A'}</td>
                    <td>$${kw.cpc.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    document.getElementById('reportContent').innerHTML = html;
}

// Helper functions
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function shareReport() {
    // In a real app, this would save the report and generate a unique URL
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Report link copied to clipboard!');
    });
}

function newReport() {
    document.getElementById('generatorCard').style.display = 'block';
    document.getElementById('reportDisplay').style.display = 'none';
    document.getElementById('reportForm').reset();
    currentReport = null;
}