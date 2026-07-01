// ============================================================
// SiteVisit.gs — Site Visit Scheduling & GPS Tracking
// Signature Realty CRM V10
// ============================================================

function scheduleSiteVisit(data) {
  try {
    var session = requireLogin();
    enforceRBAC('SiteVisits', 'create');
    var errs = validateSiteVisitData(data);
    if (errs.length) return error(errs.join(' '));

    var visitId = generateUniqueId('SV');
    var row = [
      visitId,
      data.LeadID,
      data.PropertyID,
      new Date(data.ScheduledDate),
      data.ScheduledTime || '',
      '', '', '', '', // CheckIn/Out times & locations
      session.name,
      '', '', '', '', // ratings, feedback, nextStep
      'Scheduled',
      new Date()
    ];
    appendToSheet(SHEET_NAMES.SITE_VISITS, row);
    updateLeadStatus(data.LeadID, 'Site Visit Scheduled', 'Site visit scheduled for ' + formatDate(data.ScheduledDate));
    appendActivity(data.LeadID, session.userId, 'Site Visit Scheduled',
      'Visit scheduled on ' + formatDate(data.ScheduledDate) + ' for property ' + data.PropertyID);
    // Auto task: take visit feedback next day (V10 plan rule)
    onVisitScheduled(data.LeadID, data.ScheduledDate);
    sendSiteVisitReminder(visitId);
    logCreate(session.userId, 'SiteVisits', visitId, { leadId: data.LeadID, propertyId: data.PropertyID });
    return success({ visitId: visitId }, 'Site visit scheduled successfully');
  } catch(e) {
    Logger.log('scheduleSiteVisit error: ' + e);
    return error(e.message);
  }
}

function getSiteVisit(visitId) {
  try {
    requireLogin();
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return error('Site visit not found.');
    return success(visit);
  } catch(e) {
    return error(e.message);
  }
}

function getAllSiteVisits(filters) {
  try {
    var session = requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.SITE_VISITS);

    if (session.role === 'Agent') {
      rows = rows.filter(function(r) { return r.Agent === session.name; });
    }
    if (filters.status) rows = rows.filter(function(r) { return r.Status === filters.status; });
    if (filters.leadId) rows = rows.filter(function(r) { return r.LeadID === filters.leadId; });
    if (filters.propertyId) rows = rows.filter(function(r) { return r.PropertyID === filters.propertyId; });
    if (filters.fromDate) {
      var fd = new Date(filters.fromDate);
      rows = rows.filter(function(r) { return new Date(r.ScheduledDate) >= fd; });
    }
    rows = sortArray(rows, 'ScheduledDate', 'desc');
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch(e) {
    return error(e.message);
  }
}

function updateSiteVisit(visitId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('SiteVisits', 'update');
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return error('Site visit not found.');
    var headers = getHeaders(SHEET_NAMES.SITE_VISITS);
    var updatable = ['ScheduledDate','ScheduledTime','Status','Feedback','NextStep','PropertyCondition','LeadInterest'];
    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, idx + 1, data[f]);
      }
    });
    logUpdate(session.userId, 'SiteVisits', visitId, visit, data);
    return success(null, 'Site visit updated');
  } catch(e) {
    return error(e.message);
  }
}

function recordCheckIn(visitId, gpsLocation) {
  try {
    var session = requireLogin();
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return error('Site visit not found.');
    var headers = getHeaders(SHEET_NAMES.SITE_VISITS);
    var now = new Date();
    var ciIdx = headers.indexOf('CheckInTime');
    var clIdx = headers.indexOf('CheckInLocation');
    if (ciIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, ciIdx + 1, now.toLocaleTimeString('en-IN'));
    if (clIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, clIdx + 1, gpsLocation || '');
    appendActivity(visit.LeadID, session.userId, 'Check-In', 'Checked in at ' + now.toLocaleTimeString('en-IN') + (gpsLocation ? ' | GPS: ' + gpsLocation : ''));
    logUpdate(session.userId, 'SiteVisits', visitId, {}, { checkIn: now, location: gpsLocation });
    return success(null, 'Check-in recorded at ' + now.toLocaleTimeString('en-IN'));
  } catch(e) {
    return error(e.message);
  }
}

function recordCheckOut(visitId, gpsLocation, feedback) {
  try {
    var session = requireLogin();
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return error('Site visit not found.');
    var headers = getHeaders(SHEET_NAMES.SITE_VISITS);
    var now = new Date();
    var coIdx = headers.indexOf('CheckOutTime');
    var clIdx = headers.indexOf('CheckOutLocation');
    var stIdx = headers.indexOf('Status');
    var fbIdx = headers.indexOf('Feedback');
    if (coIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, coIdx + 1, now.toLocaleTimeString('en-IN'));
    if (clIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, clIdx + 1, gpsLocation || '');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, stIdx + 1, 'Completed');
    if (fbIdx !== -1 && feedback) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, fbIdx + 1, feedback);
    appendActivity(visit.LeadID, session.userId, 'Check-Out', 'Checked out at ' + now.toLocaleTimeString('en-IN'));
    logUpdate(session.userId, 'SiteVisits', visitId, {}, { checkOut: now, status: 'Completed' });

    // Record the visit on the lead record (V10 plan: update PropertiesVisited, VisitDates, VisitFeedback)
    recordVisitOnLead(visit.LeadID, visit.PropertyID, now, feedback || '');

    // Update lead status to Site Visited
    updateLeadStatus(visit.LeadID, 'Site Visited', 'Visit completed for property ' + visit.PropertyID);

    return success(null, 'Check-out recorded. Visit marked completed.');
  } catch(e) {
    return error(e.message);
  }
}

function submitFeedback(visitId, feedbackData) {
  try {
    var session = requireLogin();
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return error('Site visit not found.');
    var headers = getHeaders(SHEET_NAMES.SITE_VISITS);
    var fields = {
      Feedback: feedbackData.feedback || '',
      NextStep: feedbackData.nextStep || '',
      PropertyCondition: feedbackData.propertyCondition || '',
      LeadInterest: feedbackData.leadInterest || ''
    };
    Object.keys(fields).forEach(function(f) {
      var idx = headers.indexOf(f);
      if (idx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, idx + 1, fields[f]);
    });
    appendActivity(visit.LeadID, session.userId, 'Feedback Submitted',
      'Property: ' + feedbackData.propertyCondition + '/5, Interest: ' + feedbackData.leadInterest + '/5');
    // If interest is high (4-5), suggest negotiation
    if (safeNum(feedbackData.leadInterest) >= 4) {
      updateLeadStatus(visit.LeadID, 'Negotiating', 'High interest after site visit — starting negotiation');
    }
    return success(null, 'Feedback submitted successfully');
  } catch(e) {
    return error(e.message);
  }
}

function getSiteVisitsByLead(leadId) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.SITE_VISITS);
    return success(rows.filter(function(r) { return r.LeadID === leadId; }));
  } catch(e) {
    return error(e.message);
  }
}

function cancelSiteVisit(visitId, reason) {
  try {
    var session = requireLogin();
    var visit = findRowById(SHEET_NAMES.SITE_VISITS, 'VisitID', visitId);
    if (!visit) return error('Site visit not found.');
    var headers = getHeaders(SHEET_NAMES.SITE_VISITS);
    var stIdx = headers.indexOf('Status');
    var fbIdx = headers.indexOf('Feedback');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, stIdx + 1, 'Cancelled');
    if (fbIdx !== -1) updateSheetCell(SHEET_NAMES.SITE_VISITS, visit._row, fbIdx + 1, 'Cancelled: ' + (reason || ''));
    appendActivity(visit.LeadID, session.userId, 'Visit Cancelled', reason || '');
    return success(null, 'Site visit cancelled');
  } catch(e) {
    return error(e.message);
  }
}

function getUpcomingVisits() {
  try {
    var rows = getSheetData(SHEET_NAMES.SITE_VISITS);
    var now = new Date();
    var upcoming = rows.filter(function(r) {
      return r.Status === 'Scheduled' && new Date(r.ScheduledDate) >= now;
    });
    return upcoming.sort(function(a, b) { return new Date(a.ScheduledDate) - new Date(b.ScheduledDate); });
  } catch(e) { return []; }
}

function getTodaysVisits() {
  try {
    var rows = getSheetData(SHEET_NAMES.SITE_VISITS);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return rows.filter(function(r) {
      var d = new Date(r.ScheduledDate);
      return d >= today && d < tomorrow && r.Status === 'Scheduled';
    });
  } catch(e) { return []; }
}
