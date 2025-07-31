// Netlify Function to generate SEO reports using DataForSEO API
const fetch = require('node-fetch');

// Simple in-memory rate limiting (resets when function cold starts)
const rateLimits = new Map();
const RATE_LIMIT = 10; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(ip) {
    const now = Date.now();
    const userLimits = rateLimits.get(ip) || { count: 0, resetTime: now + RATE_WINDOW };
    
    // Reset if window expired
    if (now > userLimits.resetTime) {
        userLimits.count = 0;
        userLimits.resetTime = now + RATE_WINDOW;
    }
    
    // Check if over limit
    if (userLimits.count >= RATE_LIMIT) {
        const minutesLeft = Math.ceil((userLimits.resetTime - now) / 60000);
        return { allowed: false, minutesLeft };
    }
    
    // Increment and save
    userLimits.count++;
    rateLimits.set(ip, userLimits);
    
    return { allowed: true, remaining: RATE_LIMIT - userLimits.count };
}

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method not allowed' })
        };
    }

    try {
        // Get client IP
        const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
        
        // Check rate limit
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            return {
                statusCode: 429,
                body: JSON.stringify({ 
                    message: `Rate limit exceeded. Try again in ${rateCheck.minutesLeft} minutes.`,
                    retryAfter: rateCheck.minutesLeft * 60
                })
            };
        }
        
        // Parse request body
        const { domain, reportType } = JSON.parse(event.body);
        
        // Log request for tracking
        console.log('Report Request:', {
            timestamp: new Date().toISOString(),
            ip: ip,
            domain: domain,
            reportType: reportType,
            remaining: rateCheck.remaining,
            userAgent: event.headers['user-agent']
        });
        
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
        if (reportType === 'quick' || reportType === 'standard') {
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
                if (reportType === 'standard') {
                    try {
                        // For local businesses, use Google Maps to find actual competitors
                        const businessName = domain.split('.')[0].replace(/[^a-z0-9]/gi, ' ');
                        
                        // First, search Google Maps for the business to get its category AND location
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
                        
                        // Get the business category AND city from the first result
                        let category = 'business';
                        let businessCity = '';
                        if (mapsData.tasks?.[0]?.result?.[0]?.items?.[0]) {
                            const firstResult = mapsData.tasks[0].result[0].items[0];
                            category = firstResult.category || firstResult.place_type || 'business';
                            
                            // Extract city from address
                            if (firstResult.address) {
                                // Address format: "123 Main St, City, ST 12345"
                                const addressParts = firstResult.address.split(',');
                                if (addressParts.length >= 2) {
                                    businessCity = addressParts[addressParts.length - 2].trim();
                                }
                            }
                            console.log('Detected business category:', category);
                            console.log('Business city:', businessCity);
                        }
                        
                        // Now search for similar businesses in the SAME CITY
                        const searchQuery = businessCity ? 
                            `${category} in ${businessCity} Connecticut` : 
                            `${category} near Connecticut`;
                            
                        const competitorSearchResponse = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify([{
                                keyword: searchQuery,
                                location_code: 2840,
                                language_code: 'en',
                                depth: 20
                            }])
                        });
                        
                        console.log('Competitor search query:', searchQuery);
                        
                        const competitorData = await competitorSearchResponse.json();
                        
                        if (competitorData.tasks?.[0]?.result?.[0]?.items) {
                            const mapItems = competitorData.tasks[0].result[0].items;
                            
                            // Filter and sort competitors
                            const competitors = mapItems
                                .filter(item => {
                                    // Skip if no domain or it's the same business
                                    if (!item.domain || item.domain === domain) return false;
                                    
                                    // Skip if it's the same business name
                                    if (item.title && item.title.toLowerCase().includes(businessName.toLowerCase())) return false;
                                    
                                    return true;
                                })
                                .map(item => {
                                    // Extract city from competitor address
                                    let competitorCity = '';
                                    if (item.address) {
                                        const parts = item.address.split(',');
                                        if (parts.length >= 2) {
                                            competitorCity = parts[parts.length - 2].trim();
                                        }
                                    }
                                    
                                    return {
                                        domain: item.domain || item.title,
                                        name: item.title,
                                        rating: item.rating?.value || 'N/A',
                                        reviews: item.rating?.votes_count || 0,
                                        address: item.address || 'N/A',
                                        city: competitorCity,
                                        sameCity: competitorCity === businessCity
                                    };
                                });
                            
                            // Sort by same city first, then by review count
                            competitors.sort((a, b) => {
                                if (a.sameCity && !b.sameCity) return -1;
                                if (!a.sameCity && b.sameCity) return 1;
                                return b.reviews - a.reviews;
                            });
                            
                            // Take top 5, preferring same-city businesses
                            report.competitors = competitors.slice(0, 5).map(comp => ({
                                domain: comp.domain,
                                name: comp.name,
                                rating: comp.rating,
                                reviews: comp.reviews,
                                address: comp.address
                            }));
                            
                            console.log(`Found ${report.competitors.length} local competitors (${competitors.filter(c => c.sameCity).length} in same city)`);
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