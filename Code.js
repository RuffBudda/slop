/**
 * =========================================================
 *  LinkedIn Post Management — Google Apps Script Backend
 *  Single-User Application
 *  
 *  PURPOSE:
 *  Manages LinkedIn post content workflow from generation to approval.
 *  Reads/writes data from a single Google Sheet and serves web interface.
 *  
 *  ARCHITECTURE:
 *  - Single sheet configuration (no multi-user support)
 *  - Content generation workflow via n8n webhook
 *  - Image upload to DigitalOcean Spaces
 *  - Status-based workflow: Queue → Generated → Approved/Rejected
 *  
 *  =========================================================
 */

// ============================================================
// CONFIGURATION - Single User Settings
// ============================================================

/**
 * Google Sheets Spreadsheet ID
 * This is the unique identifier for your Google Sheets spreadsheet.
 * You can find this in the spreadsheet URL: 
 * https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
 * 
 * @type {string}
 */
const SHEET_ID = '1afGSfCHB7FY-w5iChqivtZulXync3kEv8tvfgHS3VsY';

/**
 * Google Sheets Tab/Sheet Name
 * This is the exact name of the sheet tab within the spreadsheet
 * that contains your post data. Must match exactly (case-sensitive).
 * 
 * @type {string}
 */
const SHEET_NAME = 'Automated Content';

/**
 * DigitalOcean Spaces Configuration
 * These credentials are stored in Apps Script Properties for security.
 * Set them via: File > Project Settings > Script Properties
 * 
 * Properties to set:
 * - SPACES_KEY: Your DigitalOcean Spaces access key
 * - SPACES_SECRET: Your DigitalOcean Spaces secret key
 * 
 * @type {string}
 */
const SPACES_NAME = 'cdweya';           // DigitalOcean Spaces bucket name
const SPACES_REGION = 'blr1';           // DigitalOcean Spaces region (Bangalore)
const SPACES_KEY = PropertiesService.getScriptProperties().getProperty('SPACES_KEY');
const SPACES_SECRET = PropertiesService.getScriptProperties().getProperty('SPACES_SECRET');

/**
 * n8n Webhook URL
 * This webhook is triggered when content generation is requested.
 * The webhook receives a POST request with the sheet name in the body.
 * 
 * @type {string}
 */
const N8N_WEBHOOK_URL = 'https://n8nv2.projectpeople.ae/webhook/b153d2da-395b-4f63-abad-7d2561724a16';

// ============================================================
// UTILITY FUNCTIONS - Helper functions used throughout
// ============================================================

/**
 * Normalizes a string by removing special characters and converting to lowercase.
 * 
 * This function handles:
 * - Non-breaking spaces (NBSP)
 * - Zero-width spaces and other invisible Unicode characters
 * - Trimming whitespace
 * - Converting to lowercase for case-insensitive matching
 * 
 * Used primarily for case-insensitive column name matching in Google Sheets.
 * 
 * @param {string|null|undefined} s - The string to normalize
 * @returns {string} Normalized lowercase string with special characters removed
 * 
 * @example
 * _norm('  Status  ') // returns 'status'
 * _norm('Post Schedule') // returns 'post schedule'
 * _norm(null) // returns ''
 */
function _norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')  // Remove NBSP and zero-width spaces
    .trim()                                         // Remove leading/trailing whitespace
    .toLowerCase();                                 // Convert to lowercase
}

/**
 * Converts various date formats to ISO 8601 string format.
 * 
 * Handles multiple input types:
 * - Date objects (converts directly)
 * - Date strings (parses and converts)
 * - DateTime strings (handles space-separated format)
 * 
 * Returns empty string if date is invalid or missing.
 * 
 * @param {Date|string|number|null|undefined} v - Date value to convert
 * @returns {string} ISO 8601 formatted date string (e.g., '2024-01-15T10:30:00.000Z') or empty string
 * 
 * @example
 * _asISO(new Date('2024-01-15')) // returns '2024-01-15T00:00:00.000Z'
 * _asISO('2024-01-15 10:30') // returns '2024-01-15T10:30:00.000Z'
 * _asISO(null) // returns ''
 */
function _asISO(v) {
  if (!v) return '';
  
  // If already a Date object, convert directly
  if (v instanceof Date) return new Date(v).toISOString();
  
  // Try parsing as date string
  var t = new Date(v);
  if (!isNaN(t.getTime())) return t.toISOString();
  
  // Try parsing as datetime string (space-separated)
  var s = String(v).replace(' ', 'T');
  var t2 = new Date(s);
  return isNaN(t2.getTime()) ? '' : t2.toISOString();
}

/**
 * Gets the active sheet object from the configured spreadsheet.
 * 
 * Opens the spreadsheet by ID and retrieves the sheet by name.
 * Throws an error if the sheet is not found.
 * 
 * @returns {Sheet} Google Sheets Sheet object
 * @throws {Error} If sheet is not found in spreadsheet
 * 
 * @example
 * const sh = _getSheet(); // Gets 'Automated Content' sheet
 */
function _getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    throw new Error('Sheet "' + SHEET_NAME + '" not found in spreadsheet.');
  }
  return sh;
}

/**
 * Gets a sheet object by name (with fallback to default sheet).
 * 
 * This function allows optional sheet name specification, but defaults
 * to the configured SHEET_NAME. Useful for maintaining backward compatibility
 * while simplifying single-user usage.
 * 
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Sheet} Google Sheets Sheet object
 * @throws {Error} If sheet is not found in spreadsheet
 * 
 * @example
 * const sh = _getSheetByName(); // Uses default 'Automated Content'
 * const sh = _getSheetByName('Other Sheet'); // Uses 'Other Sheet'
 */
function _getSheetByName(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const name = sheetName || SHEET_NAME;  // Fallback to default if not provided
  const sh = ss.getSheetByName(name);
  if (!sh) {
    throw new Error('Sheet "' + name + '" not found in spreadsheet.');
  }
  return sh;
}

/**
 * Creates a map of column names to their indices for efficient column lookup.
 * 
 * This function:
 * 1. Reads the first row (header row) of the sheet
 * 2. Normalizes each header name (lowercase, trimmed)
 * 3. Creates a map object: {normalizedHeaderName: columnIndex}
 * 
 * Column indices are 0-based (first column = 0, second = 1, etc.)
 * If duplicate header names exist, only the first occurrence is stored.
 * 
 * @param {Sheet} sh - The Google Sheets Sheet object
 * @returns {Object} Object with two properties:
 *   - headers: Array of original header names
 *   - map: Object mapping normalized header names to column indices
 * 
 * @example
 * const {headers, map} = _getHeaderMap(sh);
 * const statusCol = map['status']; // Returns column index for 'status' column
 * const idCol = map['id']; // Returns column index for 'id' column
 */
function _getHeaderMap(sh) {
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  
  headers.forEach(function(h, i) {
    const k = _norm(h);  // Normalize header name
    if (!(k in map)) map[k] = i;  // Store first occurrence only
  });
  
  return { headers, map };
}

/**
 * Gets the column index for a given column name from the header map.
 * 
 * Uses normalized column name matching (case-insensitive).
 * Returns -1 if column is not found.
 * 
 * @param {Object} map - Header map object from _getHeaderMap()
 * @param {string} name - Column name to look up (case-insensitive)
 * @returns {number} Column index (0-based) or -1 if not found
 * 
 * @example
 * const {map} = _getHeaderMap(sh);
 * const idx = _idx(map, 'status'); // Returns column index for status column
 * if (idx === -1) {
 *   // Column not found
 * }
 */
function _idx(map, name) {
  const k = _norm(name);  // Normalize the column name
  return (k in map) ? map[k] : -1;
}

// ============================================================
// WEB APP INITIALIZATION - Serves the HTML interface
// ============================================================

/**
 * Serves the main web app HTML when user visits the Apps Script web app URL.
 * 
 * This is the entry point for the application. When deployed as a web app,
 * this function is called whenever someone accesses the web app URL.
 * 
 * The function:
 * 1. Loads the 'index' HTML template file
 * 2. Evaluates it (processes Apps Script template syntax)
 * 3. Sets the page title
 * 4. Allows iframe embedding (for use in other sites)
 * 5. Sets viewport meta tag for mobile responsiveness
 * 
 * @returns {HtmlOutput} HTML output object ready to serve
 * 
 * @example
 * // Deploy as web app, then access the URL
 * // This function is automatically called by Apps Script
 */
function doGet() {
  // Create HTML template from 'index.html' file
  const t = HtmlService.createTemplateFromFile('index');
  
  // Evaluate template and configure output
  return t.evaluate()
    .setTitle('Post Manager')  // Browser tab title
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)  // Allow iframe embedding
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');  // Mobile responsive
}

/**
 * Includes HTML files within other HTML files using Apps Script template syntax.
 * 
 * This function allows you to split your HTML into multiple files for better
 * organization. Use it in HTML files with: <?!= include('filename'); ?>
 * 
 * The '!=' syntax means "output unescaped HTML" (safe for HTML content).
 * 
 * @param {string} filename - Name of HTML file to include (without .html extension)
 * @returns {string} HTML content of the included file
 * 
 * @example
 * // In index.html:
 * <?!= include('styles'); ?>  // Includes styles.html
 * <?!= include('utils'); ?>   // Includes utils.html
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// CONTENT TAB - Main review interface for "generated" posts
// ============================================================

/**
 * Fetches all rows with status === "generated" from the default sheet.
 * 
 * This function is used by the Content tab to display posts that are
 * ready for review and approval. It:
 * 1. Opens the configured sheet
 * 2. Reads all data rows
 * 3. Filters rows where status column equals "generated"
 * 4. Returns structured data with all relevant columns
 * 
 * @returns {Object} Object containing:
 *   - rows: Array of post objects with all column data
 *   - msg: Message string (empty if rows found, error message if not)
 * 
 * @example
 * const result = getData();
 * if (result.rows.length > 0) {
 *   // Display posts for review
 * } else {
 *   // Show empty state message
 * }
 */
function getData() {
  const sh = _getSheet();  // Get default sheet
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  
  // Validate sheet has data
  if (lastRow < 2 || lastCol < 1) {
    return { rows: [], msg: 'No data rows found.' };
  }

  // Get column mapping
  const { headers, map } = _getHeaderMap(sh);

  // Map column names to indices
  const c = {
    id:            _idx(map, 'id'),
    type:          _idx(map, 'type'),
    status:        _idx(map, 'status'),
    v1:            _idx(map, 'variant_1'),
    v2:            _idx(map, 'variant_2'),
    v3:            _idx(map, 'variant_3'),
    img1:          _idx(map, 'image_url_1'),
    img2:          _idx(map, 'image_url_2'),
    img3:          _idx(map, 'image_url_3'),
    choice:        _idx(map, 'choice'),
    img_choice:    _idx(map, 'img_choice'),
    final_img:     _idx(map, 'final_img'),
    final_content: _idx(map, 'final_content'),
    post_schedule: _idx(map, 'post_schedule'),
    additional_img: _idx(map, 'additional_img')
  };

  // Validate required column exists
  if (c.status === -1) {
    return { rows: [], msg: 'Missing header: status' };
  }

  // Read all data rows (skip header row)
  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = [];

  // Process each row
  for (var i = 0; i < vals.length; i++) {
    const r = vals[i];
    const statusCell = _norm(r[c.status]);  // Normalize status for comparison
    
    // Only include rows with status "generated"
    if (statusCell === 'generated') {
      rows.push({
        rowIndex:      i + 2,  // Actual row number in sheet (1-based, +1 for header)
        id:            c.id > -1 ? r[c.id] : '',
        Type:          c.type > -1 ? r[c.type] : '',
        variant_1:     c.v1 > -1 ? r[c.v1] : '',
        variant_2:     c.v2 > -1 ? r[c.v2] : '',
        variant_3:     c.v3 > -1 ? r[c.v3] : '',
        image_url_1:   c.img1 > -1 ? r[c.img1] : '',
        image_url_2:   c.img2 > -1 ? r[c.img2] : '',
        image_url_3:   c.img3 > -1 ? r[c.img3] : '',
        choice:        c.choice > -1 ? r[c.choice] : '',
        img_choice:    c.img_choice > -1 ? r[c.img_choice] : '',
        final_img:     c.final_img > -1 ? r[c.final_img] : '',
        final_content: c.final_content > -1 ? r[c.final_content] : '',
        post_schedule: c.post_schedule > -1 ? 
          (r[c.post_schedule] instanceof Date ? 
            r[c.post_schedule].toISOString().slice(0, 16).replace('T', ' ') : 
            (r[c.post_schedule] || '')
          ) : '',
        status:        'generated',
        status_raw:    r[c.status],
        additional_img: c.additional_img > -1 ? r[c.additional_img] : ''
      });
    }
  }

  return { 
    rows, 
    msg: rows.length ? '' : 'No items pending in "generated".' 
  };
}

/**
 * Fetches all rows with status === "generated" from a specific sheet.
 * 
 * This function maintains backward compatibility but defaults to the
 * configured sheet name. For single-user apps, sheetName parameter
 * is optional and will use SHEET_NAME if not provided.
 * 
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object containing rows array and message string
 * 
 * @example
 * const result = getContentFromSheet(); // Uses default sheet
 * const result = getContentFromSheet('Other Sheet'); // Uses specified sheet
 */
function getContentFromSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Use provided sheet name or fall back to default
  const finalSheetName = sheetName || SHEET_NAME;
  const sh = ss.getSheetByName(finalSheetName);
  
  if (!sh) {
    throw new Error('Sheet "' + finalSheetName + '" not found in spreadsheet.');
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  
  if (lastRow < 2 || lastCol < 1) {
    return { rows: [], msg: 'No data rows found.' };
  }

  const { headers, map } = _getHeaderMap(sh);

  // Map column names to indices (same as getData())
  const c = {
    id:            _idx(map, 'id'),
    type:          _idx(map, 'type'),
    status:        _idx(map, 'status'),
    v1:            _idx(map, 'variant_1'),
    v2:            _idx(map, 'variant_2'),
    v3:            _idx(map, 'variant_3'),
    img1:          _idx(map, 'image_url_1'),
    img2:          _idx(map, 'image_url_2'),
    img3:          _idx(map, 'image_url_3'),
    choice:        _idx(map, 'choice'),
    img_choice:    _idx(map, 'img_choice'),
    final_img:     _idx(map, 'final_img'),
    final_content: _idx(map, 'final_content'),
    post_schedule: _idx(map, 'post_schedule'),
    additional_img: _idx(map, 'additional_img')
  };

  if (c.status === -1) {
    return { rows: [], msg: 'Missing header: status' };
  }

  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = [];

  for (var i = 0; i < vals.length; i++) {
    const r = vals[i];
    const statusCell = _norm(r[c.status]);

    if (statusCell === 'generated') {
      rows.push({
        rowIndex:      i + 2,
        id:            c.id > -1 ? r[c.id] : '',
        Type:          c.type > -1 ? r[c.type] : '',
        variant_1:     c.v1 > -1 ? r[c.v1] : '',
        variant_2:     c.v2 > -1 ? r[c.v2] : '',
        variant_3:     c.v3 > -1 ? r[c.v3] : '',
        image_url_1:   c.img1 > -1 ? r[c.img1] : '',
        image_url_2:   c.img2 > -1 ? r[c.img2] : '',
        image_url_3:   c.img3 > -1 ? r[c.img3] : '',
        choice:        c.choice > -1 ? r[c.choice] : '',
        img_choice:    c.img_choice > -1 ? r[c.img_choice] : '',
        final_img:     c.final_img > -1 ? r[c.final_img] : '',
        final_content: c.final_content > -1 ? r[c.final_content] : '',
        post_schedule: c.post_schedule > -1 ? 
          (r[c.post_schedule] instanceof Date ? 
            r[c.post_schedule].toISOString().slice(0, 16).replace('T', ' ') : 
            (r[c.post_schedule] || '')
          ) : '',
        status:        'generated',
        status_raw:    r[c.status],
        additional_img: c.additional_img > -1 ? r[c.additional_img] : ''
      });
    }
  }

  return {
    rows,
    msg: rows.length ? '' : 'No items pending in "generated".'
  };
}

// ============================================================
// APPROVE WORKFLOW - User approves post with choices
// ============================================================

/**
 * Updates a post with user's variant/image choices, schedule, and finalizes content.
 * 
 * This is the main approval function. When a user approves a post, this function:
 * 1. Saves the selected variant number (1, 2, or 3)
 * 2. Saves the selected image indices (comma-separated, e.g., "1,2")
 * 3. Saves the scheduled date/time
 * 4. Copies the selected variant text to final_content column
 * 5. Copies the selected image URLs to final_img column
 * 6. Updates status to "Approved"
 * 
 * Uses locking to prevent concurrent modifications.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {string} choice - Selected variant number ("1", "2", or "3")
 * @param {string} imgChoice - Selected image indices (comma-separated, e.g., "1,2" or "1,2,3")
 * @param {string} scheduleVal - Scheduled date/time string (format: "YYYY-MM-DD HH:MM")
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with ok: true and status: "Approved"
 * @throws {Error} If status column is missing
 * 
 * @example
 * updateChoices(5, "2", "1,3", "2024-01-15 14:30", "Automated Content");
 * // Approves row 5 with variant 2, images 1 and 3, scheduled for Jan 15 at 2:30 PM
 */
function updateChoices(rowIndex, choice, imgChoice, scheduleVal, sheetName) {
  const sh = _getSheetByName(sheetName);
  const { headers, map } = _getHeaderMap(sh);
  
  // Map all column indices we'll need
  const idx = {
    choice:        _idx(map, 'choice'),
    img_choice:    _idx(map, 'img_choice'),
    status:        _idx(map, 'status'),
    post_schedule: _idx(map, 'post_schedule'),
    v1:            _idx(map, 'variant_1'),
    v2:            _idx(map, 'variant_2'),
    v3:            _idx(map, 'variant_3'),
    img1:          _idx(map, 'image_url_1'),
    img2:          _idx(map, 'image_url_2'),
    img3:          _idx(map, 'image_url_3'),
    final_content: _idx(map, 'final_content'),
    final_img:     _idx(map, 'final_img'),
    final_post:    _idx(map, 'final_post')
  };
  
  if (idx.status === -1) {
    throw new Error('Missing header: status');
  }

  // Acquire lock to prevent concurrent modifications
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);  // Wait up to 30 seconds for lock

  try {
    // Step 1: Save basic choices and schedule
    if (idx.choice > -1) {
      sh.getRange(rowIndex, idx.choice + 1).setValue(choice || '');
    }
    if (idx.img_choice > -1) {
      sh.getRange(rowIndex, idx.img_choice + 1).setValue(imgChoice || '');
    }
    if (idx.post_schedule > -1) {
      sh.getRange(rowIndex, idx.post_schedule + 1).setValue(scheduleVal || '');
    }

    // Step 2: Copy selected variant text to final_content
    if (choice && idx.final_content > -1) {
      const choiceNum = parseInt(choice, 10);
      let selectedVariant = '';

      // Get the text from the selected variant column
      if (choiceNum === 1 && idx.v1 > -1) {
        selectedVariant = sh.getRange(rowIndex, idx.v1 + 1).getValue();
      } else if (choiceNum === 2 && idx.v2 > -1) {
        selectedVariant = sh.getRange(rowIndex, idx.v2 + 1).getValue();
      } else if (choiceNum === 3 && idx.v3 > -1) {
        selectedVariant = sh.getRange(rowIndex, idx.v3 + 1).getValue();
      }

      sh.getRange(rowIndex, idx.final_content + 1).setValue(selectedVariant || '');
    }

    // Step 3: Copy selected image URLs to final_img
    // Note: If imgChoice is empty (custom upload case), final_img was already
    // set by saveAdditionalImages(), so we leave it as-is.
    if (imgChoice && idx.final_img > -1) {
      // Parse comma-separated image indices (e.g., "1,2" or "1,2,3")
      const selectedIndices = String(imgChoice)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const imageUrls = [];

      // Map each index to its corresponding image URL
      selectedIndices.forEach(function (indexStr) {
        const index = parseInt(indexStr, 10);
        let url = '';

        if (index === 1 && idx.img1 > -1) {
          url = sh.getRange(rowIndex, idx.img1 + 1).getValue();
        } else if (index === 2 && idx.img2 > -1) {
          url = sh.getRange(rowIndex, idx.img2 + 1).getValue();
        } else if (index === 3 && idx.img3 > -1) {
          url = sh.getRange(rowIndex, idx.img3 + 1).getValue();
        }

        if (url) imageUrls.push(String(url).trim());
      });

      // Join URLs with comma and space
      sh.getRange(rowIndex, idx.final_img + 1).setValue(imageUrls.join(', '));
    }

    // Step 4: Update final_post column (optional - combines content + images)
    if (idx.final_post > -1) {
      const finalContent = idx.final_content > -1
        ? sh.getRange(rowIndex, idx.final_content + 1).getValue()
        : '';
      const finalImg = idx.final_img > -1
        ? sh.getRange(rowIndex, idx.final_img + 1).getValue()
        : '';

      let finalPost = String(finalContent || '').trim();
      if (finalImg) {
        finalPost += '\n\nImages:\n' + finalImg;
      }

      sh.getRange(rowIndex, idx.final_post + 1).setValue(finalPost);
    }

    // Step 5: Update status to "Approved"
    sh.getRange(rowIndex, idx.status + 1).setValue('Approved');
  } finally {
    lock.releaseLock();  // Always release lock, even if error occurs
  }

  return { ok: true, status: 'Approved' };
}

// ============================================================
// EDIT VARIANT - User edits variant text inline
// ============================================================

/**
 * Updates a single variant's text content in the sheet.
 * 
 * Allows users to edit variant text directly from the UI.
 * The edited text is saved back to the sheet immediately.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {number|string} variantNumber - Variant number (1, 2, or 3)
 * @param {string} newText - New text content for the variant
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with ok: true
 * @throws {Error} If variantNumber is invalid or column is missing
 * 
 * @example
 * updateVariant(5, 2, "New variant text here", "Automated Content");
 * // Updates variant_2 column in row 5
 */
function updateVariant(rowIndex, variantNumber, newText, sheetName) {
  const n = Number(variantNumber);
  
  // Validate variant number
  if (![1, 2, 3].includes(n)) {
    throw new Error('variantNumber must be 1, 2 or 3');
  }
  
  const sh = _getSheetByName(sheetName);
  const { headers, map } = _getHeaderMap(sh);
  const colIdx = _idx(map, 'variant_' + n);
  
  if (colIdx === -1) {
    throw new Error('Missing column: variant_' + n);
  }
  
  // Acquire lock for thread safety
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try { 
    sh.getRange(rowIndex, colIdx + 1).setValue(newText || ''); 
  } finally { 
    lock.releaseLock(); 
  }
  
  return { ok: true };
}

// ============================================================
// STATUS UPDATES - Change row status
// ============================================================

/**
 * Generic function to update the status column for a row.
 * 
 * This is a flexible status update function that can set any status value.
 * Used for various status transitions throughout the workflow.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {string} newStatus - New status value (e.g., "generated", "approved", "rejected")
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with ok: true and status: newStatus
 * @throws {Error} If status column is missing
 * 
 * @example
 * updateStatus(5, "generated", "Automated Content");
 * // Sets status column in row 5 to "generated"
 */
function updateStatus(rowIndex, newStatus, sheetName) {
  const sh = _getSheetByName(sheetName || SHEET_NAME);
  const { map } = _getHeaderMap(sh);
  const cStatus = _idx(map, 'status');
  
  if (cStatus === -1) {
    throw new Error('Missing header: status');
  }
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try { 
    sh.getRange(rowIndex, cStatus + 1).setValue(String(newStatus || '').trim()); 
  } finally { 
    lock.releaseLock(); 
  }
  
  return { ok: true, status: newStatus };
}

/**
 * Marks a post as Rejected and saves user's last selections.
 * 
 * When a user rejects a post, this function:
 * 1. Saves the variant choice (if provided)
 * 2. Saves the image choice (if provided)
 * 3. Sets status to "Rejected"
 * 
 * This allows users to see what they were considering before rejecting.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {string|undefined} choice - Selected variant number (optional)
 * @param {string|undefined} imgChoice - Selected image indices (optional)
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with ok: true and status: "Rejected"
 * @throws {Error} If status column is missing
 * 
 * @example
 * rejectPost(5, "2", "1,3", "Automated Content");
 * // Rejects row 5, saving variant 2 and images 1,3 as the last selections
 */
function rejectPost(rowIndex, choice, imgChoice, sheetName) {
  const sh = _getSheetByName(sheetName);
  const { map } = _getHeaderMap(sh);
  
  const idx = {
    choice:     _idx(map, 'choice'),
    img_choice: _idx(map, 'img_choice'),
    status:     _idx(map, 'status')
  };
  
  if (idx.status === -1) {
    throw new Error('Missing header: status');
  }
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    // Save choices if provided (allows user to see what they were considering)
    if (idx.choice !== -1 && typeof choice !== 'undefined') {
      sh.getRange(rowIndex, idx.choice + 1).setValue(choice || '');
    }
    if (idx.img_choice !== -1 && typeof imgChoice !== 'undefined') {
      sh.getRange(rowIndex, idx.img_choice + 1).setValue(imgChoice || '');
    }
    
    // Set status to Rejected
    sh.getRange(rowIndex, idx.status + 1).setValue('Rejected');
  } finally { 
    lock.releaseLock(); 
  }
  
  return { ok: true, status: 'Rejected' };
}

// ============================================================
// QUEUE GENERATOR - Automatically queue next batch
// ============================================================

/**
 * Queues the next batch of posts for content generation.
 * 
 * This function implements an intelligent queuing system:
 * 
 * Rules:
 * - Never touches rows where status is "Approved" or "Generated"
 * - Counts existing "Queue" rows (with non-empty id)
 *   - If there are already 10 or more, does nothing
 * - Otherwise, queues rows in priority order:
 *   1. First: rows with status "Rejected" or "Posted" (reuse existing content)
 *   2. Then: any other rows (blank or other statuses)
 *      EXCEPT: Approved, Generated, Queue
 *   - Continues until total Queue count reaches 10
 * 
 * Uses locking to prevent race conditions when multiple users trigger simultaneously.
 * 
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with:
 *   - queued: Number of rows queued (0 if none or already at capacity)
 *   - reset: Always false (legacy parameter)
 * 
 * @example
 * const result = queueNextTen();
 * if (result.queued > 0) {
 *   console.log('Queued ' + result.queued + ' posts');
 * }
 */
function queueNextTen(sheetName) {
  const sh = _getSheetByName(sheetName || SHEET_NAME);
  const lastRow = sh.getLastRow();
  
  if (lastRow < 2) {
    return { queued: 0, reset: false };
  }

  const { map } = _getHeaderMap(sh);
  const cId = _idx(map, 'id');
  const cStatus = _idx(map, 'status');

  if (cId === -1 || cStatus === -1) {
    throw new Error('Missing id or status header');
  }

  // Read all data rows
  const body = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  // Step 1: Count existing Queue rows
  let existingQueue = 0;
  body.forEach(r => {
    const id = String(cId > -1 ? r[cId] : '').trim();
    if (!id) return;  // Skip rows without ID

    const st = _norm(cStatus > -1 ? r[cStatus] : '');
    if (st === 'queue') existingQueue++;
  });

  // If already at capacity (10+), do nothing
  if (existingQueue >= 10) {
    return { queued: 0, reset: false };
  }

  // Calculate how many more we need to queue
  let capacity = 10 - existingQueue;
  const pick = [];

  /**
   * Helper function to add a row to the queue if capacity allows.
   * 
   * @param {Array} r - Row data array
   * @param {number} i - Row index (0-based, relative to data start)
   * @returns {boolean} True if row was added, false otherwise
   */
  function tryPickRow(r, i) {
    if (capacity <= 0) return false;

    const id = String(cId > -1 ? r[cId] : '').trim();
    if (!id) return false;  // Skip rows without ID

    const st = _norm(cStatus > -1 ? r[cStatus] : '');

    // Never touch Approved or Generated rows
    if (st === 'approved' || st === 'generated') return false;

    // Skip rows already picked in this run
    const rowIndex = i + 2;  // Convert to 1-based, account for header
    const alreadyPicked = pick.some(p => p.rowIndex === rowIndex);
    if (alreadyPicked) return false;

    pick.push({ rowIndex });
    capacity--;
    return true;
  }

  // Step 2: Phase 1 - Queue Rejected and Posted rows first (priority)
  body.forEach((r, i) => {
    if (capacity <= 0) return;

    const st = _norm(cStatus > -1 ? r[cStatus] : '');
    if (st === 'rejected' || st === 'posted') {
      tryPickRow(r, i);
    }
  });

  // Step 3: Phase 2 - Queue any other allowed rows
  if (capacity > 0) {
    body.forEach((r, i) => {
      if (capacity <= 0) return;

      const st = _norm(cStatus > -1 ? r[cStatus] : '');

      // Skip statuses we should not change
      if (st === 'approved' || st === 'generated' || st === 'Queue') return;

      // tryPickRow protects from duplicates anyway
      tryPickRow(r, i);
    });
  }

  // If no rows to queue, return early
  if (!pick.length) {
    return { queued: 0, reset: false };
  }

  // Step 4: Write "Queue" status for all picked rows
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    pick.forEach(p => {
      sh.getRange(p.rowIndex, cStatus + 1).setValue('Queue');
    });
  } finally {
    lock.releaseLock();
  }

  return { queued: pick.length, reset: false };
}

/**
 * Triggers the n8n webhook to start content generation.
 * 
 * This function sends a POST request to the configured n8n webhook URL.
 * The webhook receives the sheet name in the request body and processes
 * all rows with status "Queue" to generate content variants.
 * 
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with:
 *   - ok: Boolean indicating success (HTTP 200-299)
 *   - statusCode: HTTP response code
 *   - body: Response body text
 * 
 * @example
 * const result = triggerN8NWebhook();
 * if (result.ok) {
 *   console.log('Webhook triggered successfully');
 * } else {
 *   console.error('Webhook failed:', result.statusCode);
 * }
 */
function triggerN8NWebhook(sheetName) {
  const name = sheetName || SHEET_NAME;
  
  // Use single webhook URL (no mapping needed for single-user app)
  const url = N8N_WEBHOOK_URL;

  // Send POST request to webhook
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ sheet: name }),  // Send sheet name in body
    muteHttpExceptions: true  // Don't throw on HTTP errors
  });

  var code = resp.getResponseCode();
  return {
    ok: code >= 200 && code < 300,  // Success if 2xx status code
    statusCode: code,
    body: resp.getContentText()
  };
}

// ============================================================
// CALENDAR & TIMELINE - View approved scheduled posts
// ============================================================

/**
 * Gets all rows with a specific status from the sheet.
 * 
 * This function is used by Calendar and Timeline tabs to fetch posts
 * filtered by status (typically "Approved" or "Rejected").
 * 
 * Returns structured data including final_img and final_content columns
 * for display in the calendar/list views.
 * 
 * @param {string} statusWant - Status value to filter by (e.g., "Approved", "Rejected")
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with rows array containing matching posts
 * 
 * @example
 * const approved = getRowsByStatus('Approved');
 * const rejected = getRowsByStatus('Rejected', 'Other Sheet');
 */
function getRowsByStatus(statusWant, sheetName) {
  const want = _norm(statusWant);  // Normalize status for comparison

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(sheetName || SHEET_NAME);
  
  if (!sh) {
    return { rows: [] };
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  
  if (lastRow < 2) {
    return { rows: [] };
  }

  const { map } = _getHeaderMap(sh);
  
  // Map column indices
  const c = {
    id:           _idx(map, 'id'),
    type:         _idx(map, 'type'),
    status:       _idx(map, 'status'),
    v1:           _idx(map, 'variant_1'),
    v2:           _idx(map, 'variant_2'),
    v3:           _idx(map, 'variant_3'),
    img1:         _idx(map, 'image_url_1'),
    img2:         _idx(map, 'image_url_2'),
    img3:         _idx(map, 'image_url_3'),
    post_schedule: _idx(map, 'post_schedule'),
    final_img:    _idx(map, 'final_img'),
    final_content: _idx(map, 'final_content')
  };
  
  if (c.status === -1) {
    return { rows: [] };
  }

  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = [];
  
  // Filter rows by status
  for (var i = 0; i < vals.length; i++) {
    const r = vals[i];
    if (_norm(r[c.status]) !== want) continue;  // Skip if status doesn't match
    
    rows.push({
      rowIndex:     i + 2,
      id:           c.id > -1 ? r[c.id] : '',
      Type:         c.type > -1 ? r[c.type] : '',
      variant_1:    c.v1 > -1 ? r[c.v1] : '',
      variant_2:    c.v2 > -1 ? r[c.v2] : '',
      variant_3:    c.v3 > -1 ? r[c.v3] : '',
      image_url_1:  c.img1 > -1 ? r[c.img1] : '',
      image_url_2:  c.img2 > -1 ? r[c.img2] : '',
      image_url_3:  c.img3 > -1 ? r[c.img3] : '',
      post_schedule: c.post_schedule > -1 ? _asISO(r[c.post_schedule]) : '',
      final_img:    c.final_img > -1 ? r[c.final_img] : '',
      final_content: c.final_content > -1 ? r[c.final_content] : ''
    });
  }
  
  return { rows };
}

/**
 * Gets approved posts scheduled within a specific date range.
 * 
 * This function is used by the Calendar tab to display posts scheduled
 * for a particular month. It filters by:
 * 1. Status = "Approved"
 * 2. post_schedule date falls within the start/end range
 * 
 * @param {string} startIso - Start date in ISO format (e.g., "2024-01-01T00:00:00.000Z")
 * @param {string} endIso - End date in ISO format (e.g., "2024-01-31T23:59:59.999Z")
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with rows array containing scheduled approved posts
 * 
 * @example
 * const start = new Date(2024, 0, 1).toISOString();  // Jan 1, 2024
 * const end = new Date(2024, 0, 31, 23, 59, 59).toISOString();  // Jan 31, 2024
 * const posts = getApprovedCalendar(start, end);
 */
function getApprovedCalendar(startIso, endIso, sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(sheetName || SHEET_NAME);
  
  if (!sh) {
    return { rows: [] };
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  
  if (lastRow < 2) {
    return { rows: [] };
  }

  const { map } = _getHeaderMap(sh);
  
  const c = {
    id:           _idx(map, 'id'),
    type:         _idx(map, 'type'),
    status:       _idx(map, 'status'),
    post_schedule: _idx(map, 'post_schedule'),
    final_img:    _idx(map, 'final_img'),
    final_content: _idx(map, 'final_content')
  };
  
  // Validate required columns exist
  if (c.status === -1 || c.post_schedule === -1) {
    return { rows: [] };
  }

  // Parse date range
  const start = new Date(startIso);
  const end = new Date(endIso);
  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = [];
  
  // Filter by status and date range
  for (var i = 0; i < vals.length; i++) {
    const r = vals[i];
    
    // Only include approved posts
    if (_norm(r[c.status]) !== 'approved') continue;

    // Parse and validate schedule date
    var whenISO = _asISO(r[c.post_schedule]);
    if (!whenISO) continue;
    
    var when = new Date(whenISO);
    if (isNaN(when.getTime())) continue;
    
    // Check if date falls within range
    if (when < start || when > end) continue;

    rows.push({
      row_index:    i + 2,
      id:           c.id > -1 ? r[c.id] : '',
      Type:         c.type > -1 ? r[c.type] : '',
      post_schedule: when.toISOString(),
      final_img:    c.final_img > -1 ? r[c.final_img] : '',
      final_content: c.final_content > -1 ? r[c.final_content] : ''
    });
  }
  
  return { rows };
}

/**
 * Updates the post_schedule date/time for a specific row.
 * 
 * This function is used when rescheduling posts in the Calendar tab.
 * It validates the date format and sets both the value and display format.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {string} iso - ISO format date string (e.g., "2024-01-15T14:30:00.000Z")
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with ok: true
 * @throws {Error} If post_schedule column is missing or date is invalid
 * 
 * @example
 * updatePostScheduleByRow(5, "2024-01-15T14:30:00.000Z");
 * // Reschedules row 5 to January 15, 2024 at 2:30 PM
 */
function updatePostScheduleByRow(rowIndex, iso, sheetName) {
  const sh = _getSheetByName(sheetName || SHEET_NAME);
  const { map } = _getHeaderMap(sh);
  const c = _idx(map, 'post_schedule');

  if (c === -1) {
    throw new Error('Missing header: post_schedule');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // Parse and validate date
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      throw new Error('Invalid date: ' + iso);
    }

    const cell = sh.getRange(rowIndex, c + 1);

    // Store as Date object (Google Sheets will handle timezone conversion)
    cell.setValue(d);

    // Set display format: "yyyy-mm-dd hh:mm AM/PM"
    cell.setNumberFormat("yyyy-mm-dd hh:mm AM/PM");
  } finally {
    lock.releaseLock();
  }

  return { ok: true };
}

/**
 * Rejects an approved post and clears scheduling data.
 * 
 * This function is used when rejecting posts from the Calendar or Timeline views.
 * It:
 * 1. Sets status to "Rejected"
 * 2. Clears the post_schedule date
 * 3. Clears final_img
 * 4. Clears final_content
 * 
 * This effectively "un-approves" a post and removes it from scheduled views.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with ok: true and status: "Rejected"
 * @throws {Error} If status column is missing
 * 
 * @example
 * rejectAndClearByRow(5);
 * // Rejects row 5 and clears all scheduling/final data
 */
function rejectAndClearByRow(rowIndex, sheetName) {
  const sh = _getSheetByName(sheetName || SHEET_NAME);
  const { map } = _getHeaderMap(sh);

  const cStatus = _idx(map, 'status');
  const cSched = _idx(map, 'post_schedule');
  const cFImg = _idx(map, 'final_img');
  const cFText = _idx(map, 'final_content');

  if (cStatus === -1) {
    throw new Error('Missing header: status');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    // Set status to Rejected
    sh.getRange(rowIndex, cStatus + 1).setValue('Rejected');
    
    // Clear scheduling and final data
    if (cSched > -1) {
      sh.getRange(rowIndex, cSched + 1).clearContent();
    }
    if (cFImg > -1) {
      sh.getRange(rowIndex, cFImg + 1).clearContent();
    }
    if (cFText > -1) {
      sh.getRange(rowIndex, cFText + 1).clearContent();
    }
  } finally {
    lock.releaseLock();
  }

  return { ok: true, status: 'Rejected' };
}

// ============================================================
// IMAGE UPLOAD - DigitalOcean Spaces Integration
// ============================================================

/**
 * Converts a byte array to hexadecimal string representation.
 * 
 * Used for AWS4 signature generation. Handles negative byte values
 * by converting them to unsigned (0-255 range).
 * 
 * @param {Array<number>} bytes - Array of byte values (-128 to 127)
 * @returns {string} Hexadecimal string (e.g., "a1b2c3d4")
 * 
 * @private
 */
function _toHex(bytes) {
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b);  // Convert signed to unsigned
    return ('0' + v.toString(16)).slice(-2);  // Pad to 2 digits
  }).join('');
}

/**
 * Computes SHA-256 hash of byte array and returns as hex string.
 * 
 * Used for AWS4 signature generation. Computes the hash of the
 * canonical request and payload.
 * 
 * @param {Array<number>} bytes - Byte array to hash
 * @returns {string} SHA-256 hash as hexadecimal string
 * 
 * @private
 */
function _sha256Hex(bytes) {
  return _toHex(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
  );
}

/**
 * Computes HMAC-SHA256 signature.
 * 
 * Used for AWS4 signature generation. Handles both byte arrays
 * and strings as input, converting strings to bytes as needed.
 * 
 * @param {Array<number>|string} key - HMAC key (bytes or string)
 * @param {Array<number>|string} msg - Message to sign (bytes or string)
 * @returns {Array<number>} HMAC signature as byte array
 * 
 * @private
 */
function _hmacSha256(key, msg) {
  // Convert to byte arrays if needed
  var keyBytes = Array.isArray(key)
    ? key
    : Utilities.newBlob(String(key)).getBytes();
  var msgBytes = Array.isArray(msg)
    ? msg
    : Utilities.newBlob(String(msg)).getBytes();

  return Utilities.computeHmacSha256Signature(msgBytes, keyBytes);
}

/**
 * Generates AWS4 signing key for DigitalOcean Spaces.
 * 
 * AWS4 signature requires a derived signing key computed from:
 * - Secret key
 * - Date stamp (YYYYMMDD)
 * - Region (e.g., "blr1")
 * - Service name ("s3")
 * 
 * This implements the AWS4 key derivation algorithm.
 * 
 * @param {string} secret - AWS/Spaces secret key
 * @param {string} dateStamp - Date in YYYYMMDD format
 * @param {string} region - Region identifier (e.g., "blr1")
 * @param {string} service - Service name (always "s3" for Spaces)
 * @returns {Array<number>} Signing key as byte array
 * 
 * @private
 */
function _aws4SigningKey(secret, dateStamp, region, service) {
  var kDate = _hmacSha256('AWS4' + secret, dateStamp);
  var kRegion = _hmacSha256(kDate, region);
  var kService = _hmacSha256(kRegion, service);
  var kSign = _hmacSha256(kService, 'aws4_request');
  return kSign;
}

/**
 * Uploads a single file to DigitalOcean Spaces using AWS4 signature authentication.
 * 
 * This function implements the AWS S3 API (which Spaces is compatible with)
 * to upload files directly to DigitalOcean Spaces. It:
 * 1. Generates AWS4 signature for authentication
 * 2. Uploads file to the 'images/' folder
 * 3. Sets file as publicly readable
 * 4. Returns the public URL
 * 
 * Files are named with timestamp prefix to avoid collisions:
 * images/[timestamp]-[filename]
 * 
 * @param {Object} file - File object with properties:
 *   - name: Original filename
 *   - type: MIME type (e.g., "image/png")
 *   - data: Base64-encoded file content
 * @returns {string} Public URL of uploaded file
 * @throws {Error} If Spaces credentials are not configured or upload fails
 * 
 * @private
 * 
 * @example
 * const file = {
 *   name: "photo.png",
 *   type: "image/png",
 *   data: "iVBORw0KGgoAAAANS..." // base64 string
 * };
 * const url = _uploadToSpaces(file);
 * // Returns: "https://daniel.projectpartners.ae/images/1234567890-photo.png"
 */
function _uploadToSpaces(file) {
  // Validate credentials are configured
  if (!SPACES_KEY || !SPACES_SECRET) {
    throw new Error('Spaces credentials not configured');
  }

  // Generate AWS4 signature components
  var now = new Date();
  var amzdate = Utilities.formatDate(now, 'GMT', "yyyyMMdd'T'HHmmss'Z'");
  var datestamp = Utilities.formatDate(now, 'GMT', 'yyyyMMdd');

  var host = SPACES_NAME + '.' + SPACES_REGION + '.digitaloceanspaces.com';

  // Generate safe filename (remove special characters)
  var safeName = String(file.name || 'upload').replace(/[^\w\.\-]/g, '_');
  var key = 'images/' + now.getTime() + '-' + safeName;

  var contentType = file.type || 'application/octet-stream';
  var payloadBytes = Utilities.base64Decode(file.data);  // Decode base64 to bytes
  var payloadHash = _sha256Hex(payloadBytes);

  // Build canonical request for AWS4 signature
  var canonicalUri = '/' + key;
  var canonicalQuery = '';

  // Canonical headers (must include x-amz-acl for public-read)
  var canonicalHeaders =
    'host:' + host + '\n' +
    'x-amz-acl:public-read\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzdate + '\n';

  var signedHeaders = 'host;x-amz-acl;x-amz-content-sha256;x-amz-date';

  var canonicalRequest =
    'PUT\n' +
    canonicalUri + '\n' +
    canonicalQuery + '\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;

  // Build string to sign
  var algorithm = 'AWS4-HMAC-SHA256';
  var credentialScope = datestamp + '/' + SPACES_REGION + '/s3/aws4_request';
  var stringToSign =
    algorithm + '\n' +
    amzdate + '\n' +
    credentialScope + '\n' +
    _sha256Hex(Utilities.newBlob(canonicalRequest).getBytes());

  // Generate signature
  var signingKey = _aws4SigningKey(SPACES_SECRET, datestamp, SPACES_REGION, 's3');
  var signature = _toHex(_hmacSha256(signingKey, stringToSign));

  // Build authorization header
  var authorization =
    algorithm + ' ' +
    'Credential=' + SPACES_KEY + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;

  var url = 'https://' + host + canonicalUri;

  // Upload file via PUT request
  var resp = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: contentType,
    payload: payloadBytes,
    muteHttpExceptions: true,
    headers: {
      'x-amz-acl': 'public-read',  // Make file publicly readable
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzdate,
      'Authorization': authorization
    }
  });

  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Spaces upload failed: ' + code + ' ' + resp.getContentText());
  }

  // Return public URL (using custom domain if CNAME'd to Space)
  return 'https://daniel.projectpartners.ae/' + key;
}

/**
 * Uploads multiple images to DigitalOcean Spaces and saves URLs to sheet.
 * 
 * This function is called when users upload custom images for a post.
 * It:
 * 1. Uploads all files to Spaces
 * 2. Collects the public URLs
 * 3. Saves URLs to additional_img column
 * 4. Copies URLs to final_img column
 * 5. Clears img_choice (since custom images override generated images)
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {Array<Object>} files - Array of file objects, each with:
 *   - name: Filename
 *   - type: MIME type
 *   - data: Base64-encoded content
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with:
 *   - ok: Boolean indicating success
 *   - urls: Array of uploaded file URLs (if successful)
 *   - message: Error message (if failed)
 * @throws {Error} If additional_img column is missing
 * 
 * @example
 * const files = [
 *   {name: "img1.png", type: "image/png", data: "base64..."},
 *   {name: "img2.jpg", type: "image/jpeg", data: "base64..."}
 * ];
 * const result = saveAdditionalImages(5, files);
 * if (result.ok) {
 *   console.log('Uploaded:', result.urls);
 * }
 */
function saveAdditionalImages(rowIndex, files, sheetName) {
  // Validate files array
  if (!files || !files.length) {
    return { ok: false, message: 'No files received' };
  }

  // Get sheet (use provided name or default)
  var sh = (typeof _getSheetByName === 'function' && sheetName)
    ? _getSheetByName(sheetName)
    : _getSheet();

  var header = _getHeaderMap(sh);
  var map = header.map;

  var cAdd = _idx(map, 'additional_img');
  var cFinalImg = _idx(map, 'final_img');
  var cImgChoice = _idx(map, 'img_choice');

  if (cAdd === -1) {
    throw new Error('Missing column: additional_img');
  }

  // Step 1: Upload all files and collect URLs
  var urls = [];
  files.forEach(function (f) {
    var url = _uploadToSpaces(f);
    if (url) urls.push(url);
  });

  if (!urls.length) {
    return { ok: false, message: 'Upload failed' };
  }

  // Join URLs with comma and space
  var joined = urls.join(', ');

  // Step 2: Save URLs to sheet
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    // Save to additional_img column
    sh.getRange(rowIndex, cAdd + 1).setValue(joined);
    
    // Copy to final_img column (for immediate use)
    if (cFinalImg > -1) {
      sh.getRange(rowIndex, cFinalImg + 1).setValue(joined);
    }
    
    // Clear img_choice (custom images override generated images)
    if (cImgChoice > -1) {
      sh.getRange(rowIndex, cImgChoice + 1).clearContent();
    }
  } finally {
    lock.releaseLock();
  }

  return { ok: true, urls: urls };
}

/**
 * Checks if content generation is currently in progress.
 * 
 * This function checks if there are any rows with status "Queue",
 * which indicates that n8n is currently processing content generation.
 * 
 * Used by the UI to show/hide loading indicators and prevent duplicate
 * generation requests.
 * 
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with running: boolean
 * 
 * @example
 * const status = isGenerationInProgress();
 * if (status.running) {
 *   console.log('Generation is in progress');
 * }
 */
function isGenerationInProgress(sheetName) {
  var sh = _getSheetByName(sheetName || SHEET_NAME);
  var lastRow = sh.getLastRow();
  
  if (lastRow < 2) {
    return { running: false };
  }

  var header = _getHeaderMap(sh);
  var map = header.map;
  var cStatus = _idx(map, 'status');
  var cId = _idx(map, 'id');

  if (cStatus === -1 || cId === -1) {
    return { running: false };
  }

  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var running = false;

  // Check if any row has status "Queue"
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var id = String(cId > -1 ? r[cId] : '').trim();
    if (!id) continue;  // Skip rows without ID

    var st = _norm(r[cStatus]);
    if (st === 'queue') {
      running = true;
      break;  // Found one, no need to continue
    }
  }

  return { running: running };
}

/**
 * Checks if there are any rows with status "generated" in the sheet.
 * 
 * This function is used to determine whether the "Generate Content" button
 * should be shown. If there are no "generated" rows, it means generation
 * hasn't been completed yet, so we should not allow generating more.
 * 
 * @param {string|undefined} sheetName - Optional sheet name (defaults to SHEET_NAME)
 * @returns {Object} Object with hasGenerated: boolean
 * 
 * @example
 * const result = hasGeneratedContent();
 * if (!result.hasGenerated) {
 *   // Don't show generate button, show "come back" message
 * }
 */
function hasGeneratedContent(sheetName) {
  var sh = _getSheetByName(sheetName || SHEET_NAME);
  var lastRow = sh.getLastRow();
  
  if (lastRow < 2) {
    return { hasGenerated: false };
  }

  var header = _getHeaderMap(sh);
  var map = header.map;
  var cStatus = _idx(map, 'status');

  if (cStatus === -1) {
    return { hasGenerated: false };
  }

  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var hasGenerated = false;

  // Check if any row has status "generated"
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var st = _norm(r[cStatus]);
    if (st === 'generated') {
      hasGenerated = true;
      break;  // Found one, no need to continue
    }
  }

  return { hasGenerated: hasGenerated };
}

