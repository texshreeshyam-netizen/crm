// ============================================================
// Notifications.gs — Email & WhatsApp Notifications
// Signature Realty CRM V10
// ============================================================

function sendEmail(to, subject, body) {
  try {
    if (!to || !subject) return;
    if (!getConfig('Email_Notifications')) return;
    MailApp.sendEmail({
      to: to,
      subject: '[Signature Realty] ' + subject,
      body: body,
      name: getConfig('Company_Name') || 'Signature Realty CRM'
    });
    logNotification('email', to, subject, 'Sent');
  } catch(e) {
    Logger.log('sendEmail error: ' + e);
    logNotification('email', to, subject, 'Failed: ' + e.message);
  }
}

function sendHTMLEmail(to, subject, htmlBody) {
  try {
    if (!to || !getConfig('Email_Notifications')) return;
    MailApp.sendEmail({
      to: to,
      subject: '[Signature Realty] ' + subject,
      htmlBody: htmlBody,
      name: getConfig('Company_Name') || 'Signature Realty CRM'
    });
    logNotification('email', to, subject, 'Sent');
  } catch(e) {
    Logger.log('sendHTMLEmail error: ' + e);
  }
}

// WhatsApp via API (optional, requires API key in Config)
// Free alternative: wa.me link (manual/client side)
function sendWhatsApp(phone, message) {
  try {
    var apiKey = getConfig('WhatsApp_API_Key');
    if (!apiKey || !phone) return;
    var cleanedPhone = '91' + cleanPhone(phone);
    var url = 'https://api.whatsapp-api.com/v1/messages';
    var payload = JSON.stringify({ phone: cleanedPhone, message: message, apiKey: apiKey });
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    logNotification('whatsapp', phone, message.slice(0, 100),
      response.getResponseCode() === 200 ? 'Sent' : 'Failed');
  } catch(e) {
    Logger.log('sendWhatsApp error: ' + e);
  }
}

// Generate wa.me link for manual sending (free, no API key needed)
function getWhatsAppLink(phone, message) {
  var cleaned = '91' + cleanPhone(phone);
  return 'https://wa.me/' + cleaned + '?text=' + encodeURIComponent(message);
}

// ======================================================
// LEAD NOTIFICATIONS
// ======================================================

function sendLeadCreatedNotification(leadId) {
  try {
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return;
    var adminEmail = getConfig('Company_Email');
    if (!adminEmail) return;
    var subject = 'New Lead: ' + (lead.FullName || '') + ' (' + leadId + ')';
    var body =
      'A new lead has been created in Signature Realty CRM V10.\n\n' +
      'Lead ID: ' + leadId + '\n' +
      'Name: ' + (lead.FullName || '') + '\n' +
      'Phone: ' + (lead.PrimaryPhone || '') + '\n' +
      'WhatsApp: ' + (lead.WhatsAppNumber || '') + '\n' +
      'Source: ' + (lead.Source || '') + '\n' +
      'Lead Type: ' + (lead.LeadType || '') + '\n' +
      'Category: ' + (lead.Category || '') + '\n' +
      'Transaction: ' + (lead.TransactionType || '') + '\n' +
      'Budget: ₹' + formatNum(lead.BudgetMin) + ' – ₹' + formatNum(lead.BudgetMax) + '\n' +
      'Location: ' + (lead.LocationPref1 || '') + '\n' +
      'Status: ' + (lead.LeadStatus || 'New') + '\n\n' +
      'Please login to CRM to review and assign.';
    sendEmail(adminEmail, subject, body);
  } catch(e) { Logger.log('sendLeadCreatedNotification: ' + e); }
}

function sendFollowUpReminder(leadId) {
  try {
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead || !lead.AssignedAgent) return;
    var users = getSheetData(SHEET_NAMES.USERS);
    var agent = users.find(function(u) { return u.Name === lead.AssignedAgent; });
    if (!agent || !agent.Email) return;
    var subject = 'Follow-up Required: ' + (lead.FullName || '') + ' (' + leadId + ')';
    var body =
      'Dear ' + lead.AssignedAgent + ',\n\n' +
      'This lead requires your follow-up action:\n\n' +
      'Lead: ' + (lead.FullName || '') + ' | ' + (lead.PrimaryPhone || '') + '\n' +
      'Status: ' + (lead.LeadStatus || '') + '\n' +
      'Score: ' + (lead.ScoreCategory || '') + ' (' + (lead.Score || 0) + ' pts)\n' +
      'Last Action: ' + formatDate(lead.LastActionDate) + '\n' +
      'Category: ' + (lead.Category || '') + ' | Budget: ₹' + formatNum(lead.BudgetMax) + '\n\n' +
      'Please take action today.\n\nSignature Realty CRM V10';
    sendEmail(agent.Email, subject, body);
  } catch(e) { Logger.log('sendFollowUpReminder: ' + e); }
}

function sendOverdueLeadAlert(leadId) {
  try {
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return;
    var adminEmail = getConfig('Company_Email');
    if (adminEmail) {
      sendEmail(adminEmail,
        'Overdue Lead Alert: ' + (lead.FullName || '') + ' (' + leadId + ')',
        'Lead has been inactive:\n\n' +
        'Lead: ' + (lead.FullName || '') + ' | ' + (lead.PrimaryPhone || '') + '\n' +
        'Status: ' + (lead.LeadStatus || '') + '\n' +
        'Agent: ' + (lead.AssignedAgent || 'Unassigned') + '\n' +
        'Last Action: ' + formatDate(lead.LastActionDate)
      );
    }
    if (lead.AssignedAgent) sendFollowUpReminder(leadId);
  } catch(e) { Logger.log('sendOverdueLeadAlert: ' + e); }
}

// ======================================================
// SITE VISIT NOTIFICATIONS
// ======================================================

function sendSiteVisitReminder(visitId) {
  try {
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return;
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', visit.LeadID);
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', visit.PropertyID);
    if (!lead) return;

    var propInfo = prop ?
      (prop.ProjectBuildingName || '') + ' | ' + (prop.FullAddress || '') :
      visit.PropertyID;
    var subject = 'Site Visit Reminder: ' + formatDate(visit.ScheduledDate);
    var body =
      'Dear ' + (lead.FullName || '') + ',\n\n' +
      'Your property site visit is scheduled:\n\n' +
      'Property: ' + propInfo + '\n' +
      'Date: ' + formatDate(visit.ScheduledDate) + '\n' +
      'Time: ' + (visit.ScheduledTime || 'TBD') + '\n' +
      'Agent: ' + (visit.Agent || '') + '\n\n' +
      'Please be on time. Our agent will meet you at the property.\n\n' +
      'Regards,\nSignature Realty Team';

    if (lead.Email) sendEmail(lead.Email, subject, body);
    if (lead.WhatsAppNumber || lead.PrimaryPhone) {
      sendWhatsApp(lead.WhatsAppNumber || lead.PrimaryPhone,
        'Site Visit Reminder — ' + formatDate(visit.ScheduledDate) +
        ' at ' + (visit.ScheduledTime || 'TBD') + '\nProperty: ' + propInfo);
    }
  } catch(e) { Logger.log('sendSiteVisitReminder: ' + e); }
}

// ======================================================
// SHORTLIST NOTIFICATION
// ======================================================

function sendShortlistNotification(leadId, propertyIds) {
  try {
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead || !lead.Email) return;
    var propList = propertyIds.map(function(id) {
      var p = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', id);
      return p ? '• ' + (p.ProjectBuildingName || '') + ', ' + (p.FullAddress || '') +
        ' | ' + (p.BHK || '') + 'BHK | ₹' + formatNum(p.Price) : '• ' + id;
    }).join('\n');
    var subject = 'Your Property Shortlist — Signature Realty';
    var body =
      'Dear ' + (lead.FullName || '') + ',\n\n' +
      'Based on your requirements, we have shortlisted the following properties:\n\n' +
      propList + '\n\n' +
      'Our agent will call you to schedule site visits.\n\n' +
      'Best regards,\nSignature Realty Team';
    sendEmail(lead.Email, subject, body);
    if (lead.WhatsAppNumber || lead.PrimaryPhone) {
      sendWhatsApp(lead.WhatsAppNumber || lead.PrimaryPhone,
        'Hi ' + (lead.FullName || '') + '! We have shortlisted ' + propertyIds.length +
        ' properties for you. Our agent will call you shortly. — Signature Realty');
    }
  } catch(e) { Logger.log('sendShortlistNotification: ' + e); }
}

// ======================================================
// NEGOTIATION & COMMISSION NOTIFICATIONS
// ======================================================

function sendNegotiationNotification(negId) {
  try {
    var neg = findRowById(SHEET_NAMES.NEGOTIATIONS, 'NegotiationID', negId);
    if (!neg) return;
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', neg.LeadID);
    var adminEmail = getConfig('Company_Email');
    if (!adminEmail) return;
    var subject = 'Negotiation Update: ' + neg.Status + ' (' + negId + ')';
    var body =
      'Negotiation status update:\n\n' +
      'Negotiation ID: ' + negId + '\n' +
      'Lead: ' + (lead ? lead.FullName : neg.LeadID) + '\n' +
      'Status: ' + neg.Status + '\n' +
      'Deal Probability: ' + (neg.DealProbability || '') + '%\n' +
      'Final Amount: ₹' + formatNum(neg.FinalAmount);
    sendEmail(adminEmail, subject, body);
  } catch(e) { Logger.log('sendNegotiationNotification: ' + e); }
}

function sendCommissionNotification(commId) {
  try {
    var comm = findRowById(SHEET_NAMES.COMMISSIONS, 'CommissionID', commId);
    if (!comm) return;
    var users = getSheetData(SHEET_NAMES.USERS);
    var agent = users.find(function(u) { return u.Name === comm.Agent1; });
    if (!agent || !agent.Email) return;
    var subject = 'Commission Statement: ' + commId;
    var body =
      'Dear ' + comm.Agent1 + ',\n\n' +
      'Your commission details:\n\n' +
      'Sale Price: ₹' + formatNum(comm.SalePrice) + '\n' +
      'Gross Commission: ₹' + formatNum(comm.GrossCommission) + '\n' +
      'TDS: ₹' + formatNum(comm.TDS) + '\n' +
      'GST: ₹' + formatNum(comm.GST) + '\n' +
      'Net Commission: ₹' + formatNum(comm.NetCommission) + '\n' +
      'Your Share (' + comm.Agent1Percent + '%): ₹' + formatNum(comm.Agent1Amount) + '\n' +
      'Status: ' + comm.PaymentStatus + '\n\n' +
      'Signature Realty CRM V10';
    sendEmail(agent.Email, subject, body);
  } catch(e) { Logger.log('sendCommissionNotification: ' + e); }
}

// ======================================================
// INVENTORY NOTIFICATIONS (V10 Plan additions)
// ======================================================

// Price drop alert → notify agent to follow up with interested leads
function sendPriceDropAlert(propertyId, oldPrice, newPrice) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return;
    var adminEmail = getConfig('Company_Email');
    var agentEmail = getAgentEmail(prop.AddedByAgent);
    var subject = 'Price Drop Alert: ' + (prop.ProjectBuildingName || propertyId);
    var body =
      'Price has been reduced on a property in your inventory:\n\n' +
      'Property: ' + (prop.ProjectBuildingName || '') + '\n' +
      'Address: ' + (prop.FullAddress || '') + '\n' +
      'Old Price: ₹' + formatNum(oldPrice) + '\n' +
      'New Price: ₹' + formatNum(newPrice) + '\n' +
      'Drop: ₹' + formatNum(oldPrice - newPrice) + ' (' +
      Math.round((oldPrice - newPrice) / oldPrice * 100) + '% reduction)\n\n' +
      'Action: Inform interested leads and follow up.\n\nSignature Realty CRM V10';
    if (agentEmail) sendEmail(agentEmail, subject, body);
    if (adminEmail && agentEmail !== adminEmail) sendEmail(adminEmail, subject, body);
  } catch(e) { Logger.log('sendPriceDropAlert: ' + e); }
}

// Stale inventory alert → agent to review pricing/strategy
function sendStaleInventoryAlert(propertyId, agentName, daysInInventory) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return;
    var agentEmail = getAgentEmail(agentName);
    var adminEmail = getConfig('Company_Email');
    var subject = 'Stale Inventory (' + daysInInventory + ' days): ' + (prop.ProjectBuildingName || propertyId);
    var body =
      'This property has been in inventory for ' + daysInInventory + ' days without being sold/rented.\n\n' +
      'Property ID: ' + propertyId + '\n' +
      'Name: ' + (prop.ProjectBuildingName || '') + '\n' +
      'Address: ' + (prop.FullAddress || '') + '\n' +
      'Price: ₹' + formatNum(prop.Price) + '\n' +
      'Listing Type: ' + (prop.ListingType || '') + '\n' +
      'Days in Inventory: ' + daysInInventory + '\n\n' +
      'Action: Review pricing strategy or consider re-marketing.\n\nSignature Realty CRM V10';
    if (agentEmail) sendEmail(agentEmail, subject, body);
    if (adminEmail && agentEmail !== adminEmail) sendEmail(adminEmail, subject, body);
  } catch(e) { Logger.log('sendStaleInventoryAlert: ' + e); }
}

// Mandate expiry reminder
function sendMandateExpiryAlert(propertyId, agentName, expiryDate) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return;
    var agentEmail = getAgentEmail(agentName);
    var subject = 'Exclusive Mandate Expiring: ' + (prop.ProjectBuildingName || propertyId);
    var body =
      'The exclusive mandate for the following property is expiring soon:\n\n' +
      'Property: ' + (prop.ProjectBuildingName || '') + '\n' +
      'Address: ' + (prop.FullAddress || '') + '\n' +
      'Owner: ' + (prop.OwnerName || '') + '\n' +
      'Mandate Expiry: ' + formatDate(expiryDate) + '\n\n' +
      'Action: Renew or confirm mandate with the owner.\n\nSignature Realty CRM V10';
    if (agentEmail) sendEmail(agentEmail, subject, body);
  } catch(e) { Logger.log('sendMandateExpiryAlert: ' + e); }
}

// Listing expiry reminder
function sendListingExpiryAlert(propertyId, agentName, expiryDate) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return;
    var agentEmail = getAgentEmail(agentName);
    var subject = 'Listing Expiring Soon: ' + (prop.ProjectBuildingName || propertyId);
    var body =
      'This property listing is expiring soon:\n\n' +
      'Property: ' + (prop.ProjectBuildingName || '') + '\n' +
      'Address: ' + (prop.FullAddress || '') + '\n' +
      'Listing Expiry: ' + formatDate(expiryDate) + '\n\n' +
      'Action: Re-confirm with owner/broker to renew listing.\n\nSignature Realty CRM V10';
    if (agentEmail) sendEmail(agentEmail, subject, body);
  } catch(e) { Logger.log('sendListingExpiryAlert: ' + e); }
}

// Builder possession date nearing
function sendBuilderPossessionAlert(projectId, projectName, possessionDate) {
  try {
    var adminEmail = getConfig('Company_Email');
    if (!adminEmail) return;
    var subject = 'Possession Date Nearing: ' + projectName;
    var body =
      'A builder project possession date is approaching:\n\n' +
      'Project ID: ' + projectId + '\n' +
      'Project: ' + projectName + '\n' +
      'Expected Possession: ' + formatDate(possessionDate) + '\n\n' +
      'Action: Update unit availability status as possession approaches.\n\nSignature Realty CRM V10';
    sendEmail(adminEmail, subject, body);
  } catch(e) { Logger.log('sendBuilderPossessionAlert: ' + e); }
}

// Property duplicate flagged → admin review
function sendPropertyDuplicateAlert(propertyId, existingId) {
  try {
    var adminEmail = getConfig('Company_Email');
    if (!adminEmail) return;
    sendEmail(adminEmail,
      'Possible Duplicate Property: ' + propertyId,
      'A new property was added that may be a duplicate:\n\n' +
      'New Property ID: ' + propertyId + '\n' +
      'Possible Duplicate Of: ' + existingId + '\n\n' +
      'Action: Review and merge or confirm as separate in the Inventory module.\n\nSignature Realty CRM V10'
    );
  } catch(e) { Logger.log('sendPropertyDuplicateAlert: ' + e); }
}

// Property hold follow-up (3 days after hold)
function sendHoldFollowUpAlert(propertyId, agentName, holdLeadId) {
  try {
    var agentEmail = getAgentEmail(agentName);
    if (!agentEmail) return;
    var subject = 'Hold Follow-up Required: ' + propertyId;
    var body =
      'A property has been on Hold for 3+ days:\n\n' +
      'Property ID: ' + propertyId + '\n' +
      'Hold Lead: ' + (holdLeadId || 'Not specified') + '\n\n' +
      'Action: Follow up on hold status — confirm or release.\n\nSignature Realty CRM V10';
    sendEmail(agentEmail, subject, body);
  } catch(e) { Logger.log('sendHoldFollowUpAlert: ' + e); }
}

// Property submitted by agent for a requirement
function sendAdminPropertySubmissionNotification(propertyId, agentName) {
  onBrokerPropertySubmitted(propertyId, agentName);
}

// New property submitted against a shared requirement
function sendPropertySubmittedToRequirementNotification(propertyId, leadId, submittingAgent, ownerAgentId) {
  try {
    var users = getSheetData(SHEET_NAMES.USERS);
    var ownerAgent = users.find(function(u) { return u.UserID === ownerAgentId; });
    if (!ownerAgent || !ownerAgent.Email) return;
    var subject = 'New Property Submitted for Your Requirement: ' + leadId;
    var body =
      'Agent ' + submittingAgent + ' has submitted a property for your requirement:\n\n' +
      'Property ID: ' + propertyId + '\n' +
      'Lead ID: ' + leadId + '\n\n' +
      'Please review the property in Inventory and add to the lead shortlist if suitable.\n\nSignature Realty CRM V10';
    sendEmail(ownerAgent.Email, subject, body);
  } catch(e) { Logger.log('sendPropertySubmittedToRequirementNotification: ' + e); }
}

// ======================================================
// HELPERS
// ======================================================

function getAgentEmail(agentName) {
  if (!agentName) return null;
  try {
    var users = getSheetData(SHEET_NAMES.USERS);
    var user = users.find(function(u) { return u.Name === agentName; });
    return user ? user.Email : null;
  } catch(e) { return null; }
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function logNotification(type, recipient, message, status) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICATIONS);
    if (!sheet) return;
    sheet.appendRow([
      generateUniqueId('NOTIF'), new Date(), type, recipient,
      String(message || '').slice(0, 200), status
    ]);
  } catch(e) { /* silent */ }
}

function getBulkNotificationStatus() {
  try {
    requireLogin();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICATIONS);
    if (!sheet) return success([]);
    var data = sheet.getDataRange().getValues();
    return success(data.slice(-50));
  } catch(e) {
    return error(e.message);
  }
}
