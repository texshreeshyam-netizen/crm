// ============================================================
// Automation.gs — Scheduled Tasks & Triggers
// Signature Realty CRM V10
// ============================================================

// ---- Trigger Setup ----

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // Hourly: matching engine + reminders
  ScriptApp.newTrigger('hourlyTask').timeBased().everyHours(1).create();
  // Daily 8 AM: follow-ups, alerts, overdue checks
  ScriptApp.newTrigger('dailyMorningTask').timeBased().atHour(8).everyDays(1).create();
  // Daily 2 AM: backup + cleanup + auto-task rules
  ScriptApp.newTrigger('dailyCleanupTask').timeBased().atHour(2).everyDays(1).create();
  // Weekly Monday 9 AM: weekly report
  ScriptApp.newTrigger('weeklyReportTask').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

  Logger.log('Triggers set up successfully (4 triggers)');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('All triggers removed');
}

// ---- Hourly Task ----

function hourlyTask() {
  try {
    Logger.log('Hourly task started: ' + new Date());
    hourlyMatchingEngine();
    sendUpcomingVisitReminders();
    Logger.log('Hourly task complete');
  } catch(e) {
    Logger.log('hourlyTask error: ' + e);
  }
}

// ---- Daily Morning Task (8 AM) ----

function dailyMorningTask() {
  try {
    Logger.log('Daily morning task started: ' + new Date());
    sendTodaysVisitReminders();      // Today's site visit reminders
    auditInactiveLeads();            // Mark leads with no action as inactive
    sendDueFollowUps();              // Follow-up overdue alerts (plan: 3 days no action)
    checkMandateExpiries();          // Owner exclusive mandate expiry alerts
    checkListingExpiries();          // Listing validity expiry alerts
    checkBuilderPossessionDates();   // Possession dates nearing
    generateDailyReportEmail();      // Daily summary to admin
    Logger.log('Daily morning task complete');
  } catch(e) {
    Logger.log('dailyMorningTask error: ' + e);
  }
}

// ---- Daily Cleanup Task (2 AM) ----

function dailyCleanupTask() {
  try {
    Logger.log('Daily cleanup started: ' + new Date());
    dailyBackup();
    cleanOldAuditLogs();
    archiveOldLeads();
    autoExpireListings();            // Auto-expire listings past validity date
    checkStaleInventory();           // Alert on properties unsold 60+ days
    updateDaysInInventory();         // Refresh DaysInInventory column nightly
    Logger.log('Daily cleanup complete');
  } catch(e) {
    Logger.log('dailyCleanupTask error: ' + e);
  }
}

// ---- Weekly Report (Monday 9 AM) ----

function weeklyReportTask() {
  try {
    Logger.log('Weekly report task started');
    generateWeeklyReportEmail();
    Logger.log('Weekly report complete');
  } catch(e) {
    Logger.log('weeklyReportTask error: ' + e);
  }
}

// ======================================================
// AUTO TASK RULES (as per V10 Plan)
// ======================================================

// Trigger: New lead → Task "Verify lead (today)"
function onNewLeadCreated(leadId) {
  try {
    appendActivity(leadId, 'system', 'Auto Task', 'Verify this lead today');
    Logger.log('Auto task created: Verify lead ' + leadId);
  } catch(e) { Logger.log('onNewLeadCreated task: ' + e); }
}

// Trigger: Lead Verified → Task "Take full requirement"
function onLeadVerified(leadId) {
  try {
    appendActivity(leadId, 'system', 'Auto Task', 'Lead verified — take full requirement now');
  } catch(e) { Logger.log('onLeadVerified task: ' + e); }
}

// Trigger: Requirement Filled → Task "Prepare shortlist"
function onRequirementFilled(leadId) {
  try {
    appendActivity(leadId, 'system', 'Auto Task', 'Requirement captured — prepare property shortlist');
  } catch(e) { Logger.log('onRequirementFilled task: ' + e); }
}

// Trigger: Shortlist Ready → Task "Call & share with client"
function onShortlistReady(leadId) {
  try {
    appendActivity(leadId, 'system', 'Auto Task', 'Shortlist ready — call client & share');
  } catch(e) { Logger.log('onShortlistReady task: ' + e); }
}

// Trigger: Visit Scheduled → "Take visit feedback (next day)"
function onVisitScheduled(leadId, visitDate) {
  try {
    var feedbackDate = new Date(visitDate);
    feedbackDate.setDate(feedbackDate.getDate() + 1);
    appendActivity(leadId, 'system', 'Auto Task',
      'Take visit feedback after visit on ' + formatDate(visitDate) +
      ' | Feedback due: ' + formatDate(feedbackDate));
  } catch(e) { Logger.log('onVisitScheduled task: ' + e); }
}

// Trigger: Broker submits property → "Verify new property" → Admin
function onBrokerPropertySubmitted(propertyId, agentName) {
  try {
    var adminEmail = getConfig('Company_Email');
    if (adminEmail) {
      sendEmail(adminEmail,
        'New Property Submitted for Verification: ' + propertyId,
        'Agent ' + agentName + ' has submitted property ' + propertyId + ' for verification.\n\nPlease review and verify in the CRM Inventory module.'
      );
    }
    Logger.log('Auto task: Verify property ' + propertyId);
  } catch(e) { Logger.log('onBrokerPropertySubmitted task: ' + e); }
}

// ======================================================
// FOLLOW-UP AUTOMATION
// ======================================================

function sendDueFollowUps() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var overdueDays = getConfig('Follow_Up_Overdue_Days') || 3;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - overdueDays);

    var activeStatuses = [
      'New', 'Telecalling', 'Interested', 'Verified',
      'Requirement Filled', 'Matched', 'Shortlisted',
      'Shared with Client', 'Site Visit Scheduled', 'Site Visited', 'Negotiating'
    ];

    var overdueLeads = leads.filter(function(l) {
      if (activeStatuses.indexOf(l.LeadStatus) === -1) return false;
      var lastAction = new Date(l.LastActionDate || l.DateCreated || new Date());
      return lastAction < cutoff;
    });

    overdueLeads.forEach(function(l) {
      sendFollowUpReminder(l.LeadID);
    });
    Logger.log('Overdue follow-up alerts sent: ' + overdueLeads.length);
  } catch(e) { Logger.log('sendDueFollowUps: ' + e); }
}

function auditInactiveLeads() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var inactiveDays = getConfig('Inactive_Lead_Days') || 30;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    var finalStatuses = ['Closed', 'Invalid', 'Archived', 'Inactive', 'Lost', 'Not Interested'];

    var inactiveLeads = leads.filter(function(l) {
      if (finalStatuses.indexOf(l.LeadStatus) !== -1) return false;
      var lastAction = new Date(l.LastActionDate || l.LastModifiedDate || l.DateCreated || new Date());
      return lastAction < cutoff;
    });

    inactiveLeads.forEach(function(l) {
      var row = findRowById(SHEET_NAMES.LEADS, 'LeadID', l.LeadID);
      if (!row) return;
      var headers = getHeaders(SHEET_NAMES.LEADS);
      var stIdx = headers.indexOf('LeadStatus');
      if (stIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, row._row, stIdx + 1, 'Inactive');
      sendOverdueLeadAlert(l.LeadID);
    });
    Logger.log('Inactive leads marked: ' + inactiveLeads.length);
  } catch(e) { Logger.log('auditInactiveLeads: ' + e); }
}

// ======================================================
// SITE VISIT REMINDERS
// ======================================================

function sendUpcomingVisitReminders() {
  try {
    var visits = getSheetData(SHEET_NAMES.SITE_VISITS);
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    var dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    var upcoming = visits.filter(function(v) {
      var d = new Date(v.ScheduledDate);
      return v.Status === 'Scheduled' && d >= tomorrow && d < dayAfter;
    });
    upcoming.forEach(function(v) { sendSiteVisitReminder(v.VisitID); });
    Logger.log('Sent ' + upcoming.length + ' upcoming visit reminders');
  } catch(e) { Logger.log('sendUpcomingVisitReminders: ' + e); }
}

function sendTodaysVisitReminders() {
  try {
    var todayVisits = getTodaysVisits();
    todayVisits.forEach(function(v) { sendSiteVisitReminder(v.VisitID); });
    Logger.log('Today visit reminders: ' + todayVisits.length);
  } catch(e) { Logger.log('sendTodaysVisitReminders: ' + e); }
}

// ======================================================
// INVENTORY AUTOMATION (as per V10 Plan)
// ======================================================

// 1. Stale Inventory Alert (60–90 days unsold)
function checkStaleInventory() {
  try {
    var staleDays = getConfig('Stale_Inventory_Days') || 60;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleDays);

    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var stale = props.filter(function(p) {
      return p.AvailabilityStatus === 'Available' &&
             p.CreatedDate && new Date(p.CreatedDate) < cutoff;
    });

    stale.forEach(function(p) {
      sendStaleInventoryAlert(p.PropertyID, p.AddedByAgent, daysBetween(p.CreatedDate, new Date()));
    });
    Logger.log('Stale inventory alerts sent: ' + stale.length);
  } catch(e) { Logger.log('checkStaleInventory: ' + e); }
}

// 2. Exclusive Mandate Expiry Alert
function checkMandateExpiries() {
  try {
    var alertDays = getConfig('Mandate_Expiry_Alert_Days') || 7;
    var alertCutoff = new Date();
    alertCutoff.setDate(alertCutoff.getDate() + alertDays);
    var today = new Date();

    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var expiring = props.filter(function(p) {
      return p.ExclusiveMandate === 'Yes' &&
             p.MandateValidityDate &&
             new Date(p.MandateValidityDate) > today &&
             new Date(p.MandateValidityDate) <= alertCutoff;
    });

    expiring.forEach(function(p) {
      sendMandateExpiryAlert(p.PropertyID, p.AddedByAgent, p.MandateValidityDate);
    });
    Logger.log('Mandate expiry alerts sent: ' + expiring.length);
  } catch(e) { Logger.log('checkMandateExpiries: ' + e); }
}

// 3. Listing Validity Expiry
function checkListingExpiries() {
  try {
    var alertDays = getConfig('Listing_Expiry_Alert_Days') || 7;
    var alertCutoff = new Date();
    alertCutoff.setDate(alertCutoff.getDate() + alertDays);
    var today = new Date();

    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var expiring = props.filter(function(p) {
      return p.AvailabilityStatus === 'Available' &&
             p.ListingValidityExpiry &&
             new Date(p.ListingValidityExpiry) > today &&
             new Date(p.ListingValidityExpiry) <= alertCutoff;
    });

    expiring.forEach(function(p) {
      sendListingExpiryAlert(p.PropertyID, p.AddedByAgent, p.ListingValidityExpiry);
    });
    Logger.log('Listing expiry alerts sent: ' + expiring.length);
  } catch(e) { Logger.log('checkListingExpiries: ' + e); }
}

// 4. Auto-Expire Listings Past Validity Date
function autoExpireListings() {
  try {
    var today = new Date();
    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var expired = props.filter(function(p) {
      return p.AvailabilityStatus === 'Available' &&
             p.ListingValidityExpiry &&
             new Date(p.ListingValidityExpiry) < today;
    });

    expired.forEach(function(p) {
      var row = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', p.PropertyID);
      if (!row) return;
      var headers = getHeaders(SHEET_NAMES.INVENTORY);
      var stIdx = headers.indexOf('AvailabilityStatus');
      var lstIdx = headers.indexOf('LastStatusUpdateDate');
      if (stIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, row._row, stIdx + 1, 'Expired');
      if (lstIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, row._row, lstIdx + 1, today);
    });
    Logger.log('Auto-expired listings: ' + expired.length);
  } catch(e) { Logger.log('autoExpireListings: ' + e); }
}

// 5. Builder Project Possession Date Nearing (30 days)
function checkBuilderPossessionDates() {
  try {
    var warnDays = 30;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + warnDays);
    var today = new Date();

    var projects = getSheetData(SHEET_NAMES.BUILDER_PROJECTS);
    var nearing = projects.filter(function(p) {
      return p.PossessionDateExpected &&
             new Date(p.PossessionDateExpected) > today &&
             new Date(p.PossessionDateExpected) <= cutoff &&
             p.ProjectStatus === 'Under Construction';
    });

    nearing.forEach(function(p) {
      sendBuilderPossessionAlert(p.ProjectID, p.ProjectName, p.PossessionDateExpected);
    });
    Logger.log('Builder possession alerts sent: ' + nearing.length);
  } catch(e) { Logger.log('checkBuilderPossessionDates: ' + e); }
}

// 6. Update DaysInInventory for all available properties
function updateDaysInInventory() {
  try {
    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var headers = getHeaders(SHEET_NAMES.INVENTORY);
    var diIdx = headers.indexOf('DaysInInventory');
    if (diIdx === -1) return;

    props.forEach(function(p) {
      if (p.CreatedDate) {
        var days = daysBetween(p.CreatedDate, new Date());
        updateSheetCell(SHEET_NAMES.INVENTORY, p._row, diIdx + 1, days);
      }
    });
    Logger.log('DaysInInventory updated for ' + props.length + ' properties');
  } catch(e) { Logger.log('updateDaysInInventory: ' + e); }
}

// 7. Hold follow-up (3 days after going on Hold)
function checkHoldProperties() {
  try {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);

    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var staleHolds = props.filter(function(p) {
      return p.AvailabilityStatus === 'Hold' &&
             p.LastStatusUpdateDate &&
             new Date(p.LastStatusUpdateDate) < cutoff;
    });

    staleHolds.forEach(function(p) {
      sendHoldFollowUpAlert(p.PropertyID, p.AddedByAgent, p.HoldLeadID);
    });
    Logger.log('Hold follow-up alerts: ' + staleHolds.length);
  } catch(e) { Logger.log('checkHoldProperties: ' + e); }
}

// ======================================================
// REPORTS
// ======================================================

function generateDailyReportEmail() {
  try {
    var adminEmail = getConfig('Company_Email');
    if (!adminEmail) return;
    var summary = generateMonthlySummary();
    if (!summary.success) return;
    var d = summary.data;
    var propStats = getPropertyStats();
    var body = 'Signature Realty CRM — Daily Report\n' +
      'Date: ' + formatDate(new Date()) + '\n\n' +
      '=== LEADS ===\n' +
      'New Leads Today: ' + (d.newLeads || 0) + '\n' +
      'Closed Deals: ' + (d.closedDeals || 0) + '\n' +
      'Hot Leads: ' + (d.hotLeads || 0) + '\n\n' +
      '=== INVENTORY ===\n' +
      'Total Properties: ' + propStats.total + '\n' +
      'Available: ' + propStats.available + '\n' +
      'Pending Verification: ' + propStats.pendingVerification + '\n' +
      'Stale (60+ days): ' + propStats.stale + '\n\n' +
      'This is an automated daily report from Signature Realty CRM V10.';
    sendEmail(adminEmail, 'Daily CRM Report - ' + formatDate(new Date()), body);
  } catch(e) { Logger.log('generateDailyReportEmail: ' + e); }
}

function generateWeeklyReportEmail() {
  try {
    var adminEmail = getConfig('Company_Email');
    if (!adminEmail) return;
    var summary = generateMonthlySummary();
    if (!summary.success) return;
    var d = summary.data;
    var propStats = getPropertyStats();
    var body = 'Signature Realty CRM — Weekly Report\n' +
      'Week of: ' + formatDate(new Date()) + '\n\n' +
      '=== LEADS ===\n' +
      'Total: ' + (d.newLeads || 0) + '\n' +
      'Deals Closed: ' + (d.closedDeals || 0) + '\n' +
      'Pipeline:\n' + (d.pipeline || []).map(function(p) { return '  ' + p.stage + ': ' + p.count; }).join('\n') + '\n\n' +
      '=== INVENTORY ===\n' +
      'Total: ' + propStats.total + ' | Available: ' + propStats.available +
      ' | Sold: ' + propStats.sold + ' | Rented: ' + propStats.rented + '\n' +
      'Owner: ' + (propStats.byListingType['Owner'] || 0) +
      ' | Broker: ' + (propStats.byListingType['Agent-Broker'] || 0) +
      ' | Builder: ' + (propStats.byListingType['Builder-Developer'] || 0) + '\n' +
      'Avg Days in Inventory: ' + propStats.avgDaysInInventory + '\n\n' +
      'Signature Realty CRM V10 — Automated Weekly Report';
    sendEmail(adminEmail, 'Weekly CRM Report - ' + formatDate(new Date()), body);
  } catch(e) { Logger.log('generateWeeklyReportEmail: ' + e); }
}

// ======================================================
// BACKUP & CLEANUP
// ======================================================

function dailyBackup() {
  try {
    if (!getConfig('Daily_Backup_Enabled')) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var backupName = 'SignatureRealtyCRM_Backup_' +
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    var file = DriveApp.getFileById(ss.getId());
    var backupFolder;
    var folders = DriveApp.getFoldersByName('CRM_Backups');
    if (folders.hasNext()) {
      backupFolder = folders.next();
    } else {
      backupFolder = DriveApp.createFolder('CRM_Backups');
    }
    file.makeCopy(backupName, backupFolder);
    Logger.log('Daily backup created: ' + backupName);
  } catch(e) { Logger.log('dailyBackup error: ' + e); }
}

function archiveOldLeads() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    var finalStatuses = ['Closed', 'Invalid', 'Lost', 'Not Interested'];

    var toArchive = leads.filter(function(l) {
      return finalStatuses.indexOf(l.LeadStatus) !== -1 &&
             new Date(l.DateCreated) < cutoff &&
             l.LeadStatus !== 'Archived';
    });
    toArchive.forEach(function(l) {
      var row = findRowById(SHEET_NAMES.LEADS, 'LeadID', l.LeadID);
      if (!row) return;
      var headers = getHeaders(SHEET_NAMES.LEADS);
      var stIdx = headers.indexOf('LeadStatus');
      if (stIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, row._row, stIdx + 1, 'Archived');
    });
    Logger.log('Archived old leads: ' + toArchive.length);
  } catch(e) { Logger.log('archiveOldLeads: ' + e); }
}

function cleanOldAuditLogs() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.AUDIT_LOG);
    if (!sheet) return;
    var cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    var data = sheet.getDataRange().getValues();
    var toDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][1] && new Date(data[i][1]) < cutoff) toDelete.push(i + 1);
    }
    toDelete.forEach(function(r) { sheet.deleteRow(r); });
    Logger.log('Cleaned audit logs: ' + toDelete.length + ' rows');
  } catch(e) { Logger.log('cleanOldAuditLogs: ' + e); }
}
