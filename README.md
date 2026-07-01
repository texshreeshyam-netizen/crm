# SignatureReality CRM v1.0
**Complete Real Estate CRM built on Google Apps Script + Google Sheets**

---

## 🚀 Quick Setup (5 Steps)

### Step 1 — Google Sheet बनाएं
1. [Google Sheets](https://sheets.google.com) पर जाएं
2. नई spreadsheet बनाएं: `SignatureReality-CRM-V1`
3. Note: Sheet ID URL में मिलेगा

### Step 2 — Apps Script खोलें
1. Spreadsheet में **Extensions → Apps Script** click करें
2. सारी `.gs` files paste करें (या clasp से deploy करें)
3. `index.html` भी paste करें

### Step 3 — पहली बार Setup करें
1. Apps Script editor में `setupCRM` function run करें
2. Default Admin बन जाएगा:
   - **Email:** admin@signaturereality.com
   - **Password:** Admin@123

### Step 4 — Web App Deploy करें
1. **Deploy → New deployment** click करें
2. Type: **Web app** select करें
3. Execute as: **User accessing the web app**
4. Access: **Anyone with Google Account** (या Anyone)
5. **Deploy** click करें
6. URL copy करें — यही आपका CRM है!

### Step 5 — Login करें
URL खोलें और login करें। Setup complete!

---

## 📁 File Structure

```
Backend (.gs files):
├── Config.gs          — Constants & configuration
├── Utils.gs           — Helper functions
├── Validation.gs      — Data validation
├── Audit.gs           — Activity logging
├── Auth.gs            — Login, session, RBAC + doGet()
├── Leads.gs           — Lead management (CRUD, scoring)
├── Requirement.gs     — Lead requirements
├── Inventory.gs       — Property management
├── MatchingEngine.gs  — Property-lead matching
├── SiteVisit.gs       — Site visit & GPS tracking
├── Negotiation.gs     — Offer/counter-offer tracking
├── TokenDeal.gs       — Token receipts & agreements
├── Commission.gs      — Commission calculation
├── Dashboard.gs       — KPIs & analytics
├── Reports.gs         — Report generation
├── Notifications.gs   — Email & WhatsApp alerts
├── Automation.gs      — Scheduled tasks & triggers
└── Setup.gs           — CRM initialization

Frontend:
└── index.html         — Complete SPA (Single Page App)
```

---

## 🗂️ Google Sheets (Auto-created by setupCRM)

| Sheet | Purpose |
|-------|---------|
| Leads | All lead records |
| Users | User accounts |
| Inventory | Property listings |
| Requirements | Lead requirements |
| Activities | Activity timeline |
| SiteVisits | Visit records |
| Negotiations | Negotiation tracking |
| Tokens | Token receipts |
| Agreements | Deal agreements |
| Commissions | Commission records |
| Config | System settings |
| Permissions | RBAC rules |
| AuditLog | Full audit trail |
| Notifications | Notification log |

---

## 👥 Roles & Permissions

| Role | Access |
|------|--------|
| **Admin** | Full access to everything |
| **Manager** | All modules except system admin |
| **Broker** | Leads, Inventory, Negotiations, Commissions |
| **Agent** | Own leads, Site visits, Negotiations |
| **Builder** | Own inventory, View leads |

---

## ⚙️ Key Configuration (Config Sheet)

| Key | Default | Description |
|-----|---------|-------------|
| Commission_Rate | 2.5 | Default commission % |
| TDS_Rate | 10 | TDS deduction % |
| GST_Rate | 18 | GST % |
| Lead_Score_Hot | 80 | Hot lead threshold |
| Lead_Score_Warm | 50 | Warm lead threshold |
| Inactive_Lead_Days | 30 | Days before inactive alert |
| Company_Email | — | Admin notification email |
| WhatsApp_API_Key | — | WhatsApp Business API key |

---

## 🔄 Automation (Triggers)

Run `setupTriggers()` once to enable:

| Trigger | Frequency | Action |
|---------|-----------|--------|
| `hourlyTask` | Every hour | Run matching engine |
| `dailyMorningTask` | 8 AM daily | Reminders, alerts, reports |
| `dailyCleanupTask` | 2 AM daily | Backup, cleanup |
| `weeklyReportTask` | Monday 9 AM | Weekly report email |

---

## 🎯 Lead Scoring

| Factor | Max Points |
|--------|-----------|
| Budget range | 25 |
| Urgency level | 25 |
| Credibility (email, source) | 25 |
| Engagement (location, type, timeline) | 25 |
| **Total** | **100** |

- 🔴 **Hot:** 80-100
- 🟡 **Warm:** 50-79
- 🔵 **Cold:** 0-49

---

## 💰 Commission Formula

```
Gross = Sale Price × Rate%
TDS   = Gross × 10%
GST   = Gross × 18%
Net   = Gross - TDS - GST
Agent = Net × Agent%
```

---

## 📞 Support
**Project:** SignatureReality CRM v1.0  
**Built:** Google Apps Script + Google Sheets  
**Language:** JavaScript (ES5 compatible for GAS)
