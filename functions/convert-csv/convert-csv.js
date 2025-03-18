import { parse } from 'csv-parse/sync';

export async function handler(event, context) {
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // Parse the multipart form-data
    let csvData;
    
    // Get the CSV data from the request body
    if (event.isBase64Encoded) {
      const base64Data = event.body.split(',')[1];
      csvData = Buffer.from(base64Data, 'base64').toString('utf8');
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'CSV data not found or not properly encoded' })
      };
    }

    // Parse CSV to JSON
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    // Convert to hierarchical structure
    const result = convertToHierarchicalJson(records);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to convert CSV: ${error.message}` })
    };
  }
}

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
  return {
    openingStock: parseInt(parseFloat(row['Opening Stock'] || 0)),
    applicationLogin: parseInt(parseFloat(row['Application Login'] || 0)),
    sanctionCount: parseInt(parseFloat(row['Sanction Count'] || 0)),
    sanctionAmt: parseFloat(row['Sanction Amt (in Cr)'] || 0),
    pniSanctionCount: parseInt(parseFloat(row['PNI Sanction Count'] || 0)),
    pniSanctionAmount: parseFloat(row['PNI Sanction Amount (in Cr)'] || 0),
    freshDisbCount: parseInt(parseFloat(row['Fresh Disb Count'] || 0)),
    freshDisbAmt: parseFloat(row['Fresh Disb Amt (in Cr.)'] || 0),
    totalDisbAmt: parseFloat(row['Total Disb Amt (in Cr)'] || 0),
    diAmt: parseFloat(row['DI Amt (in Cr)'] || 0),
    rejection: parseInt(parseFloat(row['Rejection'] || 0)),
    cancellation: parseInt(parseFloat(row['Cancellation'] || 0)),
    ftr: parseFloat(row['FTR%'] || 0),
    wip: parseInt(parseFloat(row['WIP'] || 0)),
    pendingForAllocationByCPA: parseInt(parseFloat(row['Pending for allocation by CPA'] || 0)),
    wipCPA: parseInt(parseFloat(row['WIP-CPA'] || 0)),
    salesTrayLoginAcceptance: parseInt(parseFloat(row['Sales Tray (Login Acceptance)'] || 0)),
    creditPendingDDERecoStage: parseInt(parseFloat(row['Credit Pending (DDE & Reco Stage)'] || 0)),
    salesTrayDDERECO: parseInt(parseFloat(row['Sales Tray (DDE & RECO)'] || 0))
  };
}
