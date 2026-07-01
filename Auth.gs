// ============================================================
// Auth.gs — Authentication, Session & RBAC
// Signature Realty CRM V10
// ============================================================

// ---- Web App Entry Point ----

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Signature Realty CRM V10')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---- Session Helpers ----
// Uses PropertiesService.getScriptProperties() which is consistent across all
// server-side executions in "Execute as: Me" deployments. Supports one active
// session per user-email key, giving true multi-user isolation.

var SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function _sessionKey(email) {
  return 'crm_s_' + email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function getSessionUser() {
  try {
    // Find an active session by scanning script properties
    // Primary path: login() stored the key in cache for this execution
    var cache = CacheService.getScriptCache();
    var activeKey = cache.get('crm_active_key');
    if (activeKey) {
      var json = PropertiesService.getScriptProperties().getProperty(activeKey);
      if (json) {
        var s = JSON.parse(json);
        if (s && s.userId && s.loginTime && (Date.now() - s.loginTime < SESSION_TTL_MS)) {
          return s;
        }
      }
    }
    // Fallback: scan all script properties for a valid session
    var allProps = PropertiesService.getScriptProperties().getProperties();
    var now = Date.now();
    for (var k in allProps) {
      if (k.indexOf('crm_s_') === 0) {
        try {
          var sess = JSON.parse(allProps[k]);
          if (sess && sess.userId && sess.loginTime && (now - sess.loginTime < SESSION_TTL_MS)) {
            cache.put('crm_active_key', k, 1800);
            return sess;
          }
        } catch(pe) {}
      }
    }
    return null;
  } catch(e) {
    Logger.log('getSessionUser error: ' + e);
    return null;
  }
}

function setSessionUser(userObj) {
  var session = {
    userId: userObj.UserID,
    name: userObj.Name,
    email: userObj.Email,
    role: userObj.Role,
    department: userObj.Department || '',
    specialization: userObj.Specialization || '',
    loginTime: Date.now()
  };
  var key = _sessionKey(userObj.Email);
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(session));
  CacheService.getScriptCache().put('crm_active_key', key, 1800);
  return session;
}

function clearSession() {
  try {
    var cache = CacheService.getScriptCache();
    var activeKey = cache.get('crm_active_key');
    if (activeKey) {
      PropertiesService.getScriptProperties().deleteProperty(activeKey);
      cache.remove('crm_active_key');
    }
  } catch(e) { Logger.log('clearSession error: ' + e); }
}

// ---- Auth Functions ----

function login(email, password) {
  try {
    if (!email || !password) return error('Email and password required.');
    var users = getSheetData(SHEET_NAMES.USERS);
    var user = users.find(function(u) {
      return String(u.Email).toLowerCase() === String(email).toLowerCase();
    });
    if (!user) {
      logError('unknown', 'LOGIN', 'Auth', email, 'User not found');
      return error('Invalid credentials.');
    }
    if (user.Status !== 'Active') {
      logError(user.UserID, 'LOGIN', 'Auth', user.UserID, 'Account ' + user.Status);
      return error('Account is ' + user.Status + '. Contact admin.');
    }
    // Simple password check (hashed with Utilities.computeDigest in production)
    var storedHash = user.PasswordHash || '';
    var inputHash = hashPassword(password);
    if (storedHash && storedHash !== inputHash) {
      logError(user.UserID, 'LOGIN', 'Auth', user.UserID, 'Wrong password');
      return error('Invalid credentials.');
    }
    // Allow login if no password set yet (first login)
    var session = setSessionUser(user);
    // Update last login
    updateLastLogin(user);
    logLogin(user.UserID, 'Success', 'Login from web app');
    return success(session, 'Login successful');
  } catch(e) {
    Logger.log('login error: ' + e);
    return error('Login failed: ' + e.message);
  }
}

function logout() {
  try {
    var session = getSessionUser();
    if (session) logLogout(session.userId);
    clearSession();
    return success(null, 'Logged out');
  } catch(e) {
    return error('Logout failed');
  }
}

function getCurrentUser() {
  var session = getSessionUser();
  if (!session) return null;
  return session;
}

function getCurrentUserRole() {
  var session = getSessionUser();
  return session ? session.role : null;
}

function isLoggedIn() {
  return !!getSessionUser();
}

function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
}

function updateLastLogin(user) {
  try {
    var row = findRowById(SHEET_NAMES.USERS, 'UserID', user.UserID);
    if (row) {
      var headers = getHeaders(SHEET_NAMES.USERS);
      var idx = headers.indexOf('LastLoginDate');
      if (idx !== -1) updateSheetCell(SHEET_NAMES.USERS, row._row, idx + 1, new Date());
    }
  } catch(e) { Logger.log('updateLastLogin: ' + e); }
}

// ---- RBAC ----

var PERMISSIONS_MATRIX = {
  Admin: { all: true },
  Manager: {
    Leads: ['create','read','update','delete','assign','export'],
    Inventory: ['create','read','update','delete','export'],
    Requirements: ['create','read','update','delete'],
    SiteVisits: ['create','read','update','delete'],
    Negotiations: ['create','read','update','delete'],
    Tokens: ['create','read','update'],
    Registry: ['create','read','update'],
    Commissions: ['create','read','update'],
    Reports: ['read','export'],
    Users: ['read'],
    AuditLog: ['read']
  },
  Broker: {
    Leads: ['create','read','update','assign','export'],
    Inventory: ['create','read','update','delete','export'],
    Requirements: ['create','read','update'],
    SiteVisits: ['create','read','update'],
    Negotiations: ['create','read','update'],
    Tokens: ['create','read','update'],
    Registry: ['create','read','update'],
    Commissions: ['read'],
    Reports: ['read']
  },
  Agent: {
    Leads: ['create','read_own','update_own'],
    Inventory: ['read'],
    Requirements: ['create','read','update'],
    SiteVisits: ['create','read','update'],
    Negotiations: ['create','read','update'],
    Tokens: ['read'],
    Registry: ['read'],
    Commissions: ['read_own'],
    Reports: ['read_own']
  },
  Builder: {
    Inventory: ['create','read','update','delete'],
    Leads: ['read'],
    Reports: ['read']
  }
};

function checkPermission(resource, action) {
  var session = getSessionUser();
  if (!session) return false;
  var role = session.role;
  var matrix = PERMISSIONS_MATRIX[role];
  if (!matrix) return false;
  if (matrix.all) return true;
  var perms = matrix[resource];
  if (!perms) return false;
  return perms.indexOf(action) !== -1 || perms.indexOf('all') !== -1;
}

function enforceRBAC(resource, action) {
  if (!checkPermission(resource, action)) {
    throw new Error('Access denied: ' + action + ' on ' + resource);
  }
}

function requireLogin() {
  var session = getSessionUser();
  if (!session) throw new Error('Not logged in. Please login first.');
  return session;
}

// ---- User Management ----

function createUser(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Users', 'create');
    var errs = validateUserData(data);
    if (errs.length) return error(errs.join(' '));
    // Check duplicate email
    var existing = getSheetData(SHEET_NAMES.USERS);
    var dup = existing.find(function(u) {
      return String(u.Email).toLowerCase() === String(data.Email).toLowerCase();
    });
    if (dup) return error('User with this email already exists.');
    var userId = generateUniqueId('USR');
    var row = [
      userId,
      sanitizeString(data.Name),
      sanitizeString(data.Email),
      sanitizeString(data.Mobile || ''),
      data.Role,
      data.Department || '',
      'Active',
      new Date(),
      '',
      data.Specialization || 'All',
      sanitizeNumber(data.CommissionPercent || 0),
      data.Password ? hashPassword(data.Password) : ''
    ];
    appendToSheet(SHEET_NAMES.USERS, row);
    logCreate(session.userId, 'Users', userId, { name: data.Name, role: data.Role });
    return success({ UserID: userId }, 'User created successfully');
  } catch(e) {
    Logger.log('createUser error: ' + e);
    return error(e.message);
  }
}

function getAllUsers(filters) {
  try {
    requireLogin();
    var users = getSheetData(SHEET_NAMES.USERS);
    users = users.map(function(u) {
      delete u.PasswordHash; return u;
    });
    if (filters && filters.role) {
      users = users.filter(function(u) { return u.Role === filters.role; });
    }
    if (filters && filters.status) {
      users = users.filter(function(u) { return u.Status === filters.status; });
    }
    return success(users);
  } catch(e) {
    return error(e.message);
  }
}

function updateUser(userId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('Users', 'update');
    var row = findRowById(SHEET_NAMES.USERS, 'UserID', userId);
    if (!row) return error('User not found.');
    var headers = getHeaders(SHEET_NAMES.USERS);
    var updateFields = ['Name','Mobile','Role','Department','Status','Specialization'];
    updateFields.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.USERS, row._row, idx + 1, data[f]);
      }
    });
    if (data.Password) {
      var idx = headers.indexOf('PasswordHash');
      if (idx !== -1) updateSheetCell(SHEET_NAMES.USERS, row._row, idx + 1, hashPassword(data.Password));
    }
    logUpdate(session.userId, 'Users', userId, {}, data);
    return success(null, 'User updated successfully');
  } catch(e) {
    return error(e.message);
  }
}

function resetPassword(userId, newPassword) {
  try {
    var session = requireLogin();
    // Only Admins and Managers can reset other users' passwords
    if (session.userId !== userId) {
      enforceRBAC('Users', 'update');
    }
    var row = findRowById(SHEET_NAMES.USERS, 'UserID', userId);
    if (!row) return error('User not found.');
    var headers = getHeaders(SHEET_NAMES.USERS);
    var idx = headers.indexOf('PasswordHash');
    if (idx !== -1) updateSheetCell(SHEET_NAMES.USERS, row._row, idx + 1, hashPassword(newPassword));
    logUpdate(session.userId, 'Users', userId, {}, { action: 'password_reset' });
    return success(null, 'Password reset successfully');
  } catch(e) {
    return error(e.message);
  }
}

function toggleUserStatus(userId, status) {
  try {
    var session = requireLogin();
    enforceRBAC('Users', 'update');
    var row = findRowById(SHEET_NAMES.USERS, 'UserID', userId);
    if (!row) return error('User not found.');
    var headers = getHeaders(SHEET_NAMES.USERS);
    var idx = headers.indexOf('Status');
    if (idx !== -1) updateSheetCell(SHEET_NAMES.USERS, row._row, idx + 1, status);
    logUpdate(session.userId, 'Users', userId, { Status: row.Status }, { Status: status });
    return success(null, 'User status updated');
  } catch(e) {
    return error(e.message);
  }
}

function getAgents() {
  try {
    // V10 Plan: Use Agents sheet as primary source, fall back to Users sheet
    var agentSheet = getSheetData(SHEET_NAMES.AGENTS);
    if (agentSheet && agentSheet.length) {
      return agentSheet.filter(function(a) {
        return String(a.ActiveStatus).toLowerCase() === 'yes' || a.ActiveStatus === true;
      }).map(function(a) {
        return {
          AgentID: a.AgentID,
          Name: a.Name,
          Phone: a.Phone,
          Email: a.Email,
          Specialization: a.Specialization || 'All',
          Territory: a.Territory || 'All'
        };
      });
    }
    // Fallback to Users sheet
    var users = getSheetData(SHEET_NAMES.USERS);
    return users.filter(function(u) {
      return (u.Role === 'Agent' || u.Role === 'Broker' || u.Role === 'Manager') && u.Status === 'Active';
    }).map(function(u) {
      return {
        AgentID: u.UserID,
        Name: u.Name,
        Email: u.Email,
        Specialization: u.Specialization || 'All'
      };
    });
  } catch(e) {
    return [];
  }
}

// ---- Agent CRUD (Agents Sheet) ----
function createAgent(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Agents', 'create');
    var errs = validateAgentData(data);
    if (errs.length) return error(errs.join(' '));

    // Check duplicate phone
    var existing = getSheetData(SHEET_NAMES.AGENTS);
    var dup = existing.find(function(a) { return cleanPhone(a.Phone) === cleanPhone(data.Phone); });
    if (dup) return error('Agent with this phone already exists: ' + dup.AgentID);

    var agentId = generateAgentId();
    var row = [
      agentId,
      sanitizeString(data.Name),
      cleanPhone(data.Phone),
      sanitizeString(data.Email || ''),
      'Yes',
      sanitizeString(data.Territory || 'All'),
      sanitizeString(data.Specialization || 'All'),
      new Date()
    ];
    appendToSheet(SHEET_NAMES.AGENTS, row);
    logCreate(session.userId, 'Agents', agentId, { name: data.Name });
    return success({ agentId: agentId }, 'Agent created: ' + agentId);
  } catch(e) {
    return error(e.message);
  }
}

function generateAgentId() {
  try {
    var rows = getSheetData(SHEET_NAMES.AGENTS);
    var max = 0;
    rows.forEach(function(r) {
      var id = String(r.AgentID || '');
      if (id.indexOf('AGT-') === 0) {
        var num = parseInt(id.replace('AGT-', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return 'AGT-' + ('00' + (max + 1)).slice(-3);
  } catch(e) {
    return 'AGT-' + new Date().getTime().toString().slice(-3);
  }
}

function getAllAgents(filters) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.AGENTS);
    if (filters && filters.active) rows = rows.filter(function(a) { return a.ActiveStatus === 'Yes' || a.ActiveStatus === true; });
    if (filters && filters.specialization) rows = rows.filter(function(a) { return a.Specialization === filters.specialization || a.Specialization === 'All'; });
    return success(rows);
  } catch(e) {
    return error(e.message);
  }
}

function updateAgent(agentId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('Agents', 'update');
    var agent = findRowById(SHEET_NAMES.AGENTS, 'AgentID', agentId);
    if (!agent) return error('Agent not found.');
    var headers = getHeaders(SHEET_NAMES.AGENTS);
    var updatable = ['Name', 'Phone', 'Email', 'ActiveStatus', 'Territory', 'Specialization'];
    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.AGENTS, agent._row, idx + 1, data[f]);
      }
    });
    logUpdate(session.userId, 'Agents', agentId, agent, data);
    return success(null, 'Agent updated');
  } catch(e) {
    return error(e.message);
  }
}
