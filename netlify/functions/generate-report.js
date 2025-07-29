// Netlify Function to generate SEO reports using DataForSEO API
exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        const { domain, reportType, keywords } = JSON.parse(event.body);
        
        // Get credentials from environment variables
        const login = process.env.DATAFORSEO_LOGIN;
        const password = process.env.DATAFORSEO_PASSWORD;
        
        if (!login || !password) {
            console.log('Environment check:', {
                hasLogin: !!login,
                hasPassword: !!password,
                loginLength: login ? login.length : 0,
                envKeys: Object.keys(process.env).filter(k => k.includes('DATAFORSEO'))
            });
            return {
                statusCode: 500,
                body: JSON.stringify({ message: 'DataForSEO credentials not configured' })
            };
        }
        
        // Create auth header
        const auth = Buffer.from(`${login}:${password}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        };
        
        const report = {
            domain,
            generated_at: new Date().toISOString()
        };
        
        // Quick Overview - just domain metrics
        if (reportType === 'quick' || reportType === 'standard' || reportType === 'detailed') {
            const overviewResponse = await fetch('https://api.dataforseo.com/v3/domain_analytics/google/organic/domain_overview/live', {
                method: 'POST',
                headers,
                body: JSON.stringify([{
                    target: domain,
                    location_code: 2840,
                    language_code: 'en'
                }])
            });
            
            const overviewData = await overviewResponse.json();
            
            if (overviewData.tasks && overviewData.tasks[0] && overviewData.tasks[0].result) {
                const result = overviewData.tasks[0].result[0];
                report.overview = {
                    organic_traffic: result.metrics?.organic?.count || 0,
                    organic_keywords: result.metrics?.organic?.pos_1 || 0,
                    traffic_value: result.metrics?.organic?.etv || 0
                };
            }
        }
        
        // Standard Report - add backlinks
        if (reportType === 'standard' || reportType === 'detailed') {
            const backlinksResponse = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
                method: 'POST',
                headers,
                body: JSON.stringify([{
                    target: domain,
                    internal_list_limit: 10
                }])
            });
            
            const backlinksData = await backlinksResponse.json();
            
            if (backlinksData.tasks && backlinksData.tasks[0] && backlinksData.tasks[0].result) {
                const result = backlinksData.tasks[0].result[0];
                report.backlinks = {
                    total: result.total_backlinks || 0,
                    domains: result.referring_domains || 0,
                    dofollow: result.dofollow || 0
                };
            }
        }
        
        // Detailed Report - add keywords
        if (reportType === 'detailed' && keywords && keywords.length > 0) {
            const keywordsResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
                method: 'POST',
                headers,
                body: JSON.stringify([{
                    keywords: keywords.slice(0, 10), // Limit to 10 keywords to save costs
                    location_code: 2840,
                    language_code: 'en'
                }])
            });
            
            const keywordsData = await keywordsResponse.json();
            
            if (keywordsData.tasks && keywordsData.tasks[0] && keywordsData.tasks[0].result) {
                report.keywords = keywordsData.tasks[0].result.map(item => ({
                    keyword: item.keyword || '',
                    volume: item.search_volume || 0,
                    competition: item.competition || '',
                    cpc: item.cpc || 0
                }));
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify(report)
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: 'Failed to generate report',
                error: error.message 
            })
        };
    }
};