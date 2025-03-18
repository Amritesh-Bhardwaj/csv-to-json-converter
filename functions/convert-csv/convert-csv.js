// Import csv-parse package
const { parse } = require('csv-parse/sync');

exports.handler = async function(event, context) {
  console.log("Function started");
  
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      console.log("Method not allowed:", event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
      };
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      console.log("Error parsing request body:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Invalid request body format' })
      };
    }

    // Get CSV content
    const csvContent = requestBody.csvContent;
    if (!csvContent) {
      console.log("Missing CSV content");
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'No CSV content provided' })
      };
    }

    console.log("CSV content received, length:", csvContent.length);

    // Parse CSV to JSON
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    console.log("CSV parsed successfully, records:", records.length);

    // Convert to hierarchical structure
    const result = convertToHierarchicalJson(records);
    
    console.log("Hierarchical JSON created successfully");

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.log("Error in function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: `Failed to convert CSV: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

function convertToHierarchicalJson(records) {
  // Initialize result structure
  const result = { tableData: [] };
  
  // Keep track of current state and region
  let currentState = null;
  let currentRegion = null;
  
  // Process each row in the records
  for (const row of records) {
    const stateName = row['State'] || null;
    const regionCode = row['Region'] || null;
    const branchName = row['Branch Name'] || null;
    
    // Skip Grand Total rows
    if (stateName === "Grand Total" || branchName === "Grand Total") {
      continue;
    }
    
    // Extract all metrics from the row
    const metrics = extractMetrics(row);
    
    // State row: State column has a value and it's not a branch row
    if (stateName && !(branchName && !branchName.includes("Total"))) {
      const stateId = stateName.toLowerCase().replace(/\s/g, "");
      const stateObj = {
        id: stateId,
        name: stateName,
        ...metrics,
        regions: []
      };
      result.tableData.push(stateObj);
      currentState = stateObj;
    }
    
    // Region row: Branch Name contains "Region Total"
    else if (branchName && branchName.includes("Region Total") && currentState) {
      const regionId = regionCode ? regionCode.toLowerCase() : "";
      const regionObj = {
        id: regionId,
        name: branchName,
        ...metrics,
        branches: []
      };
      currentState.regions.push(regionObj);
      currentRegion = regionObj;
    }
    
    // Branch row: Has Branch Name that isn't a "Region Total" or "Grand Total"
    else if (branchName && !branchName.includes("Total") && currentRegion) {
      const branchId = branchName.toLowerCase().replace(/\s/g, "").replace(/-/g, "");
      const branchObj = {
        id: branchId,
        name: branchName,
        ...metrics
      };
      currentRegion.branches.push(branchObj);
    }
  }
  
  return result;
}

function extractMetrics(row) {
  const safeParseInt = (value) => {
    try {
      return value !== undefined && value !== null && value !== '' ? 
        parseInt(parseFloat(value)) : 0;
    } catch (e) {
      return 0;
    }
  };
  
  const safeParseFloat = (value) => {
    try {
      return value !== undefined && value !== null && value !== '' ? 
        parseFloat(value) : 0;
    } catch (e) {
      return 0;
    }
  };

  return {
    openingStock: safeParseInt(row['Opening Stock']),
    applicationLogin: safeParseInt(row['Application Login']),
    sanctionCount: safeParseInt(row['Sanction Count']),
    sanctionAmt: safeParseFloat(row['Sanction Amt (in Cr)']),
    pniSanctionCount: safeParseInt(row['PNI Sanction Count']),
    pniSanctionAmount: safeParseFloat(row['PNI Sanction Amount (in Cr)']),
    freshDisbCount: safeParseInt(row['Fresh Disb Count']),
    freshDisbAmt: safeParseFloat(row['Fresh Disb Amt (in Cr.)']),
    totalDisbAmt: safeParseFloat(row['Total Disb Amt (in Cr)']),
    diAmt: safeParseFloat(row['DI Amt (in Cr)']),
    rejection: safeParseInt(row['Rejection']),
    cancellation: safeParseInt(row['Cancellation']),
    ftr: safeParseFloat(row['FTR%']),
    wip: safeParseInt(row['WIP']),
    pendingForAllocationByCPA: safeParseInt(row['Pending for allocation by CPA']),
    wipCPA: safeParseInt(row['WIP-CPA']),
    salesTrayLoginAcceptance: safeParseInt(row['Sales Tray (Login Acceptance)']),
    creditPendingDDERecoStage: safeParseInt(row['Credit Pending (DDE & Reco Stage)']),
    salesTrayDDERECO: safeParseInt(row['Sales Tray (DDE & RECO)'])
  };
}
