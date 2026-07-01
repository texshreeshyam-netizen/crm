// ============================================================
// Utils.gs — Utility / Helper Functions
// Signature Realty CRM V10
// ============================================================

function generateUniqueId(prefix) {
  var ts = new Date().getTime().toString(36).toUpperCase();
  var rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return (prefix || 'ID') + '-' + ts + rand;
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName + '. Run setupCRM() first.');
  return sheet;
}

// Safe version — returns [] if sheet missing (does not throw)
function safeGetSheetData(sheetName) {
  try {
    return getSheetData(sheetName);
  } catch(e) {
    Logger.log('safeGetSheetData: ' + sheetName + ' — ' + e.message);
    return [];
  }
}

function getSheetData(sheetName) {
  try {
    var sheet = getSheet(sheetName);
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = data[0];
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // skip blank rows
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      obj['_row'] = i + 1;
      rows.push(obj);
    }
    return rows;
  } catch(e) {
    Logger.log('getSheetData error [' + sheetName + ']: ' + e.message);
    throw e; // re-throw so callers that need to know still get the error
  }
}

function appendToSheet(sheetName, rowArray) {
  var sheet = getSheet(sheetName);
  sheet.appendRow(rowArray);
}

function updateSheetRow(sheetName, rowIndex, rowArray) {
  var sheet = getSheet(sheetName);
  var range = sheet.getRange(rowIndex, 1, 1, rowArray.length);
  range.setValues([rowArray]);
}

function updateSheetCell(sheetName, rowIndex, colIndex, value) {
  var sheet = getSheet(sheetName);
  sheet.getRange(rowIndex, colIndex).setValue(value);
}

function findRowById(sheetName, idColumn, id) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx = headers.indexOf(idColumn);
  if (colIdx === -1) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(id)) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      obj['_row'] = i + 1;
      return obj;
    }
  }
  return null;
}

function deleteSheetRow(sheetName, rowIndex) {
  var sheet = getSheet(sheetName);
  sheet.deleteRow(rowIndex);
}

function getLastRow(sheetName) {
  var sheet = getSheet(sheetName);
  return sheet.getLastRow();
}

function formatCurrency(amount) {
  if (!amount) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDate(date) {
  if (!date) return '';
  var d = new Date(date);
  if (isNaN(d)) return String(date);
  var day = ('0' + d.getDate()).slice(-2);
  var mon = ('0' + (d.getMonth() + 1)).slice(-2);
  var yr = d.getFullYear();
  return day + '/' + mon + '/' + yr;
}

function formatDateTime(date) {
  if (!date) return '';
  var d = new Date(date);
  if (isNaN(d)) return String(date);
  return formatDate(d) + ' ' + d.toLocaleTimeString('en-IN');
}

function nowIST() {
  return new Date();
}

function nowISOString() {
  return new Date().toISOString();
}

function stripHtml(str) {
  return String(str || '').replace(/<[^>]*>/g, '');
}

function trimStr(str) {
  return String(str || '').trim();
}

function isBlank(val) {
  return val === null || val === undefined || String(val).trim() === '';
}

function safeNum(val, def) {
  var n = Number(val);
  return isNaN(n) ? (def || 0) : n;
}

function sheetRowToArray(headers, obj) {
  return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
}

function getHeaders(sheetName) {
  var sheet = getSheet(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function objectToRow(sheetName, obj) {
  var headers = getHeaders(sheetName);
  return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
}

function rowToObject(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

function paginateArray(arr, page, pageSize) {
  page = page || 1;
  pageSize = pageSize || 50;
  var start = (page - 1) * pageSize;
  return {
    data: arr.slice(start, start + pageSize),
    total: arr.length,
    page: page,
    pageSize: pageSize,
    totalPages: Math.ceil(arr.length / pageSize)
  };
}

function filterByQuery(arr, query, fields) {
  if (!query) return arr;
  var q = query.toLowerCase();
  return arr.filter(function(row) {
    return fields.some(function(f) {
      return String(row[f] || '').toLowerCase().indexOf(q) !== -1;
    });
  });
}

function sortArray(arr, field, dir) {
  dir = dir === 'desc' ? -1 : 1;
  return arr.sort(function(a, b) {
    if (a[field] < b[field]) return -1 * dir;
    if (a[field] > b[field]) return 1 * dir;
    return 0;
  });
}

function generateReceiptNumber() {
  var d = new Date();
  return 'RCP-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) +
    ('0' + d.getDate()).slice(-2) + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function success(data, message) {
  return { success: true, data: data, message: message || 'OK' };
}

function error(message, code) {
  return { success: false, message: message || 'Error', code: code || 500 };
}

function cloneObj(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function arrayUnique(arr) {
  return arr.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function getWeekStart(date) {
  var d = new Date(date || new Date());
  var day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date) {
  var d = new Date(date || new Date());
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getYearStart(date) {
  var d = new Date(date || new Date());
  return new Date(d.getFullYear(), 0, 1);
}

function daysBetween(d1, d2) {
  var a = new Date(d1);
  var b = new Date(d2 || new Date());
  return Math.floor(Math.abs(b - a) / 86400000);
}

function jsonStringify(obj) {
  try { return JSON.stringify(obj); } catch(e) { return '{}'; }
}

function jsonParse(str) {
  try { return JSON.parse(str); } catch(e) { return {}; }
}
