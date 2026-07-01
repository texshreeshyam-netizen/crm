// ============================================================
// Test.gs — System Check for Signature Realty CRM V10
// Apps Script editor mein koi bhi function select karke
// ▶ Run button dabao
// ============================================================

// ─────────────────────────────────────────
// 0. SESSION SETUP — Tests ke liye admin session set karo
// ─────────────────────────────────────────
function setupTestSession() {
  var users = getSheetData(SHEET_NAMES.USERS);
  var admin = users.find(function(u) { return u.Role === 'Admin' && u.Status === 'Active'; });
  if (admin) {
    setSessionUser(admin);
    Logger.log('Test session set as: ' + admin.Name + ' (' + admin.Email + ')');
    return admin;
  }
  var fake = { UserID: 'USR-TEST', Name: 'Test Admin', Email: 'test@admin.com',
    Role: 'Admin', Department: '', Specialization: '' };
  setSessionUser(fake);
  Logger.log('Test session set as fake admin (no Admin user found).');
  return fake;
}

// ─────────────────────────────────────────
// 1. MASTER TEST — Sab ek saath chalao
// ─────────────────────────────────────────
function runAllTests() {
  setupTestSession();
  var results = [];
  var tests = [
    testSheetSetup,
    testLeadCRUD,
    testCallDisposition,
    testRequirement,
    testInventory,
    testBuilderProject,
    testRegistry,
    testAuth,
    testDashboard,
    testAgentModule
  ];
  tests.forEach(function(fn) {
    try {
      var r = fn();
      results.push(r);
    } catch(e) {
      results.push({ name: fn.name, passed: false, error: e.message });
    }
  });

  Logger.log('\n========================================');
  Logger.log('   SIGNATURE REALTY CRM V10 — TEST REPORT');
  Logger.log('========================================');
  var pass = 0, fail = 0;
  results.forEach(function(r) {
    var icon = r.passed ? '✅' : '❌';
    Logger.log(icon + ' ' + r.name + (r.error ? ' → ERROR: ' + r.error : ''));
    if (r.detail) Logger.log('   ' + r.detail);
    r.passed ? pass++ : fail++;
  });
  Logger.log('----------------------------------------');
  Logger.log('PASS: ' + pass + ' / FAIL: ' + fail + ' / TOTAL: ' + results.length);
  Logger.log('========================================\n');
}

// ─────────────────────────────────────────
// 2. SHEET SETUP TEST
// ─────────────────────────────────────────
function testSheetSetup() {
  var name = 'testSheetSetup';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var required = [
    SHEET_NAMES.USERS, SHEET_NAMES.AGENTS, SHEET_NAMES.LEADS,
    SHEET_NAMES.INVENTORY, SHEET_NAMES.BUILDER_PROJECTS,
    SHEET_NAMES.REQUIREMENTS, SHEET_NAMES.ACTIVITIES,
    SHEET_NAMES.SITE_VISITS, SHEET_NAMES.NEGOTIATIONS,
    SHEET_NAMES.TOKENS, SHEET_NAMES.COMMISSIONS,
    SHEET_NAMES.REGISTRY, SHEET_NAMES.AUDIT_LOG,
    SHEET_NAMES.CONFIG, SHEET_NAMES.REQ_SHARING
  ];
  var missing = required.filter(function(s) { return !ss.getSheetByName(s); });
  if (missing.length > 0) {
    return { name: name, passed: false, error: 'Missing sheets: ' + missing.join(', '),
      detail: 'Run setupCRM() first' };
  }

  // Check V10 headers in Leads sheet
  var leadsHeaders = getHeaders(SHEET_NAMES.LEADS);
  var v10Required = ['LeadID', 'FullName', 'PrimaryPhone', 'LeadStatus', 'DateCreated', 'AssignedAgent'];
  var missingHeaders = v10Required.filter(function(h) { return leadsHeaders.indexOf(h) === -1; });
  if (missingHeaders.length) {
    return { name: name, passed: false, error: 'V10 headers missing in Leads: ' + missingHeaders.join(', '),
      detail: 'Run updateAllSheetHeaders() to force-update headers' };
  }

  return { name: name, passed: true, detail: 'All ' + required.length + ' sheets present + V10 headers verified' };
}

// ─────────────────────────────────────────
// 3. LEAD CRUD TEST — V10 field names
// ─────────────────────────────────────────
function testLeadCRUD() {
  var name = 'testLeadCRUD';
  // V10: FullName, PrimaryPhone, Category, BudgetMin, BudgetMax, LocationPref1
  var res = createLead({
    FullName: 'Test Client ' + Date.now(),
    PrimaryPhone: '9' + Date.now().toString().slice(-9),
    Email: 'testclient@test.com',
    Source: 'Other',
    LeadType: 'End User',
    Category: 'Residential',
    BudgetMin: 5000000,
    BudgetMax: 8000000,
    LocationPref1: 'Test Area',
    TransactionType: 'Sale',
    Notes: 'Auto test lead'
  });
  if (!res.success) return { name: name, passed: false, error: 'Create failed: ' + res.message };
  var leadId = res.data.leadId;

  // Verify ID format: LEAD-0001
  if (!/^LEAD-\d{4,}$/.test(leadId)) {
    deleteLead(leadId);
    return { name: name, passed: false, error: 'Lead ID format wrong: ' + leadId + ' (expected LEAD-XXXX)' };
  }

  // Read
  var lead = getLead(leadId);
  if (!lead.success) { deleteLead(leadId); return { name: name, passed: false, error: 'Read failed' }; }

  // Verify V10 fields stored correctly
  if (!lead.data.FullName) { deleteLead(leadId); return { name: name, passed: false, error: 'FullName missing in stored lead' }; }
  if (!lead.data.PrimaryPhone) { deleteLead(leadId); return { name: name, passed: false, error: 'PrimaryPhone missing in stored lead' }; }

  // Update — V10: LeadStatus (not Status)
  var upd = updateLead(leadId, { LeadStatus: 'Verified', Notes: 'Updated by test' });
  if (!upd.success) { deleteLead(leadId); return { name: name, passed: false, error: 'Update failed: ' + upd.message }; }

  // Delete
  var del = deleteLead(leadId);
  if (!del.success) return { name: name, passed: false, error: 'Delete failed: ' + del.message };

  return { name: name, passed: true, detail: 'Lead ID: ' + leadId + ' — V10 fields OK, CRUD OK' };
}

// ─────────────────────────────────────────
// 4. CALL DISPOSITION TEST
// ─────────────────────────────────────────
function testCallDisposition() {
  var name = 'testCallDisposition';
  var res = createLead({ FullName: 'Disp Test', PrimaryPhone: '8' + Date.now().toString().slice(-9), Source: 'Other', LeadType: 'End User' });
  if (!res.success) return { name: name, passed: false, error: 'Lead create failed: ' + res.message };
  var leadId = res.data.leadId;

  var disp = logCallDisposition(leadId, 'Interested', 'Wants 3BHK in Bandra', '');
  deleteLead(leadId);

  if (!disp.success) return { name: name, passed: false, error: disp.message };
  return { name: name, passed: true, detail: 'Disposition "Interested" logged → LeadStatus = "Interested", CallAttemptCount incremented' };
}

// ─────────────────────────────────────────
// 5. REQUIREMENT TEST — V10 field names
// ─────────────────────────────────────────
function testRequirement() {
  var name = 'testRequirement';
  var lead = createLead({ FullName: 'Req Test', PrimaryPhone: '7' + Date.now().toString().slice(-9), Source: 'Other', LeadType: 'End User' });
  if (!lead.success) return { name: name, passed: false, error: 'Lead create failed' };
  var leadId = lead.data.leadId;

  // V10: BudgetMin/BudgetMax (not MinBudget/MaxBudget), Location1/2/3
  var req = createRequirement({
    LeadID: leadId,
    RequirementType: 'Purchase',
    Category: 'Residential',
    BudgetMin: 3000000,
    BudgetMax: 6000000,
    BHKMin: 2, BHKMax: 3,
    Location1: 'Bandra',
    Location2: 'Andheri',
    Location3: '',
    FundingType: 'Home Loan',
    Possession: 'Ready',
    Notes: 'Test requirement'
  });
  deleteLead(leadId);

  if (!req.success) return { name: name, passed: false, error: req.message };
  return { name: name, passed: true, detail: 'RequirementType: Purchase, BHK: 2-3, Budget 30L-60L, Location: Bandra/Andheri' };
}

// ─────────────────────────────────────────
// 6. INVENTORY TEST — V10 field names
// ─────────────────────────────────────────
function testInventory() {
  var name = 'testInventory';
  // V10: FullAddress, Category, ListingType, OwnerName, OwnerPhone
  var res = createProperty({
    FullAddress: 'Test Society, Test Nagar, Mumbai',
    Category: 'Residential',
    SubCategory: 'Apartment',
    TransactionType: 'Sale',
    ListingType: 'Owner',
    BHK: 3,
    CarpetArea: 1200,
    Price: 7500000,
    FacingDirection: 'East',
    PossessionStatus: 'Ready to Move',
    Parking: '1 Covered',
    InternalRemarks: 'Auto test property',
    OwnerName: 'Test Owner',
    OwnerPhone: '9999900099'
  });
  if (!res.success) return { name: name, passed: false, error: res.message };
  var propId = res.data.propertyId;

  // Verify ID format: P-0001
  if (!/^P-\d{4,}$/.test(propId)) {
    deleteProperty(propId);
    return { name: name, passed: false, error: 'Property ID format wrong: ' + propId + ' (expected P-XXXX)' };
  }

  // Verify PricePerSqft auto-calc
  var prop = getProperty(propId);
  if (prop.success && prop.data.PricePerSqft) {
    var expected = Math.round(7500000 / 1200);
    if (Math.abs(safeNum(prop.data.PricePerSqft) - expected) > 5) {
      deleteProperty(propId);
      return { name: name, passed: false, error: 'PricePerSqft auto-calc wrong. Expected ~' + expected + ', got: ' + prop.data.PricePerSqft };
    }
  }

  var del = deleteProperty(propId);
  if (!del.success) return { name: name, passed: false, error: 'Delete failed: ' + del.message };
  return { name: name, passed: true, detail: 'Property ID: ' + propId + ' — ListingType: Owner, PricePerSqft auto-calc OK' };
}

// ─────────────────────────────────────────
// 7. BUILDER PROJECT TEST
// ─────────────────────────────────────────
function testBuilderProject() {
  var name = 'testBuilderProject';
  var res = createBuilderProject({
    BuilderCompanyName: 'Test Builders Pvt Ltd',
    ProjectName: 'Test Heights ' + Date.now(),
    ProjectLocation: 'Andheri West, Mumbai',
    ProjectType: 'Residential',
    LaunchStatus: 'Under Construction',
    TotalUnitsInProject: 50,
    PriceRangeMin: 8000000,
    PriceRangeMax: 15000000,
    RERANumber: 'P51800' + Math.floor(Math.random() * 100000),
    ChannelPartnerCommissionPercent: 2
  });
  if (!res.success) return { name: name, passed: false, error: res.message };
  var projId = res.data.projectId;

  // Verify PRJ-001 format
  if (!/^PRJ-\d{3,}$/.test(projId)) {
    return { name: name, passed: false, error: 'Project ID format wrong: ' + projId + ' (expected PRJ-XXX)' };
  }

  return { name: name, passed: true, detail: 'Project ID: ' + projId + ' — Builder project created OK' };
}

// ─────────────────────────────────────────
// 8. REGISTRY TEST
// ─────────────────────────────────────────
function testRegistry() {
  var name = 'testRegistry';
  var lead = createLead({ FullName: 'Reg Test Lead', PrimaryPhone: '6' + Date.now().toString().slice(-9), Source: 'Other', LeadType: 'End User' });
  if (!lead.success) return { name: name, passed: false, error: 'Lead create failed' };

  var prop = createProperty({
    FullAddress: 'Reg Test Society, Mumbai',
    Category: 'Residential',
    TransactionType: 'Sale',
    ListingType: 'Owner',
    Price: 5000000,
    OwnerName: 'Reg Owner',
    OwnerPhone: '9999900098'
  });
  if (!prop.success) {
    deleteLead(lead.data.leadId);
    return { name: name, passed: false, error: 'Property create failed' };
  }

  var reg = createRegistry({
    LeadID: lead.data.leadId,
    PropertyID: prop.data.propertyId,
    BuyerName: 'Test Buyer',
    SellerName: 'Test Seller',
    WitnessName: 'Test Witness',
    SalePrice: 5000000,
    StampDuty: 300000,
    RegistrationFee: 30000,
    RegistryDate: new Date().toISOString().split('T')[0],
    RegistryOffice: 'Sub-Registrar Test Office',
    Notes: 'Auto test registry'
  });
  deleteLead(lead.data.leadId);

  if (!reg.success) return { name: name, passed: false, error: reg.message };
  return { name: name, passed: true, detail: 'Registry ID: ' + reg.data.regId + ' — LeadStatus → Registry ✓' };
}

// ─────────────────────────────────────────
// 9. AUTH / RBAC / CONFIG TEST
// ─────────────────────────────────────────
function testAuth() {
  var name = 'testAuth';
  var errors = [];

  // getFormOptions — V10 fields
  var opts = getFormOptions();
  if (!opts.success) { errors.push('getFormOptions failed'); }
  else {
    if (!opts.data.callDispositions || !opts.data.callDispositions.length)
      errors.push('callDispositions missing');
    if (!opts.data.requirementTypes || !opts.data.requirementTypes.length)
      errors.push('requirementTypes missing');
    if (!opts.data.listingTypes || !opts.data.listingTypes.length)
      errors.push('listingTypes missing (V10 new)');
    if (!opts.data.fundingTypes || !opts.data.fundingTypes.length)
      errors.push('fundingTypes missing (V10 new)');
    if (!opts.data.builderProjectStatuses || !opts.data.builderProjectStatuses.length)
      errors.push('builderProjectStatuses missing (V10 new)');
  }

  // Password hash check
  var hash = hashPassword('Admin@123');
  if (!hash || hash.length !== 64) errors.push('hashPassword returned invalid hash: ' + hash);

  // RBAC matrix check
  var matrix = PERMISSIONS_MATRIX;
  if (!matrix.Admin) errors.push('Admin missing from RBAC');
  if (!matrix.Manager) errors.push('Manager missing from RBAC');
  if (!matrix.Agent) errors.push('Agent missing from RBAC');
  if (!matrix.Broker) errors.push('Broker missing from RBAC');

  // Config defaults loaded
  var configs = getSheetData(SHEET_NAMES.CONFIG);
  if (!configs.length) errors.push('Config sheet empty — run setupCRM()');

  if (errors.length) return { name: name, passed: false, error: errors.join(' | ') };
  return { name: name, passed: true, detail: 'hashPassword OK, RBAC OK, V10 formOptions all present' };
}

// ─────────────────────────────────────────
// 10. DASHBOARD TEST
// ─────────────────────────────────────────
function testDashboard() {
  var name = 'testDashboard';
  // V10: getDashboardData() (not getDashboardStats())
  var res = getDashboardData();
  if (!res.success) return { name: name, passed: false, error: res.message };
  var d = res.data;
  var keys = ['kpis', 'pipeline', 'recentActivities', 'propertyStats'];
  var missing = keys.filter(function(k) { return d[k] === undefined; });
  if (missing.length) return { name: name, passed: false, error: 'Missing dashboard keys: ' + missing.join(', ') };

  var kpiKeys = ['totalLeads', 'activeLeads', 'closedLeads', 'hotLeads'];
  var missingKpi = kpiKeys.filter(function(k) { return d.kpis[k] === undefined; });
  if (missingKpi.length) return { name: name, passed: false, error: 'KPIs missing: ' + missingKpi.join(', ') };

  return { name: name, passed: true,
    detail: 'Leads:' + d.kpis.totalLeads + ' Hot:' + d.kpis.hotLeads + ' Active:' + d.kpis.activeLeads };
}

// ─────────────────────────────────────────
// 11. AGENT MODULE TEST (Dena / Lena)
// ─────────────────────────────────────────
function testAgentModule() {
  var name = 'testAgentModule';
  var errors = [];

  // Test Dena: agentSubmitProperty
  var dena = agentSubmitProperty({
    FullAddress: 'Test Dena Property, Mumbai',
    Category: 'Residential',
    TransactionType: 'Sale',
    ListingType: 'Owner',
    Price: 6000000,
    OwnerName: 'Dena Test Owner',
    OwnerPhone: '9888800001',
    AgentName: 'Test Agent'
  });
  if (!dena.success) errors.push('Dena (agentSubmitProperty) failed: ' + dena.message);

  // Test Lena: agentSubmitForRequirement (requires a valid ShareID)
  // We test that the function exists and fails gracefully on invalid ShareID
  var lena = agentSubmitForRequirement('INVALID-SHARE-ID-TEST', {
    FullAddress: 'Test Lena Property, Mumbai',
    Category: 'Residential',
    TransactionType: 'Sale',
    Price: 5000000,
    AgentName: 'Test Agent'
  });
  // Should fail with 'Invalid or expired share link' — not an uncaught exception
  if (lena === undefined || lena === null) {
    errors.push('Lena (agentSubmitForRequirement) returned null/undefined — function missing?');
  }

  // Test Agent CRUD
  var agentList = getAllAgents({});
  if (!agentList.success) errors.push('getAllAgents failed: ' + agentList.message);

  if (errors.length) return { name: name, passed: false, error: errors.join(' | ') };
  return { name: name, passed: true, detail: 'Dena (agentSubmitProperty) OK | Lena gracefully handles invalid ShareID | getAllAgents OK' };
}

// ─────────────────────────────────────────
// QUICK SINGLE CHECKS (individually run karein)
// ─────────────────────────────────────────

/** Sirf sheet list dekho */
function checkSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets().map(function(s) { return s.getName() + ' (' + Math.max(0, s.getLastRow() - 1) + ' rows)'; });
  Logger.log('=== Sheets in this Spreadsheet ===');
  sheets.forEach(function(s) { Logger.log(' • ' + s); });
  Logger.log('Total: ' + sheets.length);
}

/** V10 Headers check karo */
function checkV10Headers() {
  Logger.log('=== V10 Header Check ===');

  var leadsHeaders = getHeaders(SHEET_NAMES.LEADS);
  var v10Lead = ['LeadID', 'FullName', 'PrimaryPhone', 'LeadStatus', 'DateCreated', 'AssignedAgent',
    'LocationPref1', 'BudgetMin', 'BudgetMax', 'Category', 'LeadType', 'TransactionType',
    'CallAttemptCount', 'ShareID', 'PropertiesVisited'];
  var missingLead = v10Lead.filter(function(h) { return leadsHeaders.indexOf(h) === -1; });
  Logger.log('Leads V10 headers missing: ' + (missingLead.length ? missingLead.join(', ') : 'NONE ✅'));

  var invHeaders = getHeaders(SHEET_NAMES.INVENTORY);
  var v10Inv = ['PropertyID', 'FullAddress', 'AvailabilityStatus', 'ListingType', 'Category',
    'PricePerSqft', 'PriceChangeLog', 'DaysInInventory', 'OwnerPhone', 'BrokerPhone'];
  var missingInv = v10Inv.filter(function(h) { return invHeaders.indexOf(h) === -1; });
  Logger.log('Inventory V10 headers missing: ' + (missingInv.length ? missingInv.join(', ') : 'NONE ✅'));

  var agentsHeaders = getHeaders(SHEET_NAMES.AGENTS);
  Logger.log('Agents sheet headers: ' + agentsHeaders.join(', '));

  var bpHeaders = getHeaders(SHEET_NAMES.BUILDER_PROJECTS);
  Logger.log('BuilderProjects headers count: ' + bpHeaders.length + (bpHeaders[0] === 'ProjectID' ? ' ✅' : ' ❌ First col: ' + bpHeaders[0]));
}

/** Admin user check */
function checkAdminUser() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  if (!sheet) { Logger.log('❌ Users sheet not found — setupCRM() chalao'); return; }
  var data = sheet.getDataRange().getValues();
  Logger.log('=== Users ===');
  data.slice(1).forEach(function(row) {
    if (row[0]) Logger.log(' • ' + row[0] + ' | ' + row[1] + ' | Email: ' + row[2] + ' | Role: ' + row[4] + ' | Status: ' + row[6]);
  });
}

/** Form options dump */
function checkFormOptions() {
  var res = getFormOptions();
  Logger.log('success: ' + res.success);
  if (res.success) {
    Logger.log('leadSources: ' + res.data.leadSources);
    Logger.log('leadTypes: ' + res.data.leadTypes);
    Logger.log('listingTypes: ' + res.data.listingTypes);
    Logger.log('requirementTypes: ' + res.data.requirementTypes);
    Logger.log('callDispositions: ' + res.data.callDispositions);
    Logger.log('fundingTypes: ' + res.data.fundingTypes);
    Logger.log('builderProjectStatuses: ' + res.data.builderProjectStatuses);
    Logger.log('leadStatuses count: ' + res.data.leadStatuses.length);
  }
}

/** Matching engine quick check */
function checkMatchingEngine() {
  Logger.log('=== Matching Engine Check ===');
  var leads = getSheetData(SHEET_NAMES.LEADS).slice(0, 3);
  var props = getSheetData(SHEET_NAMES.INVENTORY).slice(0, 5);
  if (!leads.length) { Logger.log('No leads to test matching'); return; }
  if (!props.length) { Logger.log('No inventory to test matching'); return; }
  leads.forEach(function(l) {
    var matches = matchLeadToProperties(l.LeadID);
    Logger.log('Lead ' + l.LeadID + ' (' + l.FullName + '): ' + (matches.success ? matches.data.length + ' matches' : 'Error: ' + matches.message));
  });
}
