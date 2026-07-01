// ============================================================
// Inventory.gs — Property Inventory Management
// Signature Realty CRM V10
// ============================================================

// ---- Generate sequential Property ID (P-0001 format) ----
function generatePropertyId() {
  try {
    var rows = getSheetData(SHEET_NAMES.INVENTORY);
    var max = 0;
    rows.forEach(function(r) {
      var id = String(r.PropertyID || '');
      if (id.indexOf('P-') === 0) {
        var num = parseInt(id.replace('P-', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return 'P-' + ('000' + (max + 1)).slice(-4);
  } catch(e) {
    return 'P-' + new Date().getTime().toString().slice(-4);
  }
}

// ---- Generate sequential Project ID (PRJ-001 format) ----
function generateProjectId() {
  try {
    var rows = getSheetData(SHEET_NAMES.BUILDER_PROJECTS);
    var max = 0;
    rows.forEach(function(r) {
      var id = String(r.ProjectID || '');
      if (id.indexOf('PRJ-') === 0) {
        var num = parseInt(id.replace('PRJ-', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return 'PRJ-' + ('00' + (max + 1)).slice(-3);
  } catch(e) {
    return 'PRJ-' + new Date().getTime().toString().slice(-4);
  }
}

// ---- Duplicate detection for properties ----
function propertyDuplicateCheck(data) {
  try {
    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var addr = String(data.FullAddress || '').toLowerCase().trim();
    var ownerPhone = cleanPhone(data.OwnerPhone || '');
    var price = safeNum(data.Price || 0);

    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      // Same address + owner phone
      if (addr && String(p.FullAddress || '').toLowerCase().trim() === addr &&
          ownerPhone && cleanPhone(p.OwnerPhone || '') === ownerPhone) {
        return { isDuplicate: true, existingId: p.PropertyID };
      }
      // Same address + similar price range (±10%)
      if (addr && String(p.FullAddress || '').toLowerCase().trim() === addr &&
          price > 0 && Math.abs(safeNum(p.Price) - price) / price < 0.10) {
        return { isDuplicate: true, existingId: p.PropertyID };
      }
    }
    return { isDuplicate: false };
  } catch(e) {
    return { isDuplicate: false };
  }
}

function createProperty(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'create');
    if (!data.FullAddress && !data.Address) return error('Property address is required.');
    if (!data.ListingType) return error('Listing type is required (Owner / Agent-Broker / Builder-Developer).');
    if (!data.Price && data.TransactionType !== 'Rent') return error('Property price is required.');
    if (!data.Category) return error('Property category is required.');

    // Duplicate check
    var dup = propertyDuplicateCheck(data);
    var dupFlag = dup.isDuplicate ? 'Yes' : 'No';
    var dupRef = dup.isDuplicate ? dup.existingId : '';

    var propId = generatePropertyId();
    var now = new Date();

    // Auto-calculate price per sqft
    var price = safeNum(data.Price || 0);
    var carpet = safeNum(data.CarpetArea || 0);
    var pricePerSqft = (price > 0 && carpet > 0) ? Math.round(price / carpet) : 0;

    // Auto-calculate expected commission
    var brokerageTerms = String(data.BrokerageTerms || '2%');
    var commRate = parseFloat(brokerageTerms) || 2;
    var expectedCommission = Math.round(price * commRate / 100);

    var row = [
      // GROUP A: Property Identity
      propId, now, sanitizeString(session.name),
      data.ListingType,
      sanitizeString(data.LinkedProjectID || ''),
      sanitizeString(data.LinkedRequirementID || ''),
      'Pending Verification',
      dupFlag, dupRef,
      // GROUP B: Basic Property Info
      sanitizeString(data.ProjectBuildingName || data.PropertyName || ''),
      data.TransactionType || 'Sale',
      data.Category,
      data.SubCategory || '',
      sanitizeString(data.FullAddress || data.Address || ''),
      sanitizeString(data.Landmark || ''),
      sanitizeString(data.GeoCoordinates || ''),
      sanitizeString(data.DistanceFromLandmarks || ''),
      data.MarketType || '',
      // GROUP C: Unit-Specific Detail
      sanitizeString(data.UnitNumber || ''),
      sanitizeString(data.TowerBlock || ''),
      sanitizeString(data.FloorNumber || data.Floor || ''),
      sanitizeString(data.TotalFloors || ''),
      sanitizeNumber(data.BHK || 0),
      sanitizeNumber(data.CarpetArea || data.Carpet || 0),
      sanitizeNumber(data.BuiltUpArea || data.Area || 0),
      sanitizeNumber(data.SuperBuiltUpArea || 0),
      pricePerSqft,
      data.FacingDirection || data.Facing || '',
      data.ViewOrientation || '',
      data.OldOrNew || '',
      sanitizeString(data.AgeOfProperty || ''),
      data.ConditionScore || '',
      data.QualityTag || '',
      // GROUP D: Price & Financial
      price,
      sanitizeNumber(data.OriginalListedPrice || price),
      '',               // PriceChangeLog — starts empty
      'No',             // PriceDropAlertFlag
      data.PriceNegotiable || 'No',
      sanitizeNumber(data.MaintenanceCharges || 0),
      sanitizeNumber(data.SecurityDeposit || 0),
      sanitizeNumber(data.BookingTokenAmount || 0),
      brokerageTerms,
      expectedCommission,
      sanitizeString(data.CommissionSplit || ''),
      data.GSTApplicable || 'No',
      data.AllInclusiveOrExtra || 'Inclusive',
      // GROUP E: Residential Specific
      data.FurnishingStatus || '',
      sanitizeString(data.Parking || ''),
      sanitizeString(data.Amenities || ''),
      data.PossessionStatus || data.Possession || '',
      sanitizeString(data.PossessionDate || ''),
      sanitizeString(data.SocietyRWAName || ''),
      data.WaterAvailability || '',
      data.PowerBackup || '',
      sanitizeString(data.SocietyAge || ''),
      sanitizeString(data.TotalUnitsInSociety || ''),
      // GROUP F: Residential Rent (Owner conditions)
      data.TenantPreference || '',
      data.FoodPrefAllowed || '',
      data.PetsAllowedOwner || '',
      data.CompanyLeaseAccepted || '',
      sanitizeString(data.LockInPeriod || ''),
      sanitizeString(data.LeaseDurationOwner || ''),
      // GROUP G: Commercial Specific
      sanitizeString(data.BusinessTypeSuitableFor || ''),
      sanitizeNumber(data.CommCarpetArea || 0),
      sanitizeNumber(data.CommFrontage || 0),
      sanitizeString(data.CommFloor || ''),
      data.CommWashroom || '',
      sanitizeNumber(data.CommPowerLoad || 0),
      data.CommFireNOC || '',
      sanitizeNumber(data.CommCustomerParking || 0),
      sanitizeNumber(data.CommStaffParking || 0),
      sanitizeString(data.CommLockIn || ''),
      sanitizeString(data.CommLeaseTenure || ''),
      data.SignageSpace || '',
      // GROUP H: Land/Plot
      sanitizeNumber(data.PlotArea || 0),
      data.CornerPlot || '',
      sanitizeNumber(data.PlotRoadWidth || 0),
      data.LayoutApproval || '',
      data.DTCPRERAApproved || '',
      // GROUP I: Industrial
      sanitizeNumber(data.IndBuiltUpArea || 0),
      sanitizeNumber(data.IndPowerLoad || 0),
      sanitizeNumber(data.IndCeilingHeight || 0),
      data.IndLoadingDock || '',
      sanitizeString(data.PollutionClearance || ''),
      // GROUP J: Media
      sanitizeString(data.Photos || ''),
      sanitizeString(data.VideoLink || ''),
      sanitizeString(data.Brochure || ''),
      sanitizeString(data.FloorPlan || ''),
      sanitizeString(data.VirtualTourLink || ''),
      // GROUP K: Owner Contact
      sanitizeString(data.OwnerName || ''),
      cleanPhone(data.OwnerPhone || ''),
      sanitizeString(data.OwnerEmail || ''),
      data.OwnerIDVerified || 'No',
      data.ExclusiveMandate || 'No',
      sanitizeString(data.MandateValidityDate || ''),
      data.CoOwnership || 'No',
      sanitizeString(data.CoOwnershipDetails || ''),
      // GROUP L: Broker Contact
      sanitizeString(data.BrokerName || ''),
      cleanPhone(data.BrokerPhone || ''),
      sanitizeString(data.BrokerAgencyName || ''),
      sanitizeString(data.CoBrokingCommissionSplit || ''),
      data.BrokerVerified || 'No',
      data.OriginalOwnerContactAvailable || 'No',
      // GROUP M: Builder Reference
      sanitizeString(data.SalesOfficeContact || ''),
      cleanPhone(data.SalesOfficePhone || ''),
      data.DirectBookingAllowed || 'No',
      // GROUP N: Status & Availability
      'Available',    // AvailabilityStatus
      '',             // HoldReason
      '',             // HoldLeadID
      sanitizeString(data.ListingValidityExpiry || ''),
      now,            // LastStatusUpdateDate
      0,              // DaysInInventory
      // GROUP O: Matching Metadata
      0, 0, '', '',
      // GROUP P: Legal/Documentation
      data.TitleClear || '',
      sanitizeString(data.DocumentsChecklist || ''),
      data.LitigationStatus || 'Clear',
      // GROUP Q: Portal & Co-listing
      data.PostedOnPortals || 'No',
      sanitizeString(data.ExternalPortalLinks || ''),
      sanitizeString(data.CoListingAgents || ''),
      // GROUP R: Internal Notes
      sanitizeString(data.InternalRemarks || ''),
      sanitizeString(data.SpecialSellingPoints || ''),
      // System
      now, now
    ];

    appendToSheet(SHEET_NAMES.INVENTORY, row);
    logCreate(session.userId, 'Inventory', propId, {
      address: data.FullAddress, price: price, listingType: data.ListingType
    });

    // Alert admin if duplicate flagged
    if (dup.isDuplicate) {
      sendPropertyDuplicateAlert(propId, dup.existingId);
    }

    return success({ propertyId: propId, pricePerSqft: pricePerSqft, expectedCommission: expectedCommission },
      'Property added: ' + propId + (dup.isDuplicate ? ' (Possible duplicate — review needed)' : ''));
  } catch(e) {
    Logger.log('createProperty error: ' + e);
    return error(e.message);
  }
}

function getProperty(propertyId) {
  try {
    var session = requireLogin();
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return error('Property not found.');

    // Privacy layer: if not the listing agent or admin, hide personal contacts
    if (session.role === 'Agent' && prop.AddedByAgent !== session.name) {
      prop.OwnerPhone = '(Contact listing agent)';
      prop.OwnerEmail = '(Contact listing agent)';
      prop.BrokerPhone = '(Contact listing agent)';
    }

    // Auto-update DaysInInventory
    if (prop.CreatedDate) {
      prop.DaysInInventory = daysBetween(prop.CreatedDate, new Date());
    }

    // If Builder, pull project details
    if (prop.ListingType === 'Builder-Developer' && prop.LinkedProjectID) {
      var project = findRowById(SHEET_NAMES.BUILDER_PROJECTS, 'ProjectID', prop.LinkedProjectID);
      if (project) prop._projectDetails = project;
    }

    return success(prop);
  } catch(e) {
    return error(e.message);
  }
}

function getAllProperties(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.INVENTORY);

    if (filters.listingType) rows = rows.filter(function(r) { return r.ListingType === filters.listingType; });
    if (filters.category) rows = rows.filter(function(r) { return r.Category === filters.category; });
    if (filters.transactionType) rows = rows.filter(function(r) { return r.TransactionType === filters.transactionType; });
    if (filters.status) rows = rows.filter(function(r) { return r.AvailabilityStatus === filters.status; });
    if (filters.verificationStatus) rows = rows.filter(function(r) { return r.VerificationStatus === filters.verificationStatus; });
    if (filters.minPrice) rows = rows.filter(function(r) { return safeNum(r.Price) >= safeNum(filters.minPrice); });
    if (filters.maxPrice) rows = rows.filter(function(r) { return safeNum(r.Price) <= safeNum(filters.maxPrice); });
    if (filters.bhk) rows = rows.filter(function(r) { return safeNum(r.BHK) === safeNum(filters.bhk); });
    if (filters.possession) rows = rows.filter(function(r) { return r.PossessionStatus === filters.possession; });
    if (filters.location) rows = rows.filter(function(r) {
      return String(r.FullAddress || '').toLowerCase().indexOf(filters.location.toLowerCase()) !== -1;
    });
    if (filters.staleOnly) {
      var staleDays = getConfig('Stale_Inventory_Days') || 60;
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - staleDays);
      rows = rows.filter(function(r) {
        return r.AvailabilityStatus === 'Available' && new Date(r.CreatedDate) < cutoff;
      });
    }
    if (filters.search) {
      rows = filterByQuery(rows, filters.search, [
        'ProjectBuildingName', 'FullAddress', 'OwnerName', 'BrokerName', 'PropertyID'
      ]);
    }

    // Auto-calculate DaysInInventory for display
    rows = rows.map(function(r) {
      r.DaysInInventory = r.CreatedDate ? daysBetween(r.CreatedDate, new Date()) : 0;
      return r;
    });

    rows = sortArray(rows, 'CreatedDate', 'desc');
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch(e) {
    return error(e.message);
  }
}

function updateProperty(propertyId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'update');
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return error('Property not found.');
    var headers = getHeaders(SHEET_NAMES.INVENTORY);
    var oldPrice = safeNum(prop.Price);

    var updatable = [
      'ProjectBuildingName', 'TransactionType', 'Category', 'SubCategory',
      'FullAddress', 'Landmark', 'GeoCoordinates', 'MarketType',
      'UnitNumber', 'TowerBlock', 'FloorNumber', 'TotalFloors',
      'BHK', 'CarpetArea', 'BuiltUpArea', 'SuperBuiltUpArea',
      'FacingDirection', 'ViewOrientation', 'OldOrNew', 'ConditionScore', 'QualityTag',
      'Price', 'PriceNegotiable', 'MaintenanceCharges', 'SecurityDeposit',
      'BookingTokenAmount', 'BrokerageTerms', 'GSTApplicable',
      'FurnishingStatus', 'Parking', 'Amenities',
      'PossessionStatus', 'PossessionDate', 'SocietyRWAName',
      'WaterAvailability', 'PowerBackup',
      'TenantPreference', 'FoodPrefAllowed', 'PetsAllowedOwner',
      'CompanyLeaseAccepted', 'LockInPeriod', 'LeaseDurationOwner',
      'Photos', 'VideoLink', 'Brochure', 'FloorPlan', 'VirtualTourLink',
      'OwnerName', 'OwnerPhone', 'OwnerEmail', 'OwnerIDVerified',
      'ExclusiveMandate', 'MandateValidityDate', 'CoOwnership',
      'BrokerName', 'BrokerPhone', 'BrokerAgencyName', 'BrokerVerified',
      'AvailabilityStatus', 'HoldReason', 'HoldLeadID', 'ListingValidityExpiry',
      'TitleClear', 'DocumentsChecklist', 'LitigationStatus',
      'PostedOnPortals', 'ExternalPortalLinks',
      'InternalRemarks', 'SpecialSellingPoints',
      'VerificationStatus'
    ];

    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, idx + 1, data[f]);
      }
    });

    // Price change: recalculate PricePerSqft + log change + set drop alert
    if (data.Price !== undefined) {
      var newPrice = safeNum(data.Price);
      var carpet = safeNum(prop.CarpetArea || 0);
      if (carpet > 0) {
        var ppsIdx = headers.indexOf('PricePerSqft');
        if (ppsIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, ppsIdx + 1, Math.round(newPrice / carpet));
      }
      // Recalculate commission
      var brokPct = parseFloat(String(prop.BrokerageTerms || '2')) || 2;
      var newComm = Math.round(newPrice * brokPct / 100);
      var commIdx = headers.indexOf('ExpectedCommission');
      if (commIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, commIdx + 1, newComm);

      // Log price change
      var logEntry = formatDate(new Date()) + ': ₹' + formatNum(oldPrice) + ' → ₹' + formatNum(newPrice);
      var pclIdx = headers.indexOf('PriceChangeLog');
      var existingLog = String(prop.PriceChangeLog || '');
      if (pclIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, pclIdx + 1,
        existingLog ? existingLog + '\n' + logEntry : logEntry);

      // Set drop alert if price reduced
      if (newPrice < oldPrice) {
        var pdIdx = headers.indexOf('PriceDropAlertFlag');
        if (pdIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, pdIdx + 1, 'Yes');
        sendPriceDropAlert(propertyId, oldPrice, newPrice);
      }
    }

    // Update status timestamp
    if (data.AvailabilityStatus) {
      var lstIdx = headers.indexOf('LastStatusUpdateDate');
      if (lstIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, lstIdx + 1, new Date());
    }

    var lmIdx = headers.indexOf('LastModifiedDate');
    if (lmIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, lmIdx + 1, new Date());

    logUpdate(session.userId, 'Inventory', propertyId, prop, data);
    return success(null, 'Property updated successfully');
  } catch(e) {
    return error(e.message);
  }
}

function deleteProperty(propertyId) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'delete');
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return error('Property not found.');
    deleteSheetRow(SHEET_NAMES.INVENTORY, prop._row);
    logDelete(session.userId, 'Inventory', propertyId, prop);
    return success(null, 'Property deleted');
  } catch(e) {
    return error(e.message);
  }
}

function updatePropertyStatus(propertyId, status, reason, holdLeadId) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'update');
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return error('Property not found.');
    if (PROPERTY_STATUSES.indexOf(status) === -1) return error('Invalid status: ' + status);
    var headers = getHeaders(SHEET_NAMES.INVENTORY);

    var stIdx = headers.indexOf('AvailabilityStatus');
    var hrIdx = headers.indexOf('HoldReason');
    var hlIdx = headers.indexOf('HoldLeadID');
    var lstIdx = headers.indexOf('LastStatusUpdateDate');

    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, stIdx + 1, status);
    if (hrIdx !== -1 && reason) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, hrIdx + 1, reason);
    if (hlIdx !== -1 && holdLeadId) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, hlIdx + 1, holdLeadId);
    if (lstIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, lstIdx + 1, new Date());

    logUpdate(session.userId, 'Inventory', propertyId, { AvailabilityStatus: prop.AvailabilityStatus }, { AvailabilityStatus: status });
    return success(null, 'Property status → ' + status);
  } catch(e) {
    return error(e.message);
  }
}

function verifyProperty(propertyId, status) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'update');
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return error('Property not found.');
    var headers = getHeaders(SHEET_NAMES.INVENTORY);
    var vsIdx = headers.indexOf('VerificationStatus');
    if (vsIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, vsIdx + 1, status);
    logUpdate(session.userId, 'Inventory', propertyId, { VerificationStatus: prop.VerificationStatus }, { VerificationStatus: status });
    return success(null, 'Property verification → ' + status);
  } catch(e) {
    return error(e.message);
  }
}

function getAvailableProperties() {
  try {
    var rows = getSheetData(SHEET_NAMES.INVENTORY);
    return rows.filter(function(r) {
      return r.AvailabilityStatus === 'Available' && r.VerificationStatus === 'Verified';
    });
  } catch(e) { return []; }
}

function searchProperties(query, filters) {
  return getAllProperties(Object.assign({}, filters || {}, { search: query }));
}

// ---- Update matched lead count on property ----
function incrementPropertyMatchCount(propertyId) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return;
    var headers = getHeaders(SHEET_NAMES.INVENTORY);
    var idx = headers.indexOf('MatchedLeadCount');
    if (idx !== -1) {
      updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, idx + 1, safeNum(prop.MatchedLeadCount) + 1);
    }
  } catch(e) { Logger.log('incrementPropertyMatchCount: ' + e); }
}

function incrementPropertySharedCount(propertyId, interestedLeadId) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return;
    var headers = getHeaders(SHEET_NAMES.INVENTORY);
    var tsIdx = headers.indexOf('TimesSharedWithClients');
    var ilIdx = headers.indexOf('InterestedLeadsList');
    if (tsIdx !== -1) updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, tsIdx + 1, safeNum(prop.TimesSharedWithClients) + 1);
    if (ilIdx !== -1 && interestedLeadId) {
      var existing = String(prop.InterestedLeadsList || '');
      updateSheetCell(SHEET_NAMES.INVENTORY, prop._row, ilIdx + 1,
        existing ? existing + ',' + interestedLeadId : interestedLeadId);
    }
  } catch(e) { Logger.log('incrementPropertySharedCount: ' + e); }
}

// ---- Property Stats ----
function getPropertyStats() {
  try {
    var rows = getSheetData(SHEET_NAMES.INVENTORY);
    var stats = {
      total: rows.length,
      available: 0, hold: 0, sold: 0, rented: 0,
      withdrawn: 0, expired: 0,
      pendingVerification: 0, verified: 0,
      byCategory: {}, byListingType: {},
      stale: 0, avgDaysInInventory: 0
    };
    var staleDays = getConfig('Stale_Inventory_Days') || 60;
    var staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - staleDays);
    var totalDays = 0;

    rows.forEach(function(r) {
      var s = String(r.AvailabilityStatus || '').toLowerCase();
      var vs = String(r.VerificationStatus || '').toLowerCase();
      var lt = r.ListingType || 'Unknown';
      var cat = r.Category || 'Unknown';
      var days = r.CreatedDate ? daysBetween(r.CreatedDate, new Date()) : 0;
      totalDays += days;

      if (s === 'available') stats.available++;
      else if (s === 'hold') stats.hold++;
      else if (s === 'sold') stats.sold++;
      else if (s === 'rented') stats.rented++;
      else if (s === 'withdrawn') stats.withdrawn++;
      else if (s === 'expired') stats.expired++;

      if (vs === 'pending verification') stats.pendingVerification++;
      else if (vs === 'verified') stats.verified++;

      if (s === 'available' && r.CreatedDate && new Date(r.CreatedDate) < staleCutoff) stats.stale++;

      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
      stats.byListingType[lt] = (stats.byListingType[lt] || 0) + 1;
    });

    stats.avgDaysInInventory = rows.length > 0 ? Math.round(totalDays / rows.length) : 0;
    return stats;
  } catch(e) { return {}; }
}

// ---- Builder Projects ----
function createBuilderProject(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'create');
    if (!data.ProjectName) return error('Project name is required.');
    if (!data.RERANumber) return error('RERA number is required for builder projects.');

    var projectId = generateProjectId();
    var now = new Date();

    var row = [
      projectId,
      sanitizeString(data.BuilderCompanyName || ''),
      sanitizeString(data.ProjectName),
      sanitizeString(data.RERANumber),
      sanitizeString(data.ProjectLocation || ''),
      sanitizeString(data.GeoCoordinates || ''),
      data.ProjectType || '',
      data.LaunchStatus || 'Launched',
      sanitizeString(data.PossessionDateExpected || ''),
      sanitizeNumber(data.TotalTowersBlocks || 0),
      sanitizeNumber(data.TotalUnitsInProject || 0),
      sanitizeString(data.ConfigurationsAvailable || ''),
      sanitizeNumber(data.PriceRangeMin || 0),
      sanitizeNumber(data.PriceRangeMax || 0),
      sanitizeString(data.ProjectAmenities || ''),
      sanitizeString(data.SalesOfficeContact || ''),
      cleanPhone(data.SalesOfficePhone || ''),
      data.DirectBookingAllowed || 'No',
      sanitizeNumber(data.ChannelPartnerCommissionPercent || 0),
      sanitizeString(data.MasterBrochure || ''),
      sanitizeString(data.MasterLayoutPlan || ''),
      sanitizeString(data.ProjectPhotos || ''),
      data.ProjectStatus || 'Active',
      sanitizeNumber(data.BuilderPastProjectsCount || 0),
      sanitizeString(data.BuilderReputationNotes || ''),
      data.OnTimeDeliveryRecord || '',
      now, now
    ];

    appendToSheet(SHEET_NAMES.BUILDER_PROJECTS, row);
    logCreate(session.userId, 'BuilderProjects', projectId, { name: data.ProjectName });
    return success({ projectId: projectId }, 'Builder project created: ' + projectId);
  } catch(e) {
    Logger.log('createBuilderProject error: ' + e);
    return error(e.message);
  }
}

function getBuilderProject(projectId) {
  try {
    requireLogin();
    var project = findRowById(SHEET_NAMES.BUILDER_PROJECTS, 'ProjectID', projectId);
    if (!project) return error('Builder project not found.');
    // Also get all units for this project
    var units = getSheetData(SHEET_NAMES.INVENTORY).filter(function(r) {
      return r.LinkedProjectID === projectId;
    });
    project._units = units;
    project._unitStats = {
      total: units.length,
      available: units.filter(function(u) { return u.AvailabilityStatus === 'Available'; }).length,
      sold: units.filter(function(u) { return u.AvailabilityStatus === 'Sold'; }).length
    };
    return success(project);
  } catch(e) {
    return error(e.message);
  }
}

function getAllBuilderProjects(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.BUILDER_PROJECTS);
    if (filters.status) rows = rows.filter(function(r) { return r.ProjectStatus === filters.status; });
    if (filters.launchStatus) rows = rows.filter(function(r) { return r.LaunchStatus === filters.launchStatus; });
    if (filters.search) {
      rows = filterByQuery(rows, filters.search, ['ProjectName', 'BuilderCompanyName', 'RERANumber', 'ProjectLocation']);
    }
    return success(rows);
  } catch(e) {
    return error(e.message);
  }
}

function updateBuilderProject(projectId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'update');
    var project = findRowById(SHEET_NAMES.BUILDER_PROJECTS, 'ProjectID', projectId);
    if (!project) return error('Builder project not found.');
    var headers = getHeaders(SHEET_NAMES.BUILDER_PROJECTS);
    var updatable = [
      'BuilderCompanyName', 'ProjectName', 'RERANumber', 'ProjectLocation',
      'ProjectType', 'LaunchStatus', 'PossessionDateExpected',
      'TotalTowersBlocks', 'TotalUnitsInProject', 'ConfigurationsAvailable',
      'PriceRangeMin', 'PriceRangeMax', 'ProjectAmenities',
      'SalesOfficeContact', 'SalesOfficePhone', 'DirectBookingAllowed',
      'ChannelPartnerCommissionPercent',
      'MasterBrochure', 'MasterLayoutPlan', 'ProjectPhotos',
      'ProjectStatus', 'BuilderPastProjectsCount',
      'BuilderReputationNotes', 'OnTimeDeliveryRecord'
    ];
    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.BUILDER_PROJECTS, project._row, idx + 1, data[f]);
      }
    });
    var lmIdx = headers.indexOf('LastModifiedDate');
    if (lmIdx !== -1) updateSheetCell(SHEET_NAMES.BUILDER_PROJECTS, project._row, lmIdx + 1, new Date());
    logUpdate(session.userId, 'BuilderProjects', projectId, project, data);
    return success(null, 'Builder project updated');
  } catch(e) {
    return error(e.message);
  }
}

// ---- Bulk add Builder units ----
function bulkAddBuilderUnits(projectId, unitsArray) {
  try {
    var session = requireLogin();
    enforceRBAC('Inventory', 'create');
    var project = findRowById(SHEET_NAMES.BUILDER_PROJECTS, 'ProjectID', projectId);
    if (!project) return error('Builder project not found.');

    var results = { success: 0, failed: 0, errors: [] };
    unitsArray.forEach(function(unit, idx) {
      // Auto-fill project-level info
      unit.ListingType = 'Builder-Developer';
      unit.LinkedProjectID = projectId;
      unit.ProjectBuildingName = unit.ProjectBuildingName || project.ProjectName;
      unit.SalesOfficeContact = unit.SalesOfficeContact || project.SalesOfficeContact;
      unit.SalesOfficePhone = unit.SalesOfficePhone || project.SalesOfficePhone;
      unit.DirectBookingAllowed = unit.DirectBookingAllowed || project.DirectBookingAllowed;
      unit.Amenities = unit.Amenities || project.ProjectAmenities;

      var res = createProperty(unit);
      if (res.success) results.success++;
      else { results.failed++; results.errors.push('Unit ' + (idx + 1) + ': ' + res.message); }
    });
    return success(results, 'Bulk units: ' + results.success + ' added, ' + results.failed + ' failed');
  } catch(e) {
    return error(e.message);
  }
}

// ---- Agent: Property Dena (Submit own listing) ----
function agentSubmitProperty(data) {
  try {
    var session = requireLogin();
    data.AddedByAgent = session.name;
    var result = createProperty(data);
    if (result.success) {
      sendAdminPropertySubmissionNotification(result.data.propertyId, session.name);
    }
    return result;
  } catch(e) {
    return error(e.message);
  }
}

// ---- Agent: Property Lena (Submit property against a shared requirement) ----
function agentSubmitForRequirement(shareId, propertyData) {
  try {
    var session = requireLogin();

    // Validate share link
    var share = findRowById(SHEET_NAMES.REQ_SHARING, 'ShareID', shareId);
    if (!share) return error('Share link invalid.');
    if (share.Status !== 'Active') return error('Share link is no longer active.');
    if (new Date(share.ExpiryDate) < new Date()) return error('Share link has expired.');

    // Mark the linked requirement
    propertyData.LinkedRequirementID = share.LeadID;
    var result = createProperty(propertyData);

    if (result.success) {
      // Update share record
      var headers = getHeaders(SHEET_NAMES.REQ_SHARING);
      var psIdx = headers.indexOf('PropertiesSubmitted');
      var existing = safeNum(share.PropertiesSubmitted || 0);
      if (psIdx !== -1) updateSheetCell(SHEET_NAMES.REQ_SHARING, share._row, psIdx + 1, existing + 1);

      // Notify original lead-owner agent
      sendPropertySubmittedToRequirementNotification(
        result.data.propertyId, share.LeadID, session.name, share.GeneratedBy
      );
    }
    return result;
  } catch(e) {
    return error(e.message);
  }
}

// ---- Export ----
function exportPropertiesCSV(filters) {
  try {
    requireLogin();
    var result = getAllProperties(Object.assign({}, filters, { pageSize: 5000 }));
    var rows = result.data ? result.data.data : [];
    var headers = [
      'PropertyID', 'DateAdded', 'ListingType', 'Category', 'SubCategory',
      'TransactionType', 'ProjectBuildingName', 'FullAddress',
      'BHK', 'CarpetArea', 'Price', 'PricePerSqft',
      'AvailabilityStatus', 'VerificationStatus', 'PossessionStatus',
      'DaysInInventory', 'AddedByAgent'
    ];
    var csv = headers.join(',') + '\n';
    rows.forEach(function(r) {
      csv += headers.map(function(h) {
        return '"' + String(r[h] || '').replace(/"/g, '""') + '"';
      }).join(',') + '\n';
    });
    return success(csv);
  } catch(e) {
    return error(e.message);
  }
}

function bulkImportProperties(dataArray) {
  try {
    requireLogin();
    enforceRBAC('Inventory', 'create');
    var results = { success: 0, failed: 0, errors: [] };
    dataArray.forEach(function(data, idx) {
      var res = createProperty(data);
      if (res.success) results.success++;
      else { results.failed++; results.errors.push('Row ' + (idx + 1) + ': ' + res.message); }
    });
    return success(results);
  } catch(e) {
    return error(e.message);
  }
}

// ---- Helper ----
function formatNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
