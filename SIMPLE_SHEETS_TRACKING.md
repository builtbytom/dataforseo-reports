# Simple Google Sheets Tracking

## Step 1: Create a Google Sheet

1. Create a new Google Sheet
2. Add headers in row 1: `Timestamp | IP | Domain | Report Type | User Agent`

## Step 2: Create Google Apps Script

1. In your Google Sheet, go to Extensions → Apps Script
2. Replace the code with:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  
  sheet.appendRow([
    new Date().toISOString(),
    data.ip || 'unknown',
    data.domain,
    data.reportType,
    data.userAgent || 'unknown'
  ]);
  
  return ContentService
    .createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click Deploy → New Deployment
4. Choose type: Web app
5. Execute as: Me
6. Who has access: Anyone
7. Copy the Web app URL

## Step 3: Add to Your Function

Add this to `netlify/functions/generate-report.js` after the report is generated:

```javascript
// Send to Google Sheets
if (process.env.GOOGLE_SHEETS_WEBHOOK) {
    try {
        await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: ip,
                domain: domain,
                reportType: reportType,
                userAgent: event.headers['user-agent']
            })
        });
    } catch (e) {
        console.log('Failed to log to sheets:', e);
    }
}
```

## Step 4: Add Environment Variable

In Netlify dashboard:
1. Site settings → Environment variables
2. Add variable:
   - Key: `GOOGLE_SHEETS_WEBHOOK`
   - Value: Your Google Apps Script URL

## That's it!

Every request will now be logged to your Google Sheet. You can:
- See all requests in real-time
- Create charts and graphs
- Set up email alerts with Apps Script
- Export to CSV anytime

No databases, no complex auth, just a simple spreadsheet!