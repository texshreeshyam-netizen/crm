// ============================================================
// Config.gs — System Configuration & Constants
// Signature Realty CRM V10
// ============================================================

var SHEET_NAMES = {
  LEADS: 'Leads',
  USERS: 'Users',
  AGENTS: 'Agents',
  INVENTORY: 'Inventory',
  BUILDER_PROJECTS: 'BuilderProjects',
  REQUIREMENTS: 'Requirements',
  ACTIVITIES: 'Activities',
  SITE_VISITS: 'SiteVisits',
  NEGOTIATIONS: 'Negotiations',
  TOKENS: 'Tokens',
  AGREEMENTS: 'Agreements',
  COMMISSIONS: 'Commissions',
  REGISTRY: 'Registry',
  REQ_SHARING: 'RequirementSharing',
  CONFIG: 'Config',
  PERMISSIONS: 'Permissions',
  AUDIT_LOG: 'AuditLog',
  REPORTS: 'Reports',
  NOTIFICATIONS: 'Notifications'
};

// Full status funnel as per plan
var LEAD_STATUSES = [
  'New',
  'Telecalling',
  'No Answer',
  'Call Later',
  'Wrong Number',
  'Not Interested',
  'Interested',
  'Verified',
  'Requirement Filled',
  'Matched',
  'Shortlisted',
  'Shared with Client',
  'Site Visit Scheduled',
  'Site Visited',
  'Negotiating',
  'Token Received',
  'Deal Confirmed',
  'Registry',
  'Commission Pending',
  'Closed',
  'No Match',
  'Invalid',
  'Lost',
  'Archived',
  'Inactive'
];

var CALL_DISPOSITIONS = [
  'Interested',
  'No Answer',
  'Call Later',
  'Wrong Number',
  'Not Interested'
];

var NOT_VERIFIED_REASONS = [
  'Wrong Number',
  'Not Interested',
  'Already Purchased',
  'Fake Lead',
  'No Response'
];

var LEAD_TYPES = [
  'End User',
  'Investor',
  'Channel Partner-Broker'
];

var TRANSACTION_TYPES = [
  'Sale',
  'Rent',
  'Lease'
];

// Lead sources as per plan
var LEAD_SOURCES = [
  '99acres',
  'MagicBricks',
  'Housing.com',
  'Facebook',
  'Instagram',
  'Google Ads',
  'Website',
  'Walk-in',
  'Referral',
  'Cold Call',
  'WhatsApp',
  'Other'
];

// Property categories
var PROPERTY_CATEGORIES = [
  'Residential',
  'Commercial',
  'Land-Plot',
  'Industrial'
];

var PROPERTY_TYPES = ['Residential', 'Commercial', 'Industrial', 'Land-Plot'];

var PROPERTY_SUBTYPES = {
  Residential: ['Apartment', 'Villa', 'Row House', 'Bungalow', 'Penthouse', 'Studio', 'Independent Floor'],
  Commercial:  ['Office', 'Shop', 'Showroom', 'Restaurant', 'Clinic', 'Warehouse', 'Co-working Space'],
  'Land-Plot': ['Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Plot'],
  Industrial:  ['Factory', 'Warehouse', 'Logistics Unit', 'Cold Storage', 'Manufacturing Unit']
};

// Listing type as per plan
var LISTING_TYPES = [
  'Owner',
  'Agent-Broker',
  'Builder-Developer'
];

var MARKET_TYPES = [
  'Primary (Builder Direct)',
  'Resale (Owner)',
  'Resale (via Broker)'
];

// Availability statuses as per plan (Available/Hold/Sold/Rented/Withdrawn/Expired)
var PROPERTY_STATUSES = [
  'Available',
  'Hold',
  'Sold',
  'Rented',
  'Leased',
  'Withdrawn',
  'Expired',
  'Pending Verification'
];

var VERIFICATION_STATUSES = [
  'Pending Verification',
  'Verified',
  'Rejected'
];

var ROLES = ['Admin', 'Manager', 'Agent', 'Builder'];

var USER_STATUSES = ['Active', 'Inactive', 'Suspended'];

var SPECIALIZATIONS = ['Residential', 'Commercial', 'Industrial', 'Land-Plot', 'All'];

var FACING_OPTIONS = [
  'North', 'South', 'East', 'West',
  'North-East', 'North-West', 'South-East', 'South-West'
];

var FURNISHING_OPTIONS = [
  'Unfurnished',
  'Semi-Furnished',
  'Fully Furnished'
];

var POSSESSION_OPTIONS = [
  'Ready to Move',
  'Under Construction',
  'New Launch',
  'Any'
];

var URGENCY_LEVELS = [
  'Immediate',
  '1-3 months',
  '3-6 months',
  'Just Exploring'
];

var FUNDING_TYPES = [
  'Self-funded',
  'Home Loan',
  'Pre-approved Loan',
  'Loan Process Pending'
];

var TENANT_TYPES = [
  'Family',
  'Bachelor Male',
  'Bachelor Female',
  'Bachelor Group',
  'Working Professional',
  'Couple'
];

var PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'RTGS', 'NEFT', 'Other'];

var COMMISSION_PAYMENT_STATUSES = ['Pending', 'Partial', 'Paid', 'Failed'];

var VISIT_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];

var NEGOTIATION_STATUSES = ['InProgress', 'Agreed', 'Failed'];

var TOKEN_STATUSES = ['Received', 'Cancelled', 'Refunded'];

var PURPOSE_OPTIONS = ['Self Use', 'Investment', 'Rental Income'];

var DECISION_MAKERS = ['Self', 'Spouse', 'Family Approval Needed'];

var LOCATION_STRICTNESS = ['Strict', 'Flexible'];

var PROXIMITY_REQUIREMENTS = ['Metro', 'School', 'Hospital', 'Workplace', 'Highway', 'Market'];

var BUILDER_PROJECT_STATUSES = ['Pre-launch', 'Launched', 'Under Construction', 'Ready', 'Sold Out', 'On Hold'];

var LAUNCH_STATUSES = ['Pre-launch', 'Launched', 'Under Construction', 'Ready'];

var REQUIREMENT_TYPES = ['Purchase', 'Sale', 'Rent', 'Rent Out'];

var CLIENT_REACTIONS = ['Interested', 'Not Interested', 'No Response'];

var SHARED_VIA_OPTIONS = ['WhatsApp', 'Email', 'WhatsApp Link', 'In Person'];

// ---- Runtime Config (loaded from Config sheet) ----

function getConfig(key) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        var val = data[i][1];
        var type = data[i][2];
        if (type === 'Number') return Number(val);
        if (type === 'Boolean') return val === 'true' || val === true;
        return String(val);
      }
    }
    return null;
  } catch (e) {
    Logger.log('getConfig error: ' + e);
    return null;
  }
}

function setConfig(key, value, type, description) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!sheet) return false;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        return true;
      }
    }
    sheet.appendRow([key, value, type || 'String', description || '']);
    return true;
  } catch (e) {
    Logger.log('setConfig error: ' + e);
    return false;
  }
}

function getAllConfigs() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!sheet) return {};
    var data = sheet.getDataRange().getValues();
    var configs = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        var val = data[i][1];
        var type = data[i][2];
        if (type === 'Number') val = Number(val);
        else if (type === 'Boolean') val = val === 'true' || val === true;
        configs[data[i][0]] = val;
      }
    }
    return configs;
  } catch (e) {
    Logger.log('getAllConfigs error: ' + e);
    return {};
  }
}

function getLeadScoreThresholds() {
  return {
    hot: getConfig('Lead_Score_Hot') || 80,
    warm: getConfig('Lead_Score_Warm') || 50
  };
}

function getCommissionDefaults() {
  return {
    rate: getConfig('Commission_Rate') || 2.5,
    tdsRate: getConfig('TDS_Rate') || 10,
    gstRate: getConfig('GST_Rate') || 18
  };
}

function getSystemSettings() {
  return {
    maxLeadsPerPage: getConfig('Max_Leads_Per_Page') || 50,
    sessionTimeout: getConfig('Session_Timeout') || 30,
    companyName: getConfig('Company_Name') || 'Signature Realty',
    companyEmail: getConfig('Company_Email') || '',
    whatsappApiKey: getConfig('WhatsApp_API_Key') || '',
    inactiveLeadDays: getConfig('Inactive_Lead_Days') || 30,
    staleInventoryDays: getConfig('Stale_Inventory_Days') || 60
  };
}

var DEFAULT_CONFIGS = [
  ['Commission_Rate', 2.5, 'Number', 'Default commission rate %'],
  ['Lead_Score_Hot', 80, 'Number', 'Score threshold for Hot'],
  ['Lead_Score_Warm', 50, 'Number', 'Score threshold for Warm'],
  ['Max_Leads_Per_Page', 50, 'Number', 'Pagination limit'],
  ['Session_Timeout', 30, 'Number', 'Session timeout in minutes'],
  ['TDS_Rate', 10, 'Number', 'TDS rate %'],
  ['GST_Rate', 18, 'Number', 'GST rate %'],
  ['Company_Name', 'Signature Realty', 'String', 'Company name'],
  ['Company_Email', '', 'String', 'Company email for reports/alerts'],
  ['WhatsApp_API_Key', '', 'String', 'WhatsApp Business API key (optional)'],
  ['Inactive_Lead_Days', 30, 'Number', 'Days before marking lead inactive'],
  ['Stale_Inventory_Days', 60, 'Number', 'Days before stale inventory alert'],
  ['Auto_Matching_Enabled', true, 'Boolean', 'Enable hourly auto-matching'],
  ['Daily_Backup_Enabled', true, 'Boolean', 'Enable daily backup to Drive'],
  ['Email_Notifications', true, 'Boolean', 'Enable email notifications'],
  ['Mandate_Expiry_Alert_Days', 7, 'Number', 'Days before mandate expiry to alert'],
  ['Listing_Expiry_Alert_Days', 7, 'Number', 'Days before listing expiry to alert'],
  ['Follow_Up_Overdue_Days', 3, 'Number', 'Days after no action to trigger overdue alert']
];
