// Netlify Function to generate SEO reports using DataForSEO API
const fetch = require('node-fetch');

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
        
        // Log the domain we're checking
        console.log('Checking domain:', domain);
        
        // First, check account status
        try {
            const accountResponse = await fetch('https://api.dataforseo.com/v3/merchant/api/live', {
                method: 'GET',
                headers
            });
            const accountData = await accountResponse.json();
            console.log('Account status:', JSON.stringify(accountData, null, 2));
        } catch (e) {
            console.log('Account check error:', e.message);
        }
        
        // Get REAL domain metrics using DataForSEO Labs
        if (reportType === 'quick' || reportType === 'standard' || reportType === 'detailed') {
            try {
                // Use Domain Metrics endpoint for real data
                const metricsResponse = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/domain_metrics_by_categories/live', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([{
                        target: domain,
                        location_code: 2840,
                        language_code: 'en',
                        include_subdomains: false
                    }])
                });
                
                const metricsData = await metricsResponse.json();
                console.log('Domain Metrics Response:', JSON.stringify(metricsData, null, 2));
                
                if (metricsData.tasks && metricsData.tasks[0] && metricsData.tasks[0].result) {
                    const metrics = metricsData.tasks[0].result[0]?.metrics;
                    if (metrics) {
                        report.overview = {
                            organic_traffic: metrics.organic?.etv || 0,
                            organic_keywords: metrics.organic?.count || 0,
                            traffic_value: metrics.organic?.estimated_paid_traffic_cost || 0,
                            visibility_trend: metrics.organic?.traffic_monthly || []
                        };
                        console.log('Real domain metrics:', report.overview);
                    }
                }
                
                // Also get competitor data for standard/detailed reports
                if (reportType === 'standard' || reportType === 'detailed') {
                    const competitorsResponse = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify([{
                            target: domain,
                            location_code: 2840,
                            language_code: 'en',
                            limit: 5,
                            include_subdomains: false
                        }])
                    });
                    
                    const competitorsData = await competitorsResponse.json();
                    if (competitorsData.tasks && competitorsData.tasks[0] && competitorsData.tasks[0].result) {
                        report.competitors = competitorsData.tasks[0].result[0]?.items?.slice(0, 5).map(comp => ({
                            domain: comp.domain,
                            overlap_keywords: comp.metrics?.organic?.common || 0,
                            their_traffic: comp.metrics?.organic?.etv || 0,
                            their_keywords: comp.metrics?.organic?.count || 0
                        })) || [];
                    }
                }
            } catch (error) {
                console.error('Error fetching domain metrics:', error);
                // Fall back to basic data if Labs API fails
                report.overview = {
                    organic_traffic: 0,
                    organic_keywords: 0,
                    traffic_value: 0
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
        
        // Detailed Report - add top ranking keywords for the domain
        if (reportType === 'detailed') {
            try {
                // Get top keywords this domain ranks for
                const rankedKeywordsResponse = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([{
                        target: domain,
                        location_code: 2840,
                        language_code: 'en',
                        limit: 20,  // Top 20 keywords
                        order_by: ["keyword_data.keyword_info.search_volume,desc"]
                    }])
                });
                
                const rankedData = await rankedKeywordsResponse.json();
                
                if (rankedData.tasks && rankedData.tasks[0] && rankedData.tasks[0].result) {
                    const items = rankedData.tasks[0].result[0]?.items || [];
                    report.topKeywords = items.map(item => ({
                        keyword: item.keyword_data?.keyword || '',
                        position: item.ranked_serp_element?.rank_absolute || 0,
                        volume: item.keyword_data?.keyword_info?.search_volume || 0,
                        difficulty: item.keyword_data?.keyword_info?.competition || 0,
                        cpc: item.keyword_data?.keyword_info?.cpc || 0,
                        url: item.ranked_serp_element?.url || ''
                    }));
                }
                
                // If keywords were provided, also analyze them
                if (keywords && keywords.length > 0) {
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
                        report.analyzedKeywords = keywordsData.tasks[0].result.map(item => ({
                            keyword: item.keyword || '',
                            volume: item.search_volume || 0,
                            competition: item.competition || '',
                            cpc: item.cpc || 0
                        }));
                    }
                }
            } catch (error) {
                console.error('Error fetching keyword data:', error);
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