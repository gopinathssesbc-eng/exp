const PIN = "0488";
const SHEET_NAME = "expense_details";

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // If the sheet doesn't exist, create it
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // Check if headers exist
  const headers = sheet.getRange(1, 1, 1, 5).getValues()[0];
  if (headers[0] === "" || headers[0] !== "Date") {
    // Write headers
    sheet.getRange(1, 1, 1, 5).setValues([['Date', 'Amount', 'Paid From', 'Category', 'Description']]);
    // Optional: make headers bold
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  
  return sheet;
}

function doGet(e) {
  // Check PIN
  const pin = e.parameter.pin;
  if (pin !== PIN) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid PIN", status: "error" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheet = setupSheet();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Convert to array of objects
    const data = [];
    if (values.length > 1) {
      const headers = values[0];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const obj = { row: i + 1 };
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = row[j];
        }
        data.push(obj);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let requestData;
    // In Apps Script, post data usually comes in postData.contents
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      // fallback for x-www-form-urlencoded
      requestData = e.parameter;
    }
    
    if (requestData.pin !== PIN) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Invalid PIN", status: "error" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = setupSheet();
    const { action, row, date, amount, paidFrom, category, description } = requestData;
    
    if (action === 'edit' && row) {
      sheet.getRange(row, 1, 1, 5).setValues([[date, amount, paidFrom, category, description]]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Expense updated successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Append the row
      sheet.appendRow([date, amount, paidFrom, category, description]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Expense added successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
