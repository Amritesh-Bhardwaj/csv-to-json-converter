const { parse } = require('csv-parse/sync');

exports.handler = async function(event, context) {
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request body format' })
      };
    }

    // Get CSV content
    const csvContent = requestBody.csvContent;
    if (!csvContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No CSV content provided' })
      };
    }

    // Parse CSV to JSON
    const records = parse(csvContent, {
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
};

function convertToHierarchicalJson(records) {
  const result = { tableData: [] };
  let currentState = null;
  let currentRegion = null;
  
  // Create maps to track states and regions by name/ID
  const stateMap = {};
  const regionMap = {};
  
  // First pass: process all state rows and create state objects
  for (const row of records) {
    const stateName = row['State'] ? row['State'].trim() : "";
    
    // Skip rows without a state name or rows that are region totals
    if (!stateName || stateName.includes("Region Total")) continue;
    
    // Create state object if not already created
    if (!stateMap[stateName]) {
      const stateId = stateName.toLowerCase().replace(/\s+/g, "");
      const stateObj = {
        id: stateId,
        name: stateName,
        ...extractMetrics(row),
        regions: []
      };
      result.tableData.push(stateObj);
      stateMap[stateName] = stateObj;
    }
  }
  
  // Second pass: process region total rows
  for (const row of records) {
    const stateName = row['State'] ? row['State'].trim() : "";
    const branchName = row['Branch Name'] ? row['Branch Name'].trim() : "";
    
    // Check if this is a region total row
    const isRegionTotal = stateName.includes("Region Total") || 
                         (branchName && branchName.includes("Region Total"));
    
    if (isRegionTotal) {
      // Extract region ID from name (e.g., "MH1 Region Total" -> "mh1")
      let regionId, parentStateName;
      
      if (stateName.includes("Region Total")) {
        // If region total is in the state column
        regionId = stateName.split(" ")[0].toLowerCase();
        
        // Find the parent state for this region
        // Look back at previous rows to find the last state
        for (let i = records.indexOf(row) - 1; i >= 0; i--) {
          const prevStateName = records[i]['State'] ? records[i]['State'].trim() : "";
          if (prevStateName && !prevStateName.includes("Region Total")) {
            parentStateName = prevStateName;
            break;
          }
        }
      } else {
        // If region total is in the branch name column
        regionId = row['Region'] ? row['Region'].toLowerCase() : "";
        parentStateName = stateName;
      }
      
      // Find the parent state object
      const parentState = stateMap[parentStateName];
      if (parentState) {
        // Create region object
        const regionObj = {
          id: regionId,
          name: branchName || stateName, // Use appropriate name
          ...extractMetrics(row),
          branches: []
        };
        
        // Add region to parent state
        parentState.regions.push(regionObj);
        
        // Store region in map for branch association
        regionMap[regionId] = { region: regionObj, parentState: parentStateName };
      }
    }
  }
  
  // Third pass: process branch rows
  for (const row of records) {
    const stateName = row['State'] ? row['State'].trim() : "";
    const regionCode = row['Region'] ? row['Region'].trim() : "";
    const branchName = row['Branch Name'] ? row['Branch Name'].trim() : "";
    
    // Skip if this is a state row, region total row, or has no branch name
    if (!branchName || 
        branchName.includes("Region Total") || 
        branchName.includes("Grand Total") ||
        (stateName && !regionCode)) {
      continue;
    }
    
    // Find the parent region for this branch
    let parentRegion = null;
    const regionId = regionCode.toLowerCase();
    
    if (regionMap[regionId]) {
      parentRegion = regionMap[regionId].region;
    } else {
      // If region not found directly, try to find by state name
      const parentState = stateMap[stateName] || 
                         (stateName === "" && Object.values(stateMap).find(s => 
                          s.regions.some(r => r.id === regionId)));
      
      if (parentState) {
        parentRegion = parentState.regions.find(r => r.id === regionId);
      }
    }
    
    // Add branch to its parent region
    if (parentRegion) {
      const branchObj = {
        id: branchName.toLowerCase().replace(/\s+/g, "").replace(/-/g, ""),
        name: branchName,
        ...extractMetrics(row)
      };
      
      parentRegion.branches.push(branchObj);
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
