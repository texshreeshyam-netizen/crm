// ============================================================
// Audit.gs — Activity & Audit Trail Logging
// SignatureReality CRM v1.0
// ============================================================

function logActivity(userId, action, resource, resourceId, oldValue, newValue, status, details) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.AUDIT_LOG);
    if (!sheet) return;
    var now = new Date();
    var logId = generateUniqueId('LOG');
    sheet.appendRow([
      logId,
      formatDate(now),
      now.toLocaleTimeString('en-IN'),
      userId || '',
      action || '',
      resource || '',
      resourceId || '',
      oldValue !== undefined ? jsonStringify(oldValue) : '',
      newValue !== undefined ? jsonStringify(newValue) : '',
      status || 'Success',
      details || ''
    ]);
  } catch (e) {
    Logger.log('logActivity error: ' + e);
  }
}

function logCreate(userId, resource, resourceId, newValue) {
  logActivity(userId, 'CREATE', resource, resourceId, null, newValue, 'Success', '');
}

function logUpdate(userId, resource, resourceId, oldValue, newValue) {
  logActivity(userId, 'UPDATE', resource, resourceId, oldValue, newValue, 'Success', '');
}

function logDelete(userId, resource, resourceId, oldValue) {
  logActivity(userId, 'DELETE', resource, resourceId, oldValue, null, 'Success', '');
}

function logLogin(userId, status, details) {
  logActivity(userId, 'LOGIN', 'Auth', userId, null, null, status || 'Success', details || '');
}

function logLogout(userId) {
  logActivity(userId, 'LOGOUT', 'Auth', userId, null, null, 'Success', '');
}

function logError(userId, action, resource, resourceId, details) {
  logActivity(userId, action, resource, resourceId, null, null, 'Failure', details);
}

function getActivityLog(filters) {
  try {
    requireLogin();
    enforceRBAC('AuditLog', 'read');
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.AUDIT_LOG);
    if (filters.userId) {
      rows = rows.filter(function(r) { return r.UserID === filters.userId; });
    }
    if (filters.resource) {
      rows = rows.filter(function(r) { return r.Resource === filters.resource; });
    }
    if (filters.action) {
      rows = rows.filter(function(r) { return r.Action === filters.action; });
    }
    if (filters.resourceId) {
      rows = rows.filter(function(r) { return r.ResourceID === filters.resourceId; });
    }
    if (filters.fromDate) {
      var fd = new Date(filters.fromDate);
      rows = rows.filter(function(r) { return new Date(r.Date) >= fd; });
    }
    rows.sort(function(a, b) { return new Date(b.Date) - new Date(a.Date); });
    return success(paginateArray(rows, filters.page, filters.pageSize || 100));
  } catch (e) {
    Logger.log('getActivityLog error: ' + e);
    return error(e.message);
  }
}

function exportAuditLog() {
  try {
    var rows = getSheetData(SHEET_NAMES.AUDIT_LOG);
    var csv = 'LogID,Date,Time,UserID,Action,Resource,ResourceID,Status,Details\n';
    rows.forEach(function(r) {
      csv += [r.LogID, r.Date, r.Time, r.UserID, r.Action, r.Resource,
        r.ResourceID, r.Status, '"' + (r.Details || '') + '"'].join(',') + '\n';
    });
    return csv;
  } catch (e) {
    return '';
  }
}

function trackDataChange(userId, resource, resourceId, oldObj, newObj) {
  var changes = [];
  Object.keys(newObj || {}).forEach(function(k) {
    if (k === '_row') return;
    if (String(oldObj[k]) !== String(newObj[k])) {
      changes.push(k + ': ' + oldObj[k] + ' → ' + newObj[k]);
    }
  });
  if (changes.length > 0) {
    logActivity(userId, 'UPDATE', resource, resourceId, oldObj, newObj, 'Success', changes.join(' | '));
  }
}

function cleanOldAuditLogs() {
  try {
    var retainDays = 365; // keep 1 year
    var sheet = getSheet(SHEET_NAMES.AUDIT_LOG);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var dateIdx = headers.indexOf('Date');
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retainDays);
    var rowsToDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (new Date(data[i][dateIdx]) < cutoff) {
        rowsToDelete.push(i + 1);
      }
    }
    rowsToDelete.forEach(function(r) { sheet.deleteRow(r); });
    return rowsToDelete.length;
  } catch (e) {
    Logger.log('cleanOldAuditLogs error: ' + e);
    return 0;
  }
}
