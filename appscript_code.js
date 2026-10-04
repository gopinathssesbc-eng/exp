// name of the google sheet- expesne_manager



const PROFILES = {
  "Gopi": { sheet: "gopi", adminSheet: "Gopi_admin" }
};

function getAdminData(adminSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(adminSheetName);

  if (!sheet) {
    sheet = ss.insertSheet(adminSheetName);
    sheet.getRange(1, 1, 1, 2).setValues([["password", "0000"]]);
    sheet.getRange(2, 1, 1, 2).setValues([["payment category", "EXPENSE CATEGORY"]]);
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  let pin = "0000";
  if (values.length > 0 && values[0].length > 1) {
    // If the cell contains a number like '0488', Google Sheets treats it as 488.
    // We need to convert it to a string and pad it back to 4 digits.
    pin = String(values[0][1]).trim();
    if (pin.length < 4 && !isNaN(pin)) {
      pin = pin.padStart(4, '0');
    }
  }

  const paidFrom = [];
  const categories = [];

  for (let i = 2; i < values.length; i++) {
    if (values[i][0]) paidFrom.push(String(values[i][0]).trim());
    if (values[i][1]) categories.push(String(values[i][1]).trim());
  }

  return { pin, paidFrom, categories };
}

function checkAuth(profileName, pinInput) {
  const profile = PROFILES[profileName];
  if (!profile) return { valid: false, error: "Invalid Profile" };

  const adminData = getAdminData(profile.adminSheet);
  if (adminData.pin !== String(pinInput).trim()) {
    return { valid: false, error: "Invalid PIN" };
  }

  return { valid: true, adminData, profile };
}

function setupSheet(profileName) {
  const profile = PROFILES[profileName];
  if (!profile) throw new Error("Invalid profile");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(profile.sheet);

  if (!sheet) {
    sheet = ss.insertSheet(profile.sheet);
  }

  const headers = sheet.getRange(1, 1, 1, 5).getValues()[0];
  if (headers[0] === "" || headers[0] !== "Date") {
    sheet.getRange(1, 1, 1, 5).setValues([['Date', 'Amount', 'Paid From', 'Category', 'Description']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }

  return sheet;
}

function doGet(e) {
  const profileName = e.parameter.profile;
  const pin = e.parameter.pin;

  const auth = checkAuth(profileName, pin);
  if (!auth.valid) {
    return ContentService.createTextOutput(JSON.stringify({ error: auth.error, status: "error" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.action && e.parameter.action !== 'read') {
    return doPost(e);
  }

  try {
    const sheet = setupSheet(profileName);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

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

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: data,
      settings: {
        paidFrom: auth.adminData.paidFrom,
        categories: auth.adminData.categories
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let requestData;
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      requestData = e.parameter;
    }

    const auth = checkAuth(requestData.profile, requestData.pin);
    if (!auth.valid) {
      return ContentService.createTextOutput(JSON.stringify({ error: auth.error, status: "error" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const { action } = requestData;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'change_password') {
      const { new_pin } = requestData;
      const adminSheet = ss.getSheetByName(auth.profile.adminSheet);
      adminSheet.getRange(1, 2).setValue(new_pin);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Password updated successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'add_setting' || action === 'delete_setting') {
      const { setting_type, value } = requestData;
      const adminSheet = ss.getSheetByName(auth.profile.adminSheet);
      const col = setting_type === 'paid_from' ? 1 : 2;

      const numRows = Math.max(adminSheet.getLastRow(), 3);
      const range = adminSheet.getRange(3, col, numRows - 2, 1);
      const values = range.getValues();
      let arr = values.map(r => r[0]).filter(v => v !== "");

      if (action === 'add_setting') {
        if (!arr.includes(value)) arr.push(value);
      } else {
        arr = arr.filter(v => String(v).trim() !== String(value).trim());
      }

      range.clearContent();
      if (arr.length > 0) {
        adminSheet.getRange(3, col, arr.length, 1).setValues(arr.map(v => [v]));
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Setting updated" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Existing expense logic
    const sheet = setupSheet(requestData.profile);
    const { row, date, amount, paidFrom, category, description } = requestData;

    if (action === 'edit' && row) {
      sheet.getRange(row, 1, 1, 5).setValues([[date, amount, paidFrom, category, description]]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Expense updated successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'delete' && row) {
      sheet.deleteRow(row);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Expense deleted successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      sheet.appendRow([date, amount, paidFrom, category, description]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Expense added successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
