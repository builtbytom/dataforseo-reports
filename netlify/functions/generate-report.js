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
        
        // First, check account balance and status
        try {
            const balanceResponse = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
                method: 'GET',
                headers
            });
            const balanceData = await balanceResponse.json();
            console.log('Account balance check:', {
                status: balanceData.status_code,
                balance: balanceData.tasks?.[0]?.data?.money?.balance,
                message: balanceData.status_message
            });
        } catch (e) {
            console.log('Balance check error:', e.message);
        }
        
        // Get REAL domain metrics using DataForSEO Labs
        if (reportType === 'quick' || reportType === 'standard' || reportType === 'detailed') {
            try {
                // Try Historical Rank Overview for traffic data
                const historyResponse = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/historical_rank_overview/live', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([{
                        target: domain,
                        location_code: 2840,
                        language_code: 'en',
                        date_from: '2025-01-01'
                    }])
                });
                
                const historyData = await historyResponse.json();
                console.log('Historical API Response:', JSON.stringify(historyData, null, 2));
                
                if (historyData.tasks && historyData.tasks[0]) {
                    const task = historyData.tasks[0];
                    
                    // Check for API errors
                    if (task.status_code !== 20000) {
                        console.error('API Error:', task.status_message);
                        throw new Error(task.status_message || 'API request failed');
                    }
                    
                    if (task.result && task.result[0] && task.result[0].items && task.result[0].items.length > 0) {
                        // Get the most recent data point
                        const latestData = task.result[0].items[task.result[0].items.length - 1];
                        report.overview = {
                            organic_traffic: Math.round(latestData.metrics?.organic?.etv || 0),
                            organic_keywords: latestData.metrics?.organic?.count || 0,
                            traffic_value: Math.round(latestData.metrics?.organic?.estimated_paid_traffic_cost || 0)
                        };
                        console.log('Domain metrics from history:', report.overview);
                    } else {
                        console.log('No historical data found for domain');
                    }
                }
                
                // Get competitor data using Google Maps for local businesses
                if (reportType === 'standard' || reportType === 'detailed') {
                    try {
                        // For local businesses, use Google Maps to find actual competitors
                        const businessName = domain.split('.')[0].replace(/[^a-z0-9]/gi, ' ');
                        
                        // First, search Google Maps for the business to get its category
                        const mapsSearchResponse = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify([{
                                keyword: businessName + ' Connecticut',
                                location_code: 2840,
                                language_code: 'en'
                            }])
                        });
                        
                        const mapsData = await mapsSearchResponse.json();
                        console.log('Maps Search Response:', mapsData.tasks?.[0]?.status_message);
                        
                        // Get the business category from the first result
                        let category = 'business';
                        if (mapsData.tasks?.[0]?.result?.[0]?.items?.[0]) {
                            const firstResult = mapsData.tasks[0].result[0].items[0];
                            category = firstResult.category || firstResult.place_type || 'business';
                            console.log('Detected business category:', category);
                        }
                        
                        // Now search for similar businesses in the area
                        const competitorSearchResponse = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify([{
                                keyword: category + ' near Connecticut',
                                location_code: 2840,
                                language_code: 'en',
                                depth: 20
                            }])
                        });
                        
                        const competitorData = await competitorSearchResponse.json();
                        
                        if (competitorData.tasks?.[0]?.result?.[0]?.items) {
                            const mapItems = competitorData.tasks[0].result[0].items;
                            
                            // Extract competitor info from Maps results
                            report.competitors = mapItems
                                .filter(item => item.domain && item.domain !== domain)
                                .slice(0, 5)
                                .map(item => ({
                                    domain: item.domain || item.title,
                                    name: item.title,
                                    rating: item.rating?.value || 'N/A',
                                    reviews: item.rating?.votes_count || 0,
                                    address: item.address || 'N/A'
                                }));
                            
                            console.log(`Found ${report.competitors.length} local competitors`);
                        } else {
                            report.competitors = [];
                        }
                    } catch (error) {
                        console.error('Error finding Maps competitors:', error);
                        report.competitors = [];
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