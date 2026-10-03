/* Files.gs - Drive uploads, downloads, thumbnails. Never deletes files. */

var KINDS = ['rooms', 'assets', 'documents', 'general'];
var ROOT_FOLDER = 'House Bible Files';
var BACKUP_FOLDER = 'House Bible Backups';

function folderProp_(key) { return 'FOLDER_' + key; }

function findOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* creates House Bible Files/{rooms,assets,documents,general} and House Bible Backups; stores ids */
function ensureFolders_() {
  var root = findOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER);
  props_().setProperty(folderProp_('root'), root.getId());
  KINDS.forEach(function (k) { props_().setProperty(folderProp_(k), findOrCreateFolder_(root, k).getId()); });
  var backups = findOrCreateFolder_(DriveApp.getRootFolder(), BACKUP_FOLDER);
  props_().setProperty(folderProp_('backups'), backups.getId());
}

function kindFolder_(kind) {
  var id = props_().getProperty(folderProp_(kind));
  if (!id) { ensureFolders_(); id = props_().getProperty(folderProp_(kind)); }
  return DriveApp.getFolderById(id);
}

/* a file is served only if it sits directly in one of our folders */
function isHbFile_(file) {
  var ok = {};
  ['root'].concat(KINDS).forEach(function (k) { var id = props_().getProperty(folderProp_(k)); if (id) ok[id] = true; });
  var parents = file.getParents();
  while (parents.hasNext()) if (ok[parents.next().getId()]) return true;
  return false;
}

function apiUpload_(req) {
  var kind = String(req.parentKind || '');
  if (KINDS.indexOf(kind) < 0) return err_('bad_request', 'parentKind must be one of ' + KINDS.join(', '));
  if (!req.dataBase64 || typeof req.dataBase64 !== 'string') return err_('bad_request', 'dataBase64 required');
  if (req.dataBase64.length * 0.75 > MAX_FILE_BYTES * 1.01) return err_('too_large', 'Max 20 MB per upload');
  var mime = String(req.mime || 'application/octet-stream');
  var name = safeFileName_(req.name);
  var bytes = Utilities.base64Decode(req.dataBase64);
  if (bytes.length > MAX_FILE_BYTES) return err_('too_large', 'Max 20 MB per upload');
  var file = kindFolder_(kind).createFile(Utilities.newBlob(bytes, mime, name));
  return { ok: true, fileId: file.getId(), name: file.getName(), mime: mime, size: bytes.length };
}

function getHbFile_(fileId) {
  var file;
  try { file = DriveApp.getFileById(String(fileId)); } catch (e) { return null; }
  return isHbFile_(file) ? file : null;
}

function apiFile_(req) {
  var file = getHbFile_(req.fileId);
  if (!file) return err_('not_found', 'No such file');
  if (file.getSize() > MAX_FILE_BYTES) return err_('too_large', 'File is over 20 MB');
  var blob = file.getBlob();
  return { ok: true, name: file.getName(), mime: blob.getContentType(), dataBase64: Utilities.base64Encode(blob.getBytes()) };
}

function apiThumb_(req) {
  var file = getHbFile_(req.fileId);
  if (!file) return err_('not_found', 'No such file');
  var mime = file.getMimeType(), thumb = null;
  try { thumb = file.getThumbnail(); } catch (e) { /* no thumbnail available */ }
  if (thumb) return { ok: true, mime: thumb.getContentType(), dataBase64: Utilities.base64Encode(thumb.getBytes()) };
  // image without a Drive thumbnail yet: send the original if it is small
  if (/^image\//.test(mime) && file.getSize() < 2 * 1024 * 1024) {
    return { ok: true, mime: mime, dataBase64: Utilities.base64Encode(file.getBlob().getBytes()) };
  }
  return { ok: true, mime: 'image/svg+xml', dataBase64: Utilities.base64Encode(Utilities.newBlob(guessMimeIcon_(mime)).getBytes()) };
}
