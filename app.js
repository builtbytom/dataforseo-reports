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
            
            // Handle rate limit specifically
            if (response.status === 429) {
                const retryMinutes = error.retryAfter ? Math.ceil(error.retryAfter / 60) : 60;
                throw new Error(`Rate limit exceeded. You can generate up to 10 reports per hour. Please try again in ${retryMinutes} minutes.`);
            }
            
            throw new Error(error.message || 'Failed to generate report');
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        currentReport = data;
        displayReport(data);
        
        // Track successful report generation
        trackUsage('report_generated', domain, reportType);
        
        // Store in localStorage for simple admin view (remove in production)
        const logs = JSON.parse(localStorage.getItem('seoToolLogs') || '[]');
        logs.push({
            timestamp: new Date().toISOString(),
            domain: domain,
            reportType: reportType,
            ip: 'browser',
            userAgent: navigator.userAgent
        });
        // Keep last 1000 logs
        if (logs.length > 1000) logs.shift();
        localStorage.setItem('seoToolLogs', JSON.stringify(logs));
        
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
    if (data.detailedBacklinks) {
        console.log('Backlink data:', data.detailedBacklinks);
    }
    
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
    
    
    // Show detailed backlink analysis for detailed reports
    if (data.detailedBacklinks) {
        html += `<h2 style="margin: 2rem 0 1rem;">📊 Detailed Backlink Analysis</h2>`;
        
        // Backlink Overview
        html += `
            <h3 style="margin: 2rem 0 1rem;">🔗 Backlink Profile</h3>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-label">Total Backlinks</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.total)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Referring Domains</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.domains)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Domain Rank</div>
                    <div class="metric-value">${data.detailedBacklinks.main_domain_rank || 'N/A'}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">DoFollow Links</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.dofollow)}</div>
                </div>
            </div>
            
            <div class="metric-grid" style="margin-top: 1rem;">
                <div class="metric">
                    <div class="metric-label">NoFollow Links</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.nofollow)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Gov Links</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.gov)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Edu Links</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.edu)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Unique IPs</div>
                    <div class="metric-value">${formatNumber(data.detailedBacklinks.referring_ips)}</div>
                </div>
            </div>
        `;
        
        // Competitor Backlink Comparison
        if (data.competitorBacklinks && data.competitorBacklinks.length > 0) {
            html += `
                <h3 style="margin: 2rem 0 1rem;">📈 Backlink Comparison</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Total Backlinks</th>
                            <th>Referring Domains</th>
                            <th>Domain Rank</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #e0e7ff;">
                            <td><strong>Your Site (${data.domain})</strong></td>
                            <td><strong>${formatNumber(data.detailedBacklinks.total)}</strong></td>
                            <td><strong>${formatNumber(data.detailedBacklinks.domains)}</strong></td>
                            <td><strong>${data.detailedBacklinks.main_domain_rank || 'N/A'}</strong></td>
                        </tr>
            `;
            
            data.competitorBacklinks.forEach(comp => {
                html += `
                    <tr>
                        <td>${comp.name}</td>
                        <td>${formatNumber(comp.backlinks)}</td>
                        <td>${formatNumber(comp.domains)}</td>
                        <td>${comp.main_domain_rank || 'N/A'}</td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
            `;
        }
        
        // Top Referring Domains
        if (data.topReferringDomains && data.topReferringDomains.length > 0) {
            html += `
                <h3 style="margin: 2rem 0 1rem;">🏆 Top Referring Domains</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Domain Rank</th>
                            <th>Backlinks</th>
                            <th>First Seen</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            data.topReferringDomains.forEach(ref => {
                html += `
                    <tr>
                        <td>${ref.domain}</td>
                        <td>${ref.rank || 'N/A'}</td>
                        <td>${formatNumber(ref.backlinks)}</td>
                        <td>${ref.first_seen ? new Date(ref.first_seen).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
            `;
        }
    }
    
    // Remove old keyword sections
    if (false && data.hasOwnProperty('topKeywords')) {
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

// Simple usage tracking
async function trackUsage(action, domain, reportType) {
    try {
        await fetch('/.netlify/functions/track-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, domain, reportType })
        });
    } catch (e) {
        // Silently fail - don't break the app if tracking fails
        console.log('Tracking failed:', e);
    }
}