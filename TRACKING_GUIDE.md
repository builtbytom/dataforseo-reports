# Usage Tracking & Rate Limiting Guide

## Current Implementation

### 1. **Rate Limiting (Active)**
- **Limit**: 10 requests per hour per IP address
- **Storage**: In-memory (resets when Lambda cold starts)
- **Location**: `netlify/functions/generate-report.js`

### 2. **Basic Logging (Active)**
- All requests logged to Netlify Functions logs
- View at: https://app.netlify.com/sites/YOUR-SITE-NAME/functions/generate-report
- Includes: timestamp, IP, domain, report type, user agent

### 3. **Browser Storage (Demo Only)**
- Stores last 1000 requests in localStorage
- View at: `/admin.html` (password: admin123)
- ⚠️ Remove this in production!

## Better Solutions for Production

### Option 1: **Netlify Analytics** (Easiest)
- $9/month per site
- Zero configuration needed
- Shows all page views, functions calls, and more
- Enable at: Site Settings → Analytics

### Option 2: **Google Sheets as Database** (Free)
```javascript
// Example: Log to Google Sheets
const GOOGLE_SHEETS_URL = 'YOUR_SHEETS_API_URL';

async function logToSheets(data) {
    await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
            timestamp: new Date().toISOString(),
            ...data
        })
    });
}
```

### Option 3: **Upstash Redis** (Free tier: 10k requests/day)
```javascript
// Better rate limiting with Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN
});

async function checkRateLimit(ip) {
    const key = `rate:${ip}`;
    const requests = await redis.incr(key);
    
    if (requests === 1) {
        await redis.expire(key, 3600); // 1 hour
    }
    
    return requests <= 10;
}
```

### Option 4: **Supabase** (Free tier: 500MB database)
- Real-time database with built-in auth
- Perfect for storing usage logs and implementing quotas
- Can create a proper admin dashboard

### Option 5: **Cloudflare Workers + KV** (Free tier: 100k reads/day)
- Move your function to Cloudflare Workers
- Use Workers KV for persistent rate limiting
- Better performance than Netlify Functions

## Implementing User Accounts

To truly prevent abuse, implement user accounts:

### 1. **Netlify Identity** (Free for 1,000 users)
```javascript
// Add to your site
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>

// Check auth in function
const user = context.clientContext?.user;
if (!user) {
    return { statusCode: 401, body: 'Unauthorized' };
}
```

### 2. **Auth0** (Free for 7,000 users)
- More features than Netlify Identity
- Social logins, MFA, etc.

### 3. **Clerk** (Free for 5,000 users)
- Modern auth with great DX
- Built-in user management UI

## Preventing Abuse - Quick Wins

### 1. **Add CAPTCHA**
```html
<!-- Add to form -->
<div class="g-recaptcha" data-sitekey="YOUR_SITE_KEY"></div>

<!-- Verify in backend -->
const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: `secret=${SECRET}&response=${token}`
});
```

### 2. **Require Email**
- Collect email before showing results
- Rate limit by email instead of IP
- Build email list for marketing

### 3. **Add Artificial Delays**
```javascript
// Make it feel more "premium"
await new Promise(resolve => setTimeout(resolve, 3000));
```

### 4. **Domain Whitelist/Blacklist**
```javascript
const BLOCKED_DOMAINS = ['competitor.com', 'scraper.bot'];
if (BLOCKED_DOMAINS.includes(domain)) {
    return { statusCode: 403, body: 'Domain not allowed' };
}
```

## Monitoring API Costs

### DataForSEO Credit Usage
- Historical Rank Overview: ~0.00075 credits
- Google Maps Search: ~0.03 credits
- Total per standard report: ~0.06 credits
- At $0.05 per 1000 credits = $0.000003 per report

### Set Up Alerts
1. DataForSEO Dashboard → Settings → Notifications
2. Set low balance alert (e.g., 10,000 credits)
3. Set daily limit if needed

## Quick Implementation Priority

1. **Now**: Keep current rate limiting, view logs in Netlify
2. **This Week**: Add Google Analytics or Plausible for basic tracking
3. **If Growing**: Implement Upstash Redis for better rate limiting
4. **If Monetizing**: Add Netlify Identity + payment gate

## Environment Variables Needed

Add these to Netlify:
```
# For Redis (if using Upstash)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# For Google Sheets (if using)
GOOGLE_SHEETS_WEBHOOK=

# For reCAPTCHA (if using)
RECAPTCHA_SECRET=
```

## Testing Rate Limits

```bash
# Test rate limiting with curl
for i in {1..15}; do
  curl -X POST https://your-site.netlify.app/.netlify/functions/generate-report \
    -H "Content-Type: application/json" \
    -d '{"domain":"test.com","reportType":"quick"}' \
    -w "\nRequest $i: %{http_code}\n"
  sleep 1
done
```

Should see 200 for first 10, then 429 (rate limited).