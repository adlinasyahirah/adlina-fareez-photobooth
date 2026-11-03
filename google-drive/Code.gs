// Paste this file into a new Apps Script project owned by the bride.
// Set UPLOAD_SECRET in Project Settings → Script properties (at least 32 characters).
const FOLDER_ID = '1-6fIRYcKmRnlqRhqp4r7BK9tYCOOGDI3';
const MAX_PNG_BYTES = 3 * 1024 * 1024;
const MAX_UPLOADS_PER_DAY = 1000;

function authorizeFolder() {
  // Run once from the editor to authorize access and verify the destination.
  console.log('Destination: ' + DriveApp.getFolderById(FOLDER_ID).getName());
}

function doPost(e) {
  const json = value => ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  const properties = PropertiesService.getScriptProperties();
  const expectedSecret = properties.getProperty('UPLOAD_SECRET');
  let lock;
  try {
    if (!expectedSecret || expectedSecret.length < 32 || !e || !e.postData || e.postData.contents.length > 4200000) return json({ ok: false });
    const body = JSON.parse(e.postData.contents);
    if (typeof body.secret !== 'string' || body.secret !== expectedSecret) return json({ ok: false });
    if (!/^frame-[123]-[123]$/.test(body.frameId || '') || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.uploadId || '')) return json({ ok: false });
    if (typeof body.image !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image)) return json({ ok: false });
    const bytes = Utilities.base64Decode(body.image);
    const byteAt = i => bytes[i] & 255;
    if (bytes.length < 33 || bytes.length > MAX_PNG_BYTES || [137,80,78,71,13,10,26,10].some((value, i) => byteAt(i) !== value)) return json({ ok: false });
    const uint32 = start => byteAt(start) * 16777216 + byteAt(start + 1) * 65536 + byteAt(start + 2) * 256 + byteAt(start + 3);
    const sizes = { '1': [1080, 1350], '2': [1080, 1920], '3': [600, 1800] };
    const size = sizes[body.frameId.slice(-1)];
    if (uint32(16) !== size[0] || uint32(20) !== size[1]) return json({ ok: false });
    const fileName = 'adlina-fareez-2026-11-21-' + body.frameId + '-' + body.uploadId + '.png';
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json({ ok: false });
    const folder = DriveApp.getFolderById(FOLDER_ID);
    // The same upload ID is reused after a network error, so retries are idempotent.
    if (folder.getFilesByName(fileName).hasNext()) return json({ ok: true });
    const today = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
    const count = properties.getProperty('UPLOAD_DAY') === today ? Number(properties.getProperty('UPLOAD_COUNT') || 0) : 0;
    if (count >= MAX_UPLOADS_PER_DAY) return json({ ok: false });
    folder.createFile(Utilities.newBlob(bytes, 'image/png', fileName));
    properties.setProperties({ UPLOAD_DAY: today, UPLOAD_COUNT: String(count + 1) });
    // Folder sharing is controlled by its owner. This code does not publish files.
    return json({ ok: true });
  } catch (_) { return json({ ok: false }); }
  finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
