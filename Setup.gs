// ============================================================
// Setup.gs — CRM Initialization & Setup
// Signature Realty CRM V10
// ============================================================

function setupCRM() {
  try {
    Logger.log('Starting Signature Realty CRM V10 setup...');
    initializeSheets();
    loadDefaultData();
    setupPermissionsSheet();
    setupTriggers();
    var errors = validateSetup();
    if (errors.length) {
      Logger.log('Setup warnings: ' + errors.join(', '));
    }
    Logger.log('✅ CRM V10 setup complete!');
    return 'Setup complete! Default admin login — Email: admin@signaturerealty.com | Password: Admin@123';
  } catch(e) {
    Logger.log('setupCRM error: ' + e);
    return 'Setup failed: ' + e.message;
  }
}

function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheets = [

    // ── MODULE 1: LEADS ─────────────────────────────────────────
    // Full field set as per V10 Master Plan (Groups A–U)
    {
      name: SHEET_NAMES.LEADS,
      headers: [
        // GROUP A: Lead Identity
        'LeadID', 'DateCreated', 'TimeCreated',
        'Source', 'SourceDetail',
        // GROUP B: Client Personal Detail
        'FullName', 'PrimaryPhone', 'WhatsAppNumber', 'AlternatePhone',
        'Email', 'CityOfResidence', 'Occupation', 'CompanyName',
        'NRIStatus', 'PreferredLanguage',
        // GROUP C: Lead Classification
        'LeadType', 'ReferredByBrokerName', 'ReferringBrokerPhone', 'CommissionSharePercent',
        // GROUP D: Duplicate & Assignment
        'DuplicateFlag', 'DuplicateRefLeadID',
        'AssignedAgent', 'AssignmentDate',
        // GROUP E: Verification
        'VerifiedStatus', 'NotVerifiedReason',
        'CallAttemptCount', 'FirstCallDate', 'CallOutcome', 'BestTimeToCall',
        // GROUP F: Transaction Basics
        'TransactionType', 'Category', 'SubCategory',
        // GROUP G: Budget & Finance
        'BudgetMin', 'BudgetMax', 'BudgetFlexible',
        'FundingType', 'LoanPreApprovedAmount', 'BankName',
        'MonthlyRentBudget', 'SecurityDepositCapacity',
        // GROUP H: Location
        'LocationPref1', 'LocationPref2', 'LocationPref3',
        'LocationStrictness', 'ProximityRequirement',
        // GROUP I: Residential Common (Sale + Rent)
        'BHKMin', 'BHKMax',
        'OldNewPreference', 'FloorPreference', 'FacingPreference',
        'ParkingRequired', 'Furnishing', 'AmenitiesRequired',
        'PossessionStatusRequired',
        // GROUP J: Residential Rent (Tenant Profile)
        'TenantType', 'FamilySize', 'NumberOfOccupants',
        'FoodPreference', 'PetsAllowed', 'PetType',
        'CompanyLease', 'CompanyLeaseName',
        'LockInAcceptable', 'LeaseDurationPreferred',
        // GROUP K: Commercial Specific
        'BusinessType', 'NatureOfBusiness',
        'CarpetAreaRequired', 'FrontageWidth',
        'CommFloorPref', 'WashroomType', 'PowerLoadRequired',
        'FireNOCRequired', 'CustomerParking', 'StaffParking',
        'CommLockIn', 'CommLeaseTenure',
        // GROUP L: Land/Plot Specific
        'PlotUse', 'PlotAreaRequired', 'CornerPlotRequired',
        'RoadWidthFacing', 'LayoutApprovalPref',
        // GROUP M: Industrial Specific
        'IndustryType', 'IndustrialAreaRequired',
        'IndustrialPowerLoad', 'CeilingHeight', 'LoadingDockRequired',
        // GROUP N: Purpose & Urgency
        'Purpose', 'UrgencyLevel', 'DecisionMaker', 'PossessionTimeline',
        // GROUP O: Legal Readiness
        'KYCDocumentsReady', 'CoApplicantForLoan', 'CompanyDocumentsReady',
        // GROUP P: Special Requirements
        'VastuRequired', 'AccessibilityNeeds', 'SpecialNotes',
        // GROUP Q: Shortlist
        'MatchedPropertyIDs', 'ManuallyAddedProperties', 'ManuallyRemovedProperties',
        'ShortlistCount', 'SharedDate', 'SharedVia', 'ClientReaction',
        // GROUP R: Requirement Sharing
        'ShareLinkGenerated', 'ShareID', 'SharedWithLog', 'PropertiesReceivedViaShare',
        // GROUP S: Site Visit & Negotiation
        'PropertiesVisited', 'VisitDates', 'VisitFeedback',
        'NegotiatedPropertyID', 'NegotiatedPrice',
        'NegotiationStatus', 'TokenAmountDiscussed', 'TokenAmountPaid',
        // GROUP T: Status & Closure
        'LeadStatus', 'LastActionDate', 'NextFollowUpDate',
        'LostReason', 'ClosedDate', 'FinalDealValue',
        // GROUP U: Communication Log
        'TotalCallsMade', 'LastCallDate', 'CallLogRemarks', 'WhatsAppLogSummary',
        // System
        'Score', 'ScoreCategory', 'CreatedBy', 'LastModifiedBy', 'LastModifiedDate'
      ]
    },

    // ── MODULE 2: INVENTORY ──────────────────────────────────────
    // Full field set as per V10 Master Plan (Groups A–R)
    {
      name: SHEET_NAMES.INVENTORY,
      headers: [
        // GROUP A: Property Identity
        'PropertyID', 'DateAdded', 'AddedByAgent',
        'ListingType', 'LinkedProjectID', 'LinkedRequirementID',
        'VerificationStatus', 'PossibleDuplicateFlag', 'DuplicateRefPropertyID',
        // GROUP B: Basic Property Info
        'ProjectBuildingName', 'TransactionType', 'Category', 'SubCategory',
        'FullAddress', 'Landmark',
        'GeoCoordinates', 'DistanceFromLandmarks', 'MarketType',
        // GROUP C: Unit-Specific Detail
        'UnitNumber', 'TowerBlock', 'FloorNumber', 'TotalFloors',
        'BHK', 'CarpetArea', 'BuiltUpArea', 'SuperBuiltUpArea',
        'PricePerSqft',
        'FacingDirection', 'ViewOrientation',
        'OldOrNew', 'AgeOfProperty',
        'ConditionScore', 'QualityTag',
        // GROUP D: Price & Financial
        'Price', 'OriginalListedPrice',
        'PriceChangeLog', 'PriceDropAlertFlag',
        'PriceNegotiable', 'MaintenanceCharges',
        'SecurityDeposit', 'BookingTokenAmount',
        'BrokerageTerms', 'ExpectedCommission', 'CommissionSplit',
        'GSTApplicable', 'AllInclusiveOrExtra',
        // GROUP E: Residential Specific
        'FurnishingStatus', 'Parking', 'Amenities',
        'PossessionStatus', 'PossessionDate',
        'SocietyRWAName', 'WaterAvailability', 'PowerBackup',
        'SocietyAge', 'TotalUnitsInSociety',
        // GROUP F: Residential Rent (Owner Conditions)
        'TenantPreference', 'FoodPrefAllowed', 'PetsAllowedOwner',
        'CompanyLeaseAccepted', 'LockInPeriod', 'LeaseDurationOwner',
        // GROUP G: Commercial Specific
        'BusinessTypeSuitableFor', 'CommCarpetArea', 'CommFrontage',
        'CommFloor', 'CommWashroom', 'CommPowerLoad', 'CommFireNOC',
        'CommCustomerParking', 'CommStaffParking',
        'CommLockIn', 'CommLeaseTenure', 'SignageSpace',
        // GROUP H: Land/Plot Specific
        'PlotArea', 'CornerPlot', 'PlotRoadWidth',
        'LayoutApproval', 'DTCPRERAApproved',
        // GROUP I: Industrial Specific
        'IndBuiltUpArea', 'IndPowerLoad', 'IndCeilingHeight',
        'IndLoadingDock', 'PollutionClearance',
        // GROUP J: Media
        'Photos', 'VideoLink', 'Brochure', 'FloorPlan', 'VirtualTourLink',
        // GROUP K: Owner Contact (when ListingType = Owner)
        'OwnerName', 'OwnerPhone', 'OwnerEmail',
        'OwnerIDVerified', 'ExclusiveMandate', 'MandateValidityDate',
        'CoOwnership', 'CoOwnershipDetails',
        // GROUP L: Broker Contact (when ListingType = Agent-Broker)
        'BrokerName', 'BrokerPhone', 'BrokerAgencyName',
        'CoBrokingCommissionSplit', 'BrokerVerified', 'OriginalOwnerContactAvailable',
        // GROUP M: Builder Reference (when ListingType = Builder-Developer)
        'SalesOfficeContact', 'SalesOfficePhone', 'DirectBookingAllowed',
        // GROUP N: Status & Availability
        'AvailabilityStatus', 'HoldReason', 'HoldLeadID',
        'ListingValidityExpiry', 'LastStatusUpdateDate', 'DaysInInventory',
        // GROUP O: Matching Metadata
        'MatchedLeadCount', 'TimesSharedWithClients',
        'InterestedLeadsList', 'SimilarProperties',
        // GROUP P: Legal/Documentation
        'TitleClear', 'DocumentsChecklist', 'LitigationStatus',
        // GROUP Q: Portal & Co-listing
        'PostedOnPortals', 'ExternalPortalLinks', 'CoListingAgents',
        // GROUP R: Internal Notes
        'InternalRemarks', 'SpecialSellingPoints',
        // System
        'CreatedDate', 'LastModifiedDate'
      ]
    },

    // ── Builder Projects Sheet ───────────────────────────────────
    {
      name: SHEET_NAMES.BUILDER_PROJECTS,
      headers: [
        'ProjectID', 'BuilderCompanyName', 'ProjectName',
        'RERANumber', 'ProjectLocation', 'GeoCoordinates',
        'ProjectType', 'LaunchStatus',
        'PossessionDateExpected',
        'TotalTowersBlocks', 'TotalUnitsInProject',
        'ConfigurationsAvailable', 'PriceRangeMin', 'PriceRangeMax',
        'ProjectAmenities',
        'SalesOfficeContact', 'SalesOfficePhone',
        'DirectBookingAllowed', 'ChannelPartnerCommissionPercent',
        'MasterBrochure', 'MasterLayoutPlan', 'ProjectPhotos',
        'ProjectStatus',
        'BuilderPastProjectsCount', 'BuilderReputationNotes',
        'OnTimeDeliveryRecord',
        'CreatedDate', 'LastModifiedDate'
      ]
    },

    // ── MODULE 3: AGENTS ─────────────────────────────────────────
    {
      name: SHEET_NAMES.AGENTS,
      headers: [
        'AgentID', 'Name', 'Phone', 'Email',
        'ActiveStatus', 'Territory', 'Specialization',
        'CreatedDate'
      ]
    },

    // ── USERS (Auth/Admin) ───────────────────────────────────────
    {
      name: SHEET_NAMES.USERS,
      headers: [
        'UserID', 'Name', 'Email', 'Mobile', 'Role',
        'Department', 'Status', 'CreatedDate', 'LastLoginDate',
        'Specialization', 'CommissionPercent', 'PasswordHash'
      ]
    },

    // ── REQUIREMENTS ─────────────────────────────────────────────
    {
      name: SHEET_NAMES.REQUIREMENTS,
      headers: [
        'RequirementID', 'LeadID', 'RequirementType',
        'Category', 'SubCategory',
        'BHKMin', 'BHKMax',
        'BudgetMin', 'BudgetMax', 'BudgetFlexible',
        'MinArea', 'MaxArea',
        'Location1', 'Location2', 'Location3', 'LocationStrictness',
        'FacingPreference', 'ParkingRequired',
        'Furnishing', 'AmenitiesRequired',
        'Possession', 'FundingType', 'LoanAmount',
        'Urgency', 'Purpose',
        'SpecialNotes', 'CreatedDate'
      ]
    },

    // ── ACTIVITIES ───────────────────────────────────────────────
    {
      name: SHEET_NAMES.ACTIVITIES,
      headers: ['ActivityID', 'LeadID', 'Date', 'UserID', 'Action', 'Notes']
    },

    // ── SITE VISITS ──────────────────────────────────────────────
    {
      name: SHEET_NAMES.SITE_VISITS,
      headers: [
        'VisitID', 'LeadID', 'PropertyID',
        'ScheduledDate', 'ScheduledTime',
        'CheckInTime', 'CheckOutTime',
        'CheckInLocation', 'CheckOutLocation',
        'Agent', 'PropertyCondition', 'LeadInterest',
        'VisitFeedback', 'NextStep',
        'Status', 'CreatedDate'
      ]
    },

    // ── NEGOTIATIONS ─────────────────────────────────────────────
    {
      name: SHEET_NAMES.NEGOTIATIONS,
      headers: [
        'NegotiationID', 'LeadID', 'PropertyID',
        'InitialOffer', 'CounterOffer', 'FinalAmount',
        'Rounds', 'Status', 'DealProbability',
        'Notes', 'CreatedDate'
      ]
    },

    // ── TOKENS ───────────────────────────────────────────────────
    {
      name: SHEET_NAMES.TOKENS,
      headers: [
        'TokenID', 'LeadID', 'PropertyID',
        'Amount', 'ReceiptDate', 'ReceiptNumber',
        'ReceivedBy', 'PaymentMethod', 'Documents', 'Status'
      ]
    },

    // ── AGREEMENTS ───────────────────────────────────────────────
    {
      name: SHEET_NAMES.AGREEMENTS,
      headers: [
        'AgreementID', 'LeadID', 'PropertyID', 'TokenID',
        'BuyerName', 'SellerName', 'WitnessName',
        'SalePrice', 'AgreementDate',
        'Documents', 'Status', 'CreatedDate'
      ]
    },

    // ── COMMISSIONS ──────────────────────────────────────────────
    {
      name: SHEET_NAMES.COMMISSIONS,
      headers: [
        'CommissionID', 'LeadID', 'PropertyID',
        'SalePrice', 'CommissionRate', 'GrossCommission',
        'TDS', 'GST', 'NetCommission',
        'Agent1', 'Agent1Percent', 'Agent1Amount',
        'Agent2', 'Agent2Percent', 'Agent2Amount',
        'PaymentStatus', 'PaymentDate', 'CreatedDate'
      ]
    },

    // ── REGISTRY ─────────────────────────────────────────────────
    {
      name: SHEET_NAMES.REGISTRY,
      headers: [
        'RegistryID', 'LeadID', 'PropertyID', 'TokenID',
        'BuyerName', 'SellerName', 'WitnessName',
        'SalePrice', 'StampDuty', 'RegistrationFee',
        'RegistryDate', 'RegistryOffice', 'DocumentNumber',
        'Status', 'Notes', 'Documents', 'CreatedBy', 'CreatedDate'
      ]
    },

    // ── REQUIREMENT SHARING ──────────────────────────────────────
    {
      name: SHEET_NAMES.REQ_SHARING,
      headers: [
        'ShareID', 'LeadID', 'GeneratedBy', 'GeneratedDate',
        'SharedWithAgent', 'SharedDate', 'ExpiryDate',
        'PropertiesSubmitted', 'Status'
      ]
    },

    // ── CONFIG ───────────────────────────────────────────────────
    {
      name: SHEET_NAMES.CONFIG,
      headers: ['Key', 'Value', 'Type', 'Description']
    },

    // ── PERMISSIONS ──────────────────────────────────────────────
    {
      name: SHEET_NAMES.PERMISSIONS,
      headers: ['Role', 'Resource', 'Action', 'Allowed']
    },

    // ── AUDIT LOG ────────────────────────────────────────────────
    {
      name: SHEET_NAMES.AUDIT_LOG,
      headers: [
        'LogID', 'Date', 'Time', 'UserID', 'Action',
        'Resource', 'ResourceID', 'OldValue', 'NewValue', 'Status', 'Details'
      ]
    },

    // ── REPORTS ──────────────────────────────────────────────────
    {
      name: SHEET_NAMES.REPORTS,
      headers: ['ReportID', 'Date', 'Type', 'GeneratedBy', 'Parameters', 'Status']
    },

    // ── NOTIFICATIONS ────────────────────────────────────────────
    {
      name: SHEET_NAMES.NOTIFICATIONS,
      headers: ['NotifID', 'Date', 'Type', 'Recipient', 'Message', 'Status']
    }
  ];

  sheets.forEach(function(sheetDef) {
    var sheet = ss.getSheetByName(sheetDef.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetDef.name);
      Logger.log('Created sheet: ' + sheetDef.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheetDef.headers);
      var headerRange = sheet.getRange(1, 1, 1, sheetDef.headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1565C0');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
      for (var i = 1; i <= sheetDef.headers.length; i++) {
        sheet.setColumnWidth(i, 140);
      }
    }
  });

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  Logger.log('All sheets initialized: ' + sheets.length);
}

// ============================================================
// updateAllSheetHeaders() — Force-update headers on ALL sheets
// Existing data is preserved; only Row 1 (headers) is updated.
// Run this from Apps Script editor if sheets already existed
// with old column names.
// ============================================================
function updateAllSheetHeaders() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var allSheetDefs = getSheetHeaderDefinitions();

    var updated = [];
    var created = [];

    allSheetDefs.forEach(function(def) {
      var sheet = ss.getSheetByName(def.name);
      if (!sheet) {
        sheet = ss.insertSheet(def.name);
        created.push(def.name);
        Logger.log('Created new sheet: ' + def.name);
      }

      // Force-overwrite Row 1 with V10 headers
      var range = sheet.getRange(1, 1, 1, def.headers.length);
      range.setValues([def.headers]);
      range.setFontWeight('bold');
      range.setBackground('#1565C0');
      range.setFontColor('#FFFFFF');
      range.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);

      // Expand columns if needed
      var currentCols = sheet.getLastColumn();
      if (def.headers.length > currentCols) {
        sheet.insertColumnsAfter(currentCols, def.headers.length - currentCols);
      }
      // Set column widths
      for (var i = 1; i <= def.headers.length; i++) {
        sheet.setColumnWidth(i, 140);
      }
      updated.push(def.name + ' (' + def.headers.length + ' cols)');
    });

    var msg = '✅ Headers updated on ' + updated.length + ' sheets.\n' +
              (created.length ? '🆕 Created: ' + created.join(', ') + '\n' : '') +
              'Updated: ' + updated.join(', ');
    Logger.log(msg);
    return msg;

  } catch(e) {
    Logger.log('updateAllSheetHeaders error: ' + e);
    return 'Error: ' + e.message;
  }
}

// Returns all sheet definitions (name + V10 headers) for use by
// initializeSheets() and updateAllSheetHeaders()
function getSheetHeaderDefinitions() {
  return [
    {
      name: SHEET_NAMES.LEADS,
      headers: [
        'LeadID','DateCreated','TimeCreated',
        'Source','SourceDetail',
        'FullName','PrimaryPhone','WhatsAppNumber','AlternatePhone',
        'Email','CityOfResidence','Occupation','CompanyName',
        'NRIStatus','PreferredLanguage',
        'LeadType','ReferredByBrokerName','ReferringBrokerPhone','CommissionSharePercent',
        'DuplicateFlag','DuplicateRefLeadID',
        'AssignedAgent','AssignmentDate',
        'VerifiedStatus','NotVerifiedReason',
        'CallAttemptCount','FirstCallDate','CallOutcome','BestTimeToCall',
        'TransactionType','Category','SubCategory',
        'BudgetMin','BudgetMax','BudgetFlexible',
        'FundingType','LoanPreApprovedAmount','BankName',
        'MonthlyRentBudget','SecurityDepositCapacity',
        'LocationPref1','LocationPref2','LocationPref3',
        'LocationStrictness','ProximityRequirement',
        'BHKMin','BHKMax',
        'OldNewPreference','FloorPreference','FacingPreference',
        'ParkingRequired','Furnishing','AmenitiesRequired',
        'PossessionStatusRequired',
        'TenantType','FamilySize','NumberOfOccupants',
        'FoodPreference','PetsAllowed','PetType',
        'CompanyLease','CompanyLeaseName',
        'LockInAcceptable','LeaseDurationPreferred',
        'BusinessType','NatureOfBusiness',
        'CarpetAreaRequired','FrontageWidth',
        'CommFloorPref','WashroomType','PowerLoadRequired',
        'FireNOCRequired','CustomerParking','StaffParking',
        'CommLockIn','CommLeaseTenure',
        'PlotUse','PlotAreaRequired','CornerPlotRequired',
        'RoadWidthFacing','LayoutApprovalPref',
        'IndustryType','IndustrialAreaRequired',
        'IndustrialPowerLoad','CeilingHeight','LoadingDockRequired',
        'Purpose','UrgencyLevel','DecisionMaker','PossessionTimeline',
        'KYCDocumentsReady','CoApplicantForLoan','CompanyDocumentsReady',
        'VastuRequired','AccessibilityNeeds','SpecialNotes',
        'MatchedPropertyIDs','ManuallyAddedProperties','ManuallyRemovedProperties',
        'ShortlistCount','SharedDate','SharedVia','ClientReaction',
        'ShareLinkGenerated','ShareID','SharedWithLog','PropertiesReceivedViaShare',
        'PropertiesVisited','VisitDates','VisitFeedback',
        'NegotiatedPropertyID','NegotiatedPrice',
        'NegotiationStatus','TokenAmountDiscussed','TokenAmountPaid',
        'LeadStatus','LastActionDate','NextFollowUpDate',
        'LostReason','ClosedDate','FinalDealValue',
        'TotalCallsMade','LastCallDate','CallLogRemarks','WhatsAppLogSummary',
        'Score','ScoreCategory','CreatedBy','LastModifiedBy','LastModifiedDate'
      ]
    },
    {
      name: SHEET_NAMES.INVENTORY,
      headers: [
        'PropertyID','DateAdded','AddedByAgent',
        'ListingType','LinkedProjectID','LinkedRequirementID',
        'VerificationStatus','PossibleDuplicateFlag','DuplicateRefPropertyID',
        'ProjectBuildingName','TransactionType','Category','SubCategory',
        'FullAddress','Landmark',
        'GeoCoordinates','DistanceFromLandmarks','MarketType',
        'UnitNumber','TowerBlock','FloorNumber','TotalFloors',
        'BHK','CarpetArea','BuiltUpArea','SuperBuiltUpArea',
        'PricePerSqft',
        'FacingDirection','ViewOrientation',
        'OldOrNew','AgeOfProperty',
        'ConditionScore','QualityTag',
        'Price','OriginalListedPrice',
        'PriceChangeLog','PriceDropAlertFlag',
        'PriceNegotiable','MaintenanceCharges',
        'SecurityDeposit','BookingTokenAmount',
        'BrokerageTerms','ExpectedCommission','CommissionSplit',
        'GSTApplicable','AllInclusiveOrExtra',
        'FurnishingStatus','Parking','Amenities',
        'PossessionStatus','PossessionDate',
        'SocietyRWAName','WaterAvailability','PowerBackup',
        'SocietyAge','TotalUnitsInSociety',
        'TenantPreference','FoodPrefAllowed','PetsAllowedOwner',
        'CompanyLeaseAccepted','LockInPeriod','LeaseDurationOwner',
        'BusinessTypeSuitableFor','CommCarpetArea','CommFrontage',
        'CommFloor','CommWashroom','CommPowerLoad','CommFireNOC',
        'CommCustomerParking','CommStaffParking',
        'CommLockIn','CommLeaseTenure','SignageSpace',
        'PlotArea','CornerPlot','PlotRoadWidth',
        'LayoutApproval','DTCPRERAApproved',
        'IndBuiltUpArea','IndPowerLoad','IndCeilingHeight',
        'IndLoadingDock','PollutionClearance',
        'Photos','VideoLink','Brochure','FloorPlan','VirtualTourLink',
        'OwnerName','OwnerPhone','OwnerEmail',
        'OwnerIDVerified','ExclusiveMandate','MandateValidityDate',
        'CoOwnership','CoOwnershipDetails',
        'BrokerName','BrokerPhone','BrokerAgencyName',
        'CoBrokingCommissionSplit','BrokerVerified','OriginalOwnerContactAvailable',
        'SalesOfficeContact','SalesOfficePhone','DirectBookingAllowed',
        'AvailabilityStatus','HoldReason','HoldLeadID',
        'ListingValidityExpiry','LastStatusUpdateDate','DaysInInventory',
        'MatchedLeadCount','TimesSharedWithClients',
        'InterestedLeadsList','SimilarProperties',
        'TitleClear','DocumentsChecklist','LitigationStatus',
        'PostedOnPortals','ExternalPortalLinks','CoListingAgents',
        'InternalRemarks','SpecialSellingPoints',
        'CreatedDate','LastModifiedDate'
      ]
    },
    {
      name: SHEET_NAMES.BUILDER_PROJECTS,
      headers: [
        'ProjectID','BuilderCompanyName','ProjectName',
        'RERANumber','ProjectLocation','GeoCoordinates',
        'ProjectType','LaunchStatus',
        'PossessionDateExpected',
        'TotalTowersBlocks','TotalUnitsInProject',
        'ConfigurationsAvailable','PriceRangeMin','PriceRangeMax',
        'ProjectAmenities',
        'SalesOfficeContact','SalesOfficePhone',
        'DirectBookingAllowed','ChannelPartnerCommissionPercent',
        'MasterBrochure','MasterLayoutPlan','ProjectPhotos',
        'ProjectStatus',
        'BuilderPastProjectsCount','BuilderReputationNotes',
        'OnTimeDeliveryRecord',
        'CreatedDate','LastModifiedDate'
      ]
    },
    {
      name: SHEET_NAMES.AGENTS,
      headers: ['AgentID','Name','Phone','Email','ActiveStatus','Territory','Specialization','CreatedDate']
    },
    {
      name: SHEET_NAMES.USERS,
      headers: ['UserID','Name','Email','Mobile','Role','Department','Status','CreatedDate','LastLoginDate','Specialization','CommissionPercent','PasswordHash']
    },
    {
      name: SHEET_NAMES.REQUIREMENTS,
      headers: [
        'RequirementID','LeadID','RequirementType',
        'Category','SubCategory',
        'BHKMin','BHKMax',
        'BudgetMin','BudgetMax','BudgetFlexible',
        'MinArea','MaxArea',
        'Location1','Location2','Location3','LocationStrictness',
        'FacingPreference','ParkingRequired',
        'Furnishing','AmenitiesRequired',
        'Possession','FundingType','LoanAmount',
        'Urgency','Purpose',
        'SpecialNotes','CreatedDate'
      ]
    },
    {
      name: SHEET_NAMES.ACTIVITIES,
      headers: ['ActivityID','LeadID','Date','UserID','Action','Notes']
    },
    {
      name: SHEET_NAMES.SITE_VISITS,
      headers: [
        'VisitID','LeadID','PropertyID',
        'ScheduledDate','ScheduledTime',
        'CheckInTime','CheckOutTime',
        'CheckInLocation','CheckOutLocation',
        'Agent','PropertyCondition','LeadInterest',
        'VisitFeedback','NextStep','Feedback',
        'Status','CreatedDate'
      ]
    },
    {
      name: SHEET_NAMES.NEGOTIATIONS,
      headers: ['NegotiationID','LeadID','PropertyID','InitialOffer','CounterOffer','FinalAmount','Rounds','Status','DealProbability','Notes','CreatedDate']
    },
    {
      name: SHEET_NAMES.TOKENS,
      headers: ['TokenID','LeadID','PropertyID','Amount','ReceiptDate','ReceiptNumber','ReceivedBy','PaymentMethod','Documents','Status']
    },
    {
      name: SHEET_NAMES.AGREEMENTS,
      headers: ['AgreementID','LeadID','PropertyID','TokenID','BuyerName','SellerName','WitnessName','SalePrice','AgreementDate','Documents','Status','CreatedDate']
    },
    {
      name: SHEET_NAMES.COMMISSIONS,
      headers: ['CommissionID','LeadID','PropertyID','SalePrice','CommissionRate','GrossCommission','TDS','GST','NetCommission','Agent1','Agent1Percent','Agent1Amount','Agent2','Agent2Percent','Agent2Amount','PaymentStatus','PaymentDate','CreatedDate']
    },
    {
      name: SHEET_NAMES.REGISTRY,
      headers: ['RegistryID','LeadID','PropertyID','TokenID','BuyerName','SellerName','WitnessName','SalePrice','StampDuty','RegistrationFee','RegistryDate','RegistryOffice','DocumentNumber','Status','Notes','Documents','CreatedBy','CreatedDate']
    },
    {
      name: SHEET_NAMES.REQ_SHARING,
      headers: ['ShareID','LeadID','GeneratedBy','GeneratedDate','SharedWithAgent','SharedDate','ExpiryDate','PropertiesSubmitted','Status']
    },
    {
      name: SHEET_NAMES.CONFIG,
      headers: ['Key','Value','Type','Description']
    },
    {
      name: SHEET_NAMES.PERMISSIONS,
      headers: ['Role','Resource','Action','Allowed']
    },
    {
      name: SHEET_NAMES.AUDIT_LOG,
      headers: ['LogID','Date','Time','UserID','Action','Resource','ResourceID','OldValue','NewValue','Status','Details']
    },
    {
      name: SHEET_NAMES.REPORTS,
      headers: ['ReportID','Date','Type','GeneratedBy','Parameters','Status']
    },
    {
      name: SHEET_NAMES.NOTIFICATIONS,
      headers: ['NotifID','Date','Type','Recipient','Message','Status']
    }
  ];
}

function loadDefaultData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Config defaults
  var configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (configSheet && configSheet.getLastRow() <= 1) {
    DEFAULT_CONFIGS.forEach(function(row) { configSheet.appendRow(row); });
    Logger.log('Default config loaded');
  }

  // Default admin user
  var userSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (userSheet && userSheet.getLastRow() <= 1) {
    var adminId = 'USR-ADMIN001';
    var passwordHash = hashPassword('Admin@123');
    userSheet.appendRow([
      adminId, 'System Admin', 'admin@signaturerealty.com', '9999999999',
      'Admin', 'Management', 'Active', new Date(), '',
      'All', 0, passwordHash
    ]);
    Logger.log('Default admin created: admin@signaturerealty.com | Admin@123');
  }

  // Default agent in Agents sheet
  var agentSheet = ss.getSheetByName(SHEET_NAMES.AGENTS);
  if (agentSheet && agentSheet.getLastRow() <= 1) {
    agentSheet.appendRow([
      'AGT-001', 'Sample Agent', '9000000001', 'agent@signaturerealty.com',
      'Yes', 'All', 'All', new Date()
    ]);
    Logger.log('Sample agent record loaded');
  }

  // Sample inventory
  var invSheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
  if (invSheet && invSheet.getLastRow() <= 1) {
    var sampleRow = [
      'P-0001', new Date(), 'System Admin',
      'Owner', '', '',
      'Verified', 'No', '',
      'Sunshine Apartments', 'Sale', 'Residential', 'Apartment',
      '123 Hill Road, Bandra West, Mumbai', 'Near Bandra Station',
      '', '', 'Resale (Owner)',
      '501', 'A', '5', '12',
      '3', '980', '1200', '1350', '7653',
      'East', 'Road Facing',
      'New', '2', 'Good', 'Premium',
      7500000, 7800000,
      '', 'No', 'Yes', 5000,
      '', '', '2', '1.5%', 135000, '',
      'No', 'Inclusive',
      'Fully Furnished', 'Covered', 'Gym, Pool, Security, Lift',
      'Ready to Move', '', 'Sunshine Society', '24x7', 'Yes', '5', '120'
    ];
    invSheet.appendRow(sampleRow);
    Logger.log('Sample inventory loaded');
  }
}

function setupPermissionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.PERMISSIONS);
  if (!sheet || sheet.getLastRow() > 1) return;

  var permissions = [
    ['Admin','*','*','Yes'],
    ['Manager','Leads','create','Yes'],['Manager','Leads','read','Yes'],
    ['Manager','Leads','update','Yes'],['Manager','Leads','delete','Yes'],
    ['Manager','Leads','assign','Yes'],['Manager','Leads','export','Yes'],
    ['Manager','Inventory','create','Yes'],['Manager','Inventory','read','Yes'],
    ['Manager','Inventory','update','Yes'],['Manager','Inventory','delete','Yes'],
    ['Manager','Reports','read','Yes'],['Manager','Reports','export','Yes'],
    ['Manager','Users','read','Yes'],['Manager','Agents','read','Yes'],
    ['Agent','Leads','create','Yes'],['Agent','Leads','read_own','Yes'],
    ['Agent','Leads','update_own','Yes'],
    ['Agent','Inventory','read','Yes'],['Agent','Inventory','create','Yes'],
    ['Agent','SiteVisits','create','Yes'],['Agent','SiteVisits','read','Yes'],
    ['Agent','SiteVisits','update','Yes'],
    ['Agent','Negotiations','create','Yes'],['Agent','Negotiations','read','Yes'],
    ['Agent','Negotiations','update','Yes'],
    ['Agent','Tokens','read','Yes'],
    ['Builder','Inventory','create','Yes'],['Builder','Inventory','read','Yes'],
    ['Builder','Inventory','update','Yes'],['Builder','Leads','read','Yes']
  ];
  permissions.forEach(function(r) { sheet.appendRow(r); });
  Logger.log('Permissions loaded: ' + permissions.length + ' rules');
}

function validateSetup() {
  var errors = [];
  var requiredSheets = [
    SHEET_NAMES.LEADS, SHEET_NAMES.USERS, SHEET_NAMES.AGENTS,
    SHEET_NAMES.INVENTORY, SHEET_NAMES.BUILDER_PROJECTS,
    SHEET_NAMES.REQUIREMENTS, SHEET_NAMES.ACTIVITIES,
    SHEET_NAMES.SITE_VISITS, SHEET_NAMES.NEGOTIATIONS,
    SHEET_NAMES.TOKENS, SHEET_NAMES.AGREEMENTS,
    SHEET_NAMES.COMMISSIONS, SHEET_NAMES.CONFIG,
    SHEET_NAMES.PERMISSIONS, SHEET_NAMES.AUDIT_LOG,
    SHEET_NAMES.REQ_SHARING
  ];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  requiredSheets.forEach(function(name) {
    if (!ss.getSheetByName(name)) errors.push('Missing sheet: ' + name);
  });
  var users = getSheetData(SHEET_NAMES.USERS);
  if (!users.length) errors.push('No users found.');
  var configs = getSheetData(SHEET_NAMES.CONFIG);
  if (!configs.length) errors.push('Config sheet is empty.');
  return errors;
}

function resetCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheets = [
    SHEET_NAMES.LEADS, SHEET_NAMES.REQUIREMENTS, SHEET_NAMES.ACTIVITIES,
    SHEET_NAMES.SITE_VISITS, SHEET_NAMES.NEGOTIATIONS, SHEET_NAMES.TOKENS,
    SHEET_NAMES.AGREEMENTS, SHEET_NAMES.COMMISSIONS, SHEET_NAMES.REGISTRY,
    SHEET_NAMES.AUDIT_LOG, SHEET_NAMES.NOTIFICATIONS, SHEET_NAMES.REPORTS,
    SHEET_NAMES.REQ_SHARING
  ];
  dataSheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  });
  Logger.log('CRM data reset (structure preserved)');
  return 'CRM data cleared. Structure intact.';
}

function getSystemHealth() {
  try {
    var errors = validateSetup();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetsInfo = ss.getSheets().map(function(s) {
      return { name: s.getName(), rows: s.getLastRow() - 1 };
    });
    var triggers = ScriptApp.getProjectTriggers().map(function(t) {
      return t.getHandlerFunction();
    });
    return success({
      status: errors.length === 0 ? 'Healthy' : 'Warnings',
      errors: errors,
      sheets: sheetsInfo,
      activeTriggers: triggers,
      timestamp: new Date()
    });
  } catch(e) {
    return error(e.message);
  }
}

function getFormOptions() {
  return success({
    leadSources: LEAD_SOURCES,
    leadStatuses: LEAD_STATUSES,
    leadTypes: LEAD_TYPES,
    transactionTypes: TRANSACTION_TYPES,
    categories: PROPERTY_CATEGORIES,
    propertySubtypes: PROPERTY_SUBTYPES,
    listingTypes: LISTING_TYPES,
    marketTypes: MARKET_TYPES,
    propertyStatuses: PROPERTY_STATUSES,
    verificationStatuses: VERIFICATION_STATUSES,
    roles: ROLES,
    urgencyLevels: URGENCY_LEVELS,
    fundingTypes: FUNDING_TYPES,
    tenantTypes: TENANT_TYPES,
    furnishingOptions: FURNISHING_OPTIONS,
    facingOptions: FACING_OPTIONS,
    possessionOptions: POSSESSION_OPTIONS,
    paymentMethods: PAYMENT_METHODS,
    callDispositions: CALL_DISPOSITIONS,
    notVerifiedReasons: NOT_VERIFIED_REASONS,
    purposeOptions: PURPOSE_OPTIONS,
    decisionMakers: DECISION_MAKERS,
    locationStrictness: LOCATION_STRICTNESS,
    proximityRequirements: PROXIMITY_REQUIREMENTS,
    clientReactions: CLIENT_REACTIONS,
    sharedViaOptions: SHARED_VIA_OPTIONS,
    requirementTypes: REQUIREMENT_TYPES,
    builderProjectStatuses: BUILDER_PROJECT_STATUSES
  });
}
