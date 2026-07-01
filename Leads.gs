// ============================================================
// Leads.gs — Lead Management (CRUD, Scoring, Assignment)
// Signature Realty CRM V10
// ============================================================

// ---- Generate sequential Lead ID (LEAD-0001 format) ----
function generateLeadId() {
  try {
    var rows = getSheetData(SHEET_NAMES.LEADS);
    var max = 0;
    rows.forEach(function(r) {
      var id = String(r.LeadID || '');
      if (id.indexOf('LEAD-') === 0) {
        var num = parseInt(id.replace('LEAD-', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return 'LEAD-' + ('000' + (max + 1)).slice(-4);
  } catch(e) {
    return 'LEAD-' + new Date().getTime().toString().slice(-4);
  }
}

function createLead(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Leads', 'create');
    if (!data.FullName && !data.Name) return error('Full name is required.');
    if (!data.PrimaryPhone && !data.Mobile) return error('Primary phone is required.');
    if (!data.Source) return error('Lead source is required.');

    var name = sanitizeString(data.FullName || data.Name);
    var phone = cleanPhone(data.PrimaryPhone || data.Mobile);

    // Duplicate check
    var dupResult = duplicateDetection({ FullName: name, PrimaryPhone: phone, Email: data.Email });
    if (dupResult.isDuplicate) {
      return error('Duplicate lead: ' + dupResult.reason + ' (Existing: ' + dupResult.existingId + ')');
    }

    var leadId = generateLeadId();
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN');
    var score = calculateLeadScore(data);
    var scoreCategory = getScoreCategory(score);

    var row = [
      // GROUP A
      leadId, now, timeStr,
      data.Source || '', sanitizeString(data.SourceDetail || ''),
      // GROUP B
      name,
      phone,
      cleanPhone(data.WhatsAppNumber || data.WhatsApp || ''),
      cleanPhone(data.AlternatePhone || ''),
      sanitizeString(data.Email || ''),
      sanitizeString(data.CityOfResidence || data.City || ''),
      sanitizeString(data.Occupation || ''),
      sanitizeString(data.CompanyName || ''),
      data.NRIStatus || 'No',
      sanitizeString(data.PreferredLanguage || ''),
      // GROUP C
      data.LeadType || 'End User',
      sanitizeString(data.ReferredByBrokerName || ''),
      cleanPhone(data.ReferringBrokerPhone || ''),
      sanitizeNumber(data.CommissionSharePercent || 0),
      // GROUP D
      'No', '',
      sanitizeString(data.AssignedAgent || ''), '',
      // GROUP E
      'Pending', '',
      0, '', '', sanitizeString(data.BestTimeToCall || ''),
      // GROUP F
      data.TransactionType || 'Sale',
      data.Category || '',
      data.SubCategory || '',
      // GROUP G
      sanitizeNumber(data.BudgetMin || 0),
      sanitizeNumber(data.BudgetMax || data.Budget || 0),
      data.BudgetFlexible || 'No',
      data.FundingType || '',
      sanitizeNumber(data.LoanPreApprovedAmount || 0),
      sanitizeString(data.BankName || ''),
      sanitizeNumber(data.MonthlyRentBudget || 0),
      sanitizeNumber(data.SecurityDepositCapacity || 0),
      // GROUP H
      sanitizeString(data.LocationPref1 || data.Location || ''),
      sanitizeString(data.LocationPref2 || ''),
      sanitizeString(data.LocationPref3 || ''),
      data.LocationStrictness || 'Flexible',
      sanitizeString(data.ProximityRequirement || ''),
      // GROUP I
      sanitizeNumber(data.BHKMin || data.BHK || 0),
      sanitizeNumber(data.BHKMax || data.BHK || 0),
      data.OldNewPreference || '',
      data.FloorPreference || '',
      data.FacingPreference || '',
      data.ParkingRequired || 'No',
      data.Furnishing || '',
      sanitizeString(data.AmenitiesRequired || ''),
      data.PossessionStatusRequired || '',
      // GROUP J (Residential Rent)
      data.TenantType || '',
      sanitizeNumber(data.FamilySize || 0),
      sanitizeNumber(data.NumberOfOccupants || 0),
      data.FoodPreference || '',
      data.PetsAllowed || 'No',
      sanitizeString(data.PetType || ''),
      data.CompanyLease || 'No',
      sanitizeString(data.CompanyLeaseName || ''),
      data.LockInAcceptable || 'No',
      sanitizeString(data.LeaseDurationPreferred || ''),
      // GROUP K (Commercial)
      sanitizeString(data.BusinessType || ''),
      sanitizeString(data.NatureOfBusiness || ''),
      sanitizeNumber(data.CarpetAreaRequired || 0),
      sanitizeNumber(data.FrontageWidth || 0),
      data.CommFloorPref || '',
      data.WashroomType || '',
      sanitizeNumber(data.PowerLoadRequired || 0),
      data.FireNOCRequired || 'No',
      sanitizeNumber(data.CustomerParking || 0),
      sanitizeNumber(data.StaffParking || 0),
      sanitizeString(data.CommLockIn || ''),
      sanitizeString(data.CommLeaseTenure || ''),
      // GROUP L (Land)
      sanitizeString(data.PlotUse || ''),
      sanitizeNumber(data.PlotAreaRequired || 0),
      data.CornerPlotRequired || 'No',
      sanitizeNumber(data.RoadWidthFacing || 0),
      data.LayoutApprovalPref || '',
      // GROUP M (Industrial)
      sanitizeString(data.IndustryType || ''),
      sanitizeNumber(data.IndustrialAreaRequired || 0),
      sanitizeNumber(data.IndustrialPowerLoad || 0),
      sanitizeNumber(data.CeilingHeight || 0),
      data.LoadingDockRequired || 'No',
      // GROUP N
      data.Purpose || '',
      data.UrgencyLevel || '',
      data.DecisionMaker || 'Self',
      sanitizeString(data.PossessionTimeline || ''),
      // GROUP O
      data.KYCDocumentsReady || 'No',
      data.CoApplicantForLoan || 'No',
      data.CompanyDocumentsReady || 'No',
      // GROUP P
      data.VastuRequired || 'No',
      sanitizeString(data.AccessibilityNeeds || ''),
      sanitizeString(data.SpecialNotes || data.Notes || ''),
      // GROUP Q (Shortlist)
      '', '', '', 0, '', '', '',
      // GROUP R (Requirement Sharing)
      'No', '', '', 0,
      // GROUP S (Site Visit & Negotiation)
      '', '', '', '', 0, '', 0, 0,
      // GROUP T (Status & Closure)
      'New', now, '', '', '', 0,
      // GROUP U (Communication)
      0, '', sanitizeString(data.Notes || ''), '',
      // System
      score, scoreCategory, session.userId, session.userId, now
    ];

    appendToSheet(SHEET_NAMES.LEADS, row);
    logCreate(session.userId, 'Leads', leadId, { name: name, phone: phone });

    // Auto-assign if no agent specified
    if (!data.AssignedAgent) {
      autoAssignLead(leadId);
    }

    sendLeadCreatedNotification(leadId);
    return success({ leadId: leadId, score: score, scoreCategory: scoreCategory }, 'Lead created: ' + leadId);
  } catch(e) {
    Logger.log('createLead error: ' + e);
    return error(e.message);
  }
}

function getLead(leadId) {
  try {
    requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    lead.requirements = getRequirements(leadId);
    lead.activities = getLeadActivities(leadId);
    lead.siteVisits = getSiteVisitsByLead(leadId);
    return success(lead);
  } catch(e) {
    return error(e.message);
  }
}

function getAllLeads(filters) {
  try {
    var session = requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.LEADS);

    // Role-based filtering
    if (session.role === 'Agent') {
      rows = rows.filter(function(r) {
        return r.AssignedAgent === session.name || r.CreatedBy === session.userId;
      });
    }
    if (filters.status) rows = rows.filter(function(r) { return r.LeadStatus === filters.status; });
    if (filters.source) rows = rows.filter(function(r) { return r.Source === filters.source; });
    if (filters.leadType) rows = rows.filter(function(r) { return r.LeadType === filters.leadType; });
    if (filters.category) rows = rows.filter(function(r) { return r.Category === filters.category; });
    if (filters.transactionType) rows = rows.filter(function(r) { return r.TransactionType === filters.transactionType; });
    if (filters.agent) rows = rows.filter(function(r) { return r.AssignedAgent === filters.agent; });
    if (filters.score) rows = rows.filter(function(r) { return r.ScoreCategory === filters.score; });
    if (filters.search) {
      rows = filterByQuery(rows, filters.search, [
        'FullName', 'PrimaryPhone', 'WhatsAppNumber', 'Email',
        'LocationPref1', 'LeadID'
      ]);
    }
    if (filters.fromDate) {
      var fd = new Date(filters.fromDate);
      rows = rows.filter(function(r) { return new Date(r.DateCreated) >= fd; });
    }
    if (filters.toDate) {
      var td = new Date(filters.toDate);
      rows = rows.filter(function(r) { return new Date(r.DateCreated) <= td; });
    }
    rows = sortArray(rows, 'DateCreated', 'desc');
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch(e) {
    return error(e.message);
  }
}

function updateLead(leadId, data) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');

    if (session.role === 'Agent' && lead.AssignedAgent !== session.name && lead.CreatedBy !== session.userId) {
      return error('Access denied: not your lead.');
    }

    var headers = getHeaders(SHEET_NAMES.LEADS);
    var oldLead = cloneObj(lead);

    var updatable = [
      'FullName', 'PrimaryPhone', 'WhatsAppNumber', 'AlternatePhone', 'Email',
      'CityOfResidence', 'Occupation', 'CompanyName', 'NRIStatus', 'PreferredLanguage',
      'LeadType', 'ReferredByBrokerName', 'ReferringBrokerPhone', 'CommissionSharePercent',
      'AssignedAgent', 'AssignmentDate',
      'VerifiedStatus', 'NotVerifiedReason', 'BestTimeToCall',
      'TransactionType', 'Category', 'SubCategory',
      'BudgetMin', 'BudgetMax', 'BudgetFlexible', 'FundingType',
      'LoanPreApprovedAmount', 'BankName', 'MonthlyRentBudget', 'SecurityDepositCapacity',
      'LocationPref1', 'LocationPref2', 'LocationPref3', 'LocationStrictness', 'ProximityRequirement',
      'BHKMin', 'BHKMax', 'OldNewPreference', 'FloorPreference', 'FacingPreference',
      'ParkingRequired', 'Furnishing', 'AmenitiesRequired', 'PossessionStatusRequired',
      'TenantType', 'FamilySize', 'NumberOfOccupants', 'FoodPreference',
      'PetsAllowed', 'PetType', 'CompanyLease', 'CompanyLeaseName',
      'LockInAcceptable', 'LeaseDurationPreferred',
      'BusinessType', 'NatureOfBusiness', 'CarpetAreaRequired',
      'PlotUse', 'PlotAreaRequired', 'IndustryType',
      'Purpose', 'UrgencyLevel', 'DecisionMaker', 'PossessionTimeline',
      'KYCDocumentsReady', 'CoApplicantForLoan', 'CompanyDocumentsReady',
      'VastuRequired', 'AccessibilityNeeds', 'SpecialNotes',
      'ClientReaction', 'SharedDate', 'SharedVia',
      'NegotiationStatus', 'TokenAmountDiscussed', 'TokenAmountPaid',
      'LeadStatus', 'NextFollowUpDate', 'LostReason'
    ];

    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) {
          updateSheetCell(SHEET_NAMES.LEADS, lead._row, idx + 1, data[f]);
          lead[f] = data[f];
        }
      }
    });

    // Recalculate score if key fields changed
    if (data.BudgetMax || data.UrgencyLevel || data.Category) {
      var newScore = calculateLeadScore(lead);
      var scoreIdx = headers.indexOf('Score');
      var catIdx = headers.indexOf('ScoreCategory');
      if (scoreIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, scoreIdx + 1, newScore);
      if (catIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, catIdx + 1, getScoreCategory(newScore));
    }

    // Update LastAction + LastModified
    var lmIdx = headers.indexOf('LastModifiedBy');
    var lmdIdx = headers.indexOf('LastModifiedDate');
    var laIdx = headers.indexOf('LastActionDate');
    if (lmIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, lmIdx + 1, session.userId);
    if (lmdIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, lmdIdx + 1, new Date());
    if (laIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, laIdx + 1, new Date());

    trackDataChange(session.userId, 'Leads', leadId, oldLead, data);
    return success(null, 'Lead updated successfully');
  } catch(e) {
    Logger.log('updateLead error: ' + e);
    return error(e.message);
  }
}

// ---- Telecaller: Log Call Disposition ----
function logCallDisposition(leadId, disposition, notes, followUpDate) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var headers = getHeaders(SHEET_NAMES.LEADS);

    var statusMap = {
      'Interested':     'Interested',
      'No Answer':      'No Answer',
      'Call Later':     'Call Later',
      'Wrong Number':   'Wrong Number',
      'Not Interested': 'Not Interested'
    };
    var newStatus = statusMap[disposition] || 'Telecalling';

    // Update status
    var stIdx = headers.indexOf('LeadStatus');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, stIdx + 1, newStatus);

    // Increment call count
    var callCountIdx = headers.indexOf('TotalCallsMade');
    var newCount = safeNum(lead.TotalCallsMade || 0) + 1;
    if (callCountIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, callCountIdx + 1, newCount);

    // Update last call date
    var lastCallIdx = headers.indexOf('LastCallDate');
    if (lastCallIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, lastCallIdx + 1, new Date());

    // Set first call date if not set
    if (!lead.FirstCallDate || lead.CallAttemptCount === 0) {
      var fcIdx = headers.indexOf('FirstCallDate');
      if (fcIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, fcIdx + 1, new Date());
    }
    var caIdx = headers.indexOf('CallAttemptCount');
    if (caIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, caIdx + 1, newCount);

    // Update call outcome
    var coIdx = headers.indexOf('CallOutcome');
    if (coIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, coIdx + 1, disposition);

    // Update call log remarks (append)
    var clIdx = headers.indexOf('CallLogRemarks');
    var logEntry = formatDate(new Date()) + ' [' + session.name + '] ' + disposition + (notes ? ': ' + notes : '');
    var existing = String(lead.CallLogRemarks || '');
    var newLog = existing ? existing + '\n' + logEntry : logEntry;
    if (clIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, clIdx + 1, newLog);

    // Update LastActionDate
    var laIdx = headers.indexOf('LastActionDate');
    if (laIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, laIdx + 1, new Date());

    // Set next follow-up date
    if (followUpDate) {
      var nfuIdx = headers.indexOf('NextFollowUpDate');
      if (nfuIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, nfuIdx + 1, new Date(followUpDate));
    }

    // Update not-verified reason if applicable
    if (disposition === 'Wrong Number') {
      var nvIdx = headers.indexOf('NotVerifiedReason');
      var vsIdx = headers.indexOf('VerifiedStatus');
      if (nvIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, nvIdx + 1, 'Wrong Number');
      if (vsIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, vsIdx + 1, 'Not Verified');
    }
    if (disposition === 'Not Interested') {
      var nvIdx2 = headers.indexOf('NotVerifiedReason');
      if (nvIdx2 !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, nvIdx2 + 1, 'Not Interested');
    }

    appendActivity(leadId, session.userId, 'Call Made',
      'Disposition: ' + disposition + (notes ? ' | ' + notes : '') +
      (followUpDate ? ' | Follow-up: ' + followUpDate : ''));
    logUpdate(session.userId, 'Leads', leadId, { LeadStatus: lead.LeadStatus }, { LeadStatus: newStatus });

    return success({ newStatus: newStatus, callCount: newCount }, 'Call logged: ' + disposition);
  } catch (e) {
    return error(e.message);
  }
}

function updateLeadStatus(leadId, newStatus, notes) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var oldStatus = lead.LeadStatus;
    var headers = getHeaders(SHEET_NAMES.LEADS);
    var statusIdx = headers.indexOf('LeadStatus');
    var laIdx = headers.indexOf('LastActionDate');
    if (statusIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, statusIdx + 1, newStatus);
    if (laIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, laIdx + 1, new Date());

    // Set closed date if closing
    if (newStatus === 'Closed' || newStatus === 'Lost') {
      var cdIdx = headers.indexOf('ClosedDate');
      if (cdIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, cdIdx + 1, new Date());
    }
    // Set lost reason
    if (newStatus === 'Lost' && notes) {
      var lrIdx = headers.indexOf('LostReason');
      if (lrIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, lrIdx + 1, notes);
    }

    appendActivity(leadId, session.userId, 'Status Changed',
      'From: ' + oldStatus + ' → To: ' + newStatus + (notes ? ' | ' + notes : ''));
    logUpdate(session.userId, 'Leads', leadId, { LeadStatus: oldStatus }, { LeadStatus: newStatus });
    return success(null, 'Status updated to ' + newStatus);
  } catch(e) {
    return error(e.message);
  }
}

function verifyLead(leadId, status, reason) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var headers = getHeaders(SHEET_NAMES.LEADS);
    var vIdx = headers.indexOf('VerifiedStatus');
    var nvIdx = headers.indexOf('NotVerifiedReason');
    var stIdx = headers.indexOf('LeadStatus');
    if (vIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, vIdx + 1, status);
    if (nvIdx !== -1 && reason) updateSheetCell(SHEET_NAMES.LEADS, lead._row, nvIdx + 1, reason);
    if (stIdx !== -1) {
      if (status === 'Verified') updateSheetCell(SHEET_NAMES.LEADS, lead._row, stIdx + 1, 'Verified');
      else if (status === 'Not Verified') updateSheetCell(SHEET_NAMES.LEADS, lead._row, stIdx + 1, 'Invalid');
    }
    appendActivity(leadId, session.userId, 'Lead Verification', 'Status: ' + status + (reason ? ' | Reason: ' + reason : ''));
    logUpdate(session.userId, 'Leads', leadId, { VerifiedStatus: lead.VerifiedStatus }, { VerifiedStatus: status });
    return success(null, 'Verification updated: ' + status);
  } catch(e) {
    return error(e.message);
  }
}

function assignLead(leadId, agentName) {
  try {
    var session = requireLogin();
    enforceRBAC('Leads', 'assign');
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var headers = getHeaders(SHEET_NAMES.LEADS);
    var agentIdx = headers.indexOf('AssignedAgent');
    var adIdx = headers.indexOf('AssignmentDate');
    var stIdx = headers.indexOf('LeadStatus');
    if (agentIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, agentIdx + 1, agentName);
    if (adIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, adIdx + 1, new Date());
    if (stIdx !== -1 && lead.LeadStatus === 'New') {
      updateSheetCell(SHEET_NAMES.LEADS, lead._row, stIdx + 1, 'Telecalling');
    }
    appendActivity(leadId, session.userId, 'Lead Assigned', 'Assigned to: ' + agentName);
    logUpdate(session.userId, 'Leads', leadId, { AssignedAgent: lead.AssignedAgent }, { AssignedAgent: agentName });
    return success(null, 'Lead assigned to ' + agentName);
  } catch(e) {
    return error(e.message);
  }
}

function deleteLead(leadId) {
  try {
    var session = requireLogin();
    enforceRBAC('Leads', 'delete');
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    deleteSheetRow(SHEET_NAMES.LEADS, lead._row);
    logDelete(session.userId, 'Leads', leadId, lead);
    return success(null, 'Lead deleted');
  } catch(e) {
    return error(e.message);
  }
}

function scheduleFollowUp(leadId, followUpDate, notes) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var headers = getHeaders(SHEET_NAMES.LEADS);
    var nfuIdx = headers.indexOf('NextFollowUpDate');
    if (nfuIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, nfuIdx + 1, new Date(followUpDate));
    appendActivity(leadId, session.userId, 'Follow-up Scheduled',
      'Date: ' + followUpDate + (notes ? ' | ' + notes : ''));
    return success(null, 'Follow-up scheduled for ' + followUpDate);
  } catch (e) {
    return error(e.message);
  }
}

// ---- Update Shortlist fields ----
function updateShortlist(leadId, matchedIds, sharedVia, clientReaction) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var headers = getHeaders(SHEET_NAMES.LEADS);

    var updates = {
      MatchedPropertyIDs: matchedIds ? matchedIds.join(',') : lead.MatchedPropertyIDs,
      ShortlistCount: matchedIds ? matchedIds.length : lead.ShortlistCount,
      SharedDate: new Date(),
      SharedVia: sharedVia || lead.SharedVia,
      ClientReaction: clientReaction || lead.ClientReaction
    };

    Object.keys(updates).forEach(function(f) {
      var idx = headers.indexOf(f);
      if (idx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, idx + 1, updates[f]);
    });

    appendActivity(leadId, session.userId, 'Shortlist Updated',
      (matchedIds ? matchedIds.length + ' properties shortlisted' : '') +
      (sharedVia ? ' | Shared via: ' + sharedVia : '') +
      (clientReaction ? ' | Client: ' + clientReaction : ''));

    return success(null, 'Shortlist updated');
  } catch(e) {
    return error(e.message);
  }
}

// ---- Requirement Sharing (Privacy-safe broker network) ----
function generateRequirementShareLink(leadId) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');

    var shareId = 'SHR-' + leadId + '-' + new Date().getTime().toString(36).toUpperCase();
    var expiry = new Date();
    expiry.setDate(expiry.getDate() + 30); // 30-day expiry

    appendToSheet(SHEET_NAMES.REQ_SHARING, [
      shareId, leadId, session.userId, new Date(),
      '', '', expiry, 0, 'Active'
    ]);

    // Mark on lead
    var headers = getHeaders(SHEET_NAMES.LEADS);
    var slIdx = headers.indexOf('ShareLinkGenerated');
    var siIdx = headers.indexOf('ShareID');
    if (slIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, slIdx + 1, 'Yes');
    if (siIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, siIdx + 1, shareId);

    appendActivity(leadId, session.userId, 'Share Link Generated', 'ShareID: ' + shareId);
    return success({ shareId: shareId, expiry: expiry }, 'Requirement share link generated');
  } catch(e) {
    return error(e.message);
  }
}

// Returns only requirement fields (no client personal info) for sharing
function getSharedRequirement(shareId) {
  try {
    var share = findRowById(SHEET_NAMES.REQ_SHARING, 'ShareID', shareId);
    if (!share) return error('Share link invalid or expired.');
    if (share.Status !== 'Active') return error('Share link is no longer active.');
    if (new Date(share.ExpiryDate) < new Date()) return error('Share link has expired.');

    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', share.LeadID);
    if (!lead) return error('Requirement not found.');

    // Return only requirement fields — NO personal contact info
    var safeData = {
      ShareID: shareId,
      TransactionType: lead.TransactionType,
      Category: lead.Category,
      SubCategory: lead.SubCategory,
      BudgetMin: lead.BudgetMin,
      BudgetMax: lead.BudgetMax,
      BudgetFlexible: lead.BudgetFlexible,
      LocationPref1: lead.LocationPref1,
      LocationPref2: lead.LocationPref2,
      LocationPref3: lead.LocationPref3,
      LocationStrictness: lead.LocationStrictness,
      BHKMin: lead.BHKMin,
      BHKMax: lead.BHKMax,
      Furnishing: lead.Furnishing,
      AmenitiesRequired: lead.AmenitiesRequired,
      PossessionStatusRequired: lead.PossessionStatusRequired,
      FacingPreference: lead.FacingPreference,
      ParkingRequired: lead.ParkingRequired,
      FundingType: lead.FundingType,
      UrgencyLevel: lead.UrgencyLevel,
      Purpose: lead.Purpose,
      SpecialNotes: lead.SpecialNotes,
      TenantType: lead.TenantType,
      FamilySize: lead.FamilySize,
      FoodPreference: lead.FoodPreference,
      PetsAllowed: lead.PetsAllowed
    };
    return success(safeData, 'Requirement data (privacy-safe)');
  } catch(e) {
    return error(e.message);
  }
}

// ---- Scoring ----
function calculateLeadScore(lead) {
  var score = 0;

  // Budget (0-25 pts)
  var budget = safeNum(lead.BudgetMax || lead.Budget || 0);
  if (budget >= 10000000) score += 25;
  else if (budget >= 5000000) score += 20;
  else if (budget >= 2000000) score += 15;
  else if (budget > 0) score += 10;

  // Urgency (0-25 pts)
  var urgency = lead.UrgencyLevel || lead.Urgency || '';
  if (urgency === 'Immediate') score += 25;
  else if (urgency === '1-3 months') score += 18;
  else if (urgency === '3-6 months') score += 10;
  else score += 5;

  // Credibility (0-25 pts)
  if (lead.Email) score += 8;
  if (lead.WhatsAppNumber) score += 5;
  if (lead.SpecialNotes && String(lead.SpecialNotes).length > 10) score += 4;
  var premiumSources = ['Housing.com', 'MagicBricks', '99acres', 'Referral'];
  if (premiumSources.indexOf(lead.Source) !== -1) score += 8;
  else score += 4;

  // Engagement (0-25 pts)
  if (lead.LocationPref1 || lead.Location) score += 8;
  if (lead.Category || lead.PropertyType) score += 8;
  if (lead.FundingType) score += 5;
  if (lead.KYCDocumentsReady === 'Yes') score += 4;

  return Math.min(100, score);
}

function getScoreCategory(score) {
  var t = getLeadScoreThresholds();
  if (score >= t.hot) return 'Hot';
  if (score >= t.warm) return 'Warm';
  return 'Cold';
}

function scoreLead(leadId) {
  try {
    requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var score = calculateLeadScore(lead);
    var cat = getScoreCategory(score);
    var headers = getHeaders(SHEET_NAMES.LEADS);
    var sIdx = headers.indexOf('Score');
    var cIdx = headers.indexOf('ScoreCategory');
    if (sIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, sIdx + 1, score);
    if (cIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, cIdx + 1, cat);
    return success({ score: score, category: cat });
  } catch(e) {
    return error(e.message);
  }
}

// ---- Duplicate Detection ----
function duplicateDetection(data) {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var phone = cleanPhone(data.PrimaryPhone || data.Mobile || '');
    var wa = cleanPhone(data.WhatsAppNumber || '');
    var email = String(data.Email || '').toLowerCase();
    var name = String(data.FullName || data.Name || '').toLowerCase();

    for (var i = 0; i < leads.length; i++) {
      var l = leads[i];
      if (phone && cleanPhone(l.PrimaryPhone || '') === phone) {
        return { isDuplicate: true, reason: 'Same primary phone', existingId: l.LeadID };
      }
      if (wa && cleanPhone(l.WhatsAppNumber || '') === wa) {
        return { isDuplicate: true, reason: 'Same WhatsApp number', existingId: l.LeadID };
      }
      if (email && String(l.Email || '').toLowerCase() === email) {
        return { isDuplicate: true, reason: 'Same email', existingId: l.LeadID };
      }
      if (name && String(l.FullName || '').toLowerCase() === name &&
          phone && cleanPhone(l.PrimaryPhone || '').slice(-6) === phone.slice(-6)) {
        return { isDuplicate: true, reason: 'Same name + similar phone', existingId: l.LeadID };
      }
    }
    return { isDuplicate: false };
  } catch(e) {
    return { isDuplicate: false };
  }
}

// ---- Activity Logging ----
function getLeadActivities(leadId) {
  try {
    var rows = getSheetData(SHEET_NAMES.ACTIVITIES);
    return rows.filter(function(r) { return r.LeadID === leadId; })
      .sort(function(a, b) { return new Date(b.Date) - new Date(a.Date); });
  } catch(e) { return []; }
}

function appendActivity(leadId, userId, action, notes) {
  try {
    appendToSheet(SHEET_NAMES.ACTIVITIES, [
      generateUniqueId('ACT'), leadId, new Date(), userId, action, notes || ''
    ]);
  } catch(e) { Logger.log('appendActivity: ' + e); }
}

// ---- Auto-Assignment (Round-robin by workload) ----
function autoAssignLead(leadId) {
  try {
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return;
    var agents = getActiveAgents();
    if (!agents.length) return;

    // Filter by specialization
    var category = lead.Category || '';
    var matching = agents.filter(function(a) {
      return a.Specialization === 'All' || a.Specialization === category;
    });
    if (!matching.length) matching = agents;

    // Round-robin: pick least loaded
    var allLeads = getSheetData(SHEET_NAMES.LEADS);
    var counts = {};
    matching.forEach(function(a) { counts[a.Name] = 0; });
    allLeads.forEach(function(l) {
      if (l.AssignedAgent && counts[l.AssignedAgent] !== undefined) counts[l.AssignedAgent]++;
    });
    var minAgent = matching.reduce(function(prev, curr) {
      return (counts[curr.Name] < counts[prev.Name]) ? curr : prev;
    });
    assignLead(leadId, minAgent.Name);
  } catch(e) { Logger.log('autoAssignLead: ' + e); }
}

function getActiveAgents() {
  try {
    var agents = getSheetData(SHEET_NAMES.AGENTS);
    return agents.filter(function(a) {
      return String(a.ActiveStatus).toLowerCase() === 'yes' || a.ActiveStatus === true;
    });
  } catch(e) {
    // Fallback to Users sheet
    var users = getSheetData(SHEET_NAMES.USERS);
    return users.filter(function(u) {
      return (u.Role === 'Agent' || u.Role === 'Manager') && u.Status === 'Active';
    }).map(function(u) {
      return { Name: u.Name, Specialization: u.Specialization || 'All' };
    });
  }
}

// ---- Search & Export ----
function searchLeads(query, filters) {
  return getAllLeads(Object.assign({}, filters || {}, { search: query }));
}

function exportLeadsCSV(filters) {
  try {
    requireLogin();
    enforceRBAC('Leads', 'export');
    var result = getAllLeads(Object.assign({}, filters, { pageSize: 5000 }));
    var rows = result.data ? result.data.data : [];
    var headers = [
      'LeadID', 'DateCreated', 'Source', 'FullName', 'PrimaryPhone',
      'Email', 'LeadType', 'Category', 'TransactionType',
      'BudgetMin', 'BudgetMax', 'LocationPref1', 'UrgencyLevel',
      'LeadStatus', 'AssignedAgent', 'Score', 'ScoreCategory'
    ];
    var csv = headers.join(',') + '\n';
    rows.forEach(function(r) {
      csv += headers.map(function(h) {
        return '"' + String(r[h] || '').replace(/"/g, '""') + '"';
      }).join(',') + '\n';
    });
    return success(csv, 'Export ready');
  } catch(e) {
    return error(e.message);
  }
}

function bulkImportLeads(dataArray) {
  try {
    var session = requireLogin();
    enforceRBAC('Leads', 'create');
    var results = { success: 0, failed: 0, errors: [] };
    dataArray.forEach(function(data, idx) {
      var res = createLead(data);
      if (res.success) results.success++;
      else { results.failed++; results.errors.push('Row ' + (idx + 1) + ': ' + res.message); }
    });
    return success(results, 'Bulk import: ' + results.success + ' added, ' + results.failed + ' failed');
  } catch(e) {
    return error(e.message);
  }
}

function archiveLead(leadId) {
  return updateLeadStatus(leadId, 'Archived', 'Manually archived');
}

// ---- Site Visit tracking on lead record ----
function recordVisitOnLead(leadId, propertyId, visitDate, feedback) {
  try {
    var session = requireLogin();
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');
    var headers = getHeaders(SHEET_NAMES.LEADS);

    var pvIdx = headers.indexOf('PropertiesVisited');
    var vdIdx = headers.indexOf('VisitDates');
    var vfIdx = headers.indexOf('VisitFeedback');

    var pvExisting = String(lead.PropertiesVisited || '');
    var vdExisting = String(lead.VisitDates || '');
    var vfExisting = String(lead.VisitFeedback || '');

    if (pvIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, pvIdx + 1,
      pvExisting ? pvExisting + ',' + propertyId : propertyId);
    if (vdIdx !== -1) updateSheetCell(SHEET_NAMES.LEADS, lead._row, vdIdx + 1,
      vdExisting ? vdExisting + ',' + formatDate(visitDate) : formatDate(visitDate));
    if (vfIdx !== -1 && feedback) updateSheetCell(SHEET_NAMES.LEADS, lead._row, vfIdx + 1,
      vfExisting ? vfExisting + '\n' + propertyId + ': ' + feedback : propertyId + ': ' + feedback);

    return success(null, 'Visit recorded on lead');
  } catch(e) {
    return error(e.message);
  }
}
