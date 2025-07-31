// App state
let currentReport = null;

// Form handling
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let domain = document.getElementById('domain').value.trim();
    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h1 style="margin-bottom: 0.5rem;">SEO Report: ${data.domain}</h1>
                <p style="color: #64748b; margin: 0;">Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            <button onclick="newReport()" style="background: #6366f1; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; font-size: 1rem; cursor: pointer;">
                ← Back to Generator
            </button>
        </div>
    `;
    
    // Debug - show raw data
    console.log('Displaying data:', data);
    console.log('Overview data:', data.overview);
    console.log('Top Keywords:', data.topKeywords);
    console.log('Opportunities:', data.opportunities);
    console.log('Keyword Gaps:', data.keywordGaps);
    
    // Show a message if no data
    if (!data.overview && !data.backlinks && !data.keywords) {
        html += `
            <div class="card" style="text-align: center; padding: 3rem;">
                <h2 style="color: #ef4444; margin-bottom: 1rem;">No Data Available</h2>
                <p style="color: #64748b; margin-bottom: 2rem;">DataForSEO returned no metrics for this domain.</p>
                <p style="color: #64748b;">This could mean:</p>
                <ul style="text-align: left; display: inline-block; color: #64748b;">
                    <li>The domain is too new or small</li>
                    <li>The domain isn't indexed by DataForSEO</li>
                    <li>Try a larger domain like amazon.com or google.com</li>
                </ul>
            </div>
        `;
    }
    
    // Domain Overview
    if (data.overview) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">Domain Overview</h2>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-label">Organic Traffic</div>
                    <div class="metric-value">${formatNumber(Math.round(data.overview.organic_traffic))}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Keywords Ranking</div>
                    <div class="metric-value">${formatNumber(data.overview.organic_keywords)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Traffic Value</div>
                    <div class="metric-value">$${formatNumber(Math.round(data.overview.traffic_value))}</div>
                </div>
            </div>
        `;
    }
    
    // Competitors Section
    if (data.competitors && data.competitors.length > 0) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">Local Competitors (from Google Maps)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Business Name</th>
                        <th>Website</th>
                        <th>Rating</th>
                        <th>Reviews</th>
                        <th>Location</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.competitors.forEach(comp => {
            // Handle both old and new data formats
            if (comp.name) {
                // New Maps format
                html += `
                    <tr>
                        <td>${comp.name}</td>
                        <td>${comp.domain.includes('.') ? comp.domain : 'No website'}</td>
                        <td>${comp.rating}</td>
                        <td>${formatNumber(comp.reviews)}</td>
                        <td style="font-size: 0.9em;">${comp.address}</td>
                    </tr>
                `;
            } else {
                // Old format fallback
                html += `
                    <tr>
                        <td colspan="5">${comp.domain}</td>
                    </tr>
                `;
            }
        });
        
        html += `
                </tbody>
            </table>
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
    
    // Show a special section for detailed reports
    if (data.hasOwnProperty('topKeywords')) {
        html += `<h2 style="margin: 2rem 0 1rem;">📊 Detailed SEO Analysis</h2>`;
    }
    
    // Top Keywords the domain ranks for (Page 1)
    if (data.hasOwnProperty('topKeywords')) {
        if (data.topKeywords.length > 0) {
            html += `
                <h3 style="margin: 2rem 0 1rem;">🏆 Top Ranking Keywords (Page 1)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Keyword</th>
                            <th>Position</th>
                            <th>Monthly Searches</th>
                            <th>URL</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            data.topKeywords.forEach(kw => {
                const shortUrl = kw.url.replace(/^https?:\/\/[^\/]+/, '').substring(0, 40);
                html += `
                    <tr>
                        <td>${kw.keyword}</td>
                        <td style="text-align: center; font-weight: bold; color: ${kw.position <= 3 ? '#10b981' : '#3b82f6'}">#${kw.position}</td>
                        <td>${formatNumber(kw.volume)}</td>
                        <td title="${kw.url}" style="font-size: 0.85em; color: #64748b;">${shortUrl}${shortUrl.length >= 40 ? '...' : ''}</td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
            `;
        } else {
            html += `
                <div style="background: #e0e7ff; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                    <h3 style="margin: 0 0 0.5rem 0;">📊 Keyword Data Note</h3>
                    <p style="margin: 0; color: #3730a3;">DataForSEO may not have complete keyword data for smaller local businesses. Your actual rankings may be better than shown here. For the most accurate data, consider checking specific keywords manually or using Google Search Console.</p>
                </div>
            `;
        }
    }
    
    // Keyword Opportunities (positions 11-30)
    if (data.opportunities && data.opportunities.length > 0) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">🎯 Keyword Opportunities (Quick Wins)</h2>
            <p style="color: #64748b; margin-bottom: 1rem;">Keywords ranking on pages 2-3 that could easily move to page 1</p>
            <table>
                <thead>
                    <tr>
                        <th>Keyword</th>
                        <th>Current Position</th>
                        <th>Monthly Searches</th>
                        <th>Potential Traffic</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.opportunities.forEach(opp => {
            html += `
                <tr>
                    <td>${opp.keyword}</td>
                    <td style="text-align: center; color: #ef4444;">#${opp.position}</td>
                    <td>${formatNumber(opp.volume)}</td>
                    <td style="color: #10b981; font-weight: bold;">+${formatNumber(opp.potential_traffic)} visits/mo</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    // Keyword Gaps (competitor keywords we don't rank for)
    if (data.keywordGaps && data.keywordGaps.length > 0) {
        html += `
            <h2 style="margin: 2rem 0 1rem;">💡 Keyword Gaps</h2>
            <p style="color: #64748b; margin-bottom: 1rem;">Keywords ${data.keywordGaps[0].competitor} ranks for but you don't</p>
            <table>
                <thead>
                    <tr>
                        <th>Keyword</th>
                        <th>Competitor Position</th>
                        <th>Monthly Searches</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.keywordGaps.forEach(gap => {
            html += `
                <tr>
                    <td>${gap.keyword}</td>
                    <td style="text-align: center; color: #3b82f6;">#${gap.competitor_position}</td>
                    <td>${formatNumber(gap.volume)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    // Analyzed Keywords (if user provided specific keywords)
    if (data.analyzedKeywords && data.analyzedKeywords.length > 0) {
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
        
        data.analyzedKeywords.forEach(kw => {
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