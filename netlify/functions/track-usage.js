// Simple usage tracking endpoint
exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }
    
    try {
        const { action, domain, reportType } = JSON.parse(event.body);
        const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
        
        // Log to Netlify Functions logs (viewable in Netlify dashboard)
        console.log('Usage Event:', {
            timestamp: new Date().toISOString(),
            action: action,
            domain: domain,
            reportType: reportType,
            ip: ip,
            userAgent: event.headers['user-agent'],
            referrer: event.headers['referer'] || 'direct'
        });
        
        // Option 1: Send to Google Analytics (if you have it)
        // You would need to set up GA4 Measurement Protocol here
        
        // Option 2: Send to a free service like Segment, Mixpanel, etc.
        // Most have generous free tiers
        
        // Option 3: Send to a Google Sheet via API
        // This is actually a great free option for small projects
        
        return {
            statusCode: 200,
            body: JSON.stringify({ tracked: true })
        };
    } catch (error) {
        console.error('Tracking error:', error);
        return {
            statusCode: 200, // Return 200 anyway so tracking doesn't break the app
            body: JSON.stringify({ tracked: false })
        };
    }
};