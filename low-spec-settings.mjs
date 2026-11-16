const SHARED_NAMESPACE = 'public-celeste-shared-v1';
const PRIVATE_SETTINGS_NAMESPACE = 'public-celeste-mauve-low-spec-settings-v1';
const SETTINGS_FILE = 'settings.celeste';
const ORIGINAL_GET_FILE = Symbol.for('a-faus.celeste-low-spec.original-get-file.v1');
const ORIGINAL_ENTRIES = Symbol.for('a-faus.celeste-low-spec.original-entries.v1');
const SETTINGS_ROUTE = Symbol.for('a-faus.celeste-low-spec.settings-route.v1');

const DEFAULT_SETTINGS = `<?xml version="1.0" encoding="utf-8"?>
<Settings xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Version>1.4.0.0</Version>
  <Fullscreen>false</Fullscreen>
  <WindowScale>3</WindowScale>
</Settings>`;

function setWindowScale(xml, scale) {
  const element = /<WindowScale\b[^>]*>[\s\S]*?<\/WindowScale>/i;
  const emptyElement = /<WindowScale\b[^>]*\/>/i;
  if (element.test(xml)) return xml.replace(element, `<WindowScale>${scale}</WindowScale>`);
  if (emptyElement.test(xml)) return xml.replace(emptyElement, `<WindowScale>${scale}</WindowScale>`);
  if (/<\/Settings\s*>/i.test(xml)) {
    return xml.replace(/<\/Settings\s*>/i, `  <WindowScale>${scale}</WindowScale>\n</Settings>`);
  }
  throw new Error('The saved Celeste video settings could not be read safely. The shared save file was left unchanged.');
}

async function readText(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    return file.size ? await file.text() : null;
  } catch (error) {
    if (error.name === 'NotFoundError') return null;
    throw error;
  }
}

async function writeText(fileHandle, text) {
  const writer = await fileHandle.createWritable();
  try { await writer.write(text); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
}

export async function installLowSpecSettings(origin, requestedScale) {
  const scale = Math.max(1, Math.min(4, Math.trunc(Number(requestedScale) || 3)));
  const shared = await origin.getDirectoryHandle(SHARED_NAMESPACE, {create:true});
  const saves = await shared.getDirectoryHandle('Saves', {create:true});
  const privateSettings = await origin.getDirectoryHandle(PRIVATE_SETTINGS_NAMESPACE, {create:true});
  const proto = FileSystemDirectoryHandle.prototype;

  if (proto[SETTINGS_ROUTE]) throw new Error('Low-spec settings routing was already installed in this tab.');
  const getFile = proto[ORIGINAL_GET_FILE] || proto.getFileHandle;
  const entries = proto[ORIGINAL_ENTRIES] || proto.entries;
  if (!proto[ORIGINAL_GET_FILE]) Object.defineProperty(proto, ORIGINAL_GET_FILE, {value:getFile});
  if (!proto[ORIGINAL_ENTRIES]) Object.defineProperty(proto, ORIGINAL_ENTRIES, {value:entries});

  const localHandle = await getFile.call(privateSettings, SETTINGS_FILE, {create:true});
  let xml = await readText(localHandle);
  if (!xml) {
    let sharedHandle;
    try { sharedHandle = await getFile.call(saves, SETTINGS_FILE); }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
    if (sharedHandle) xml = await readText(sharedHandle);
  }
  if (!xml) xml = DEFAULT_SETTINGS;
  const tuned = setWindowScale(xml, scale);
  if (tuned !== await readText(localHandle)) await writeText(localHandle, tuned);

  proto.getFileHandle = async function(name, options) {
    if (name === SETTINGS_FILE && await this.isSameEntry(saves)) return localHandle;
    return getFile.call(this, name, options);
  };
  proto.entries = async function*() {
    if (!await this.isSameEntry(saves)) {
      yield* entries.call(this);
      return;
    }
    let found = false;
    for await (const [name, handle] of entries.call(this)) {
      if (name === SETTINGS_FILE) {
        found = true;
        yield [name, localHandle];
      } else yield [name, handle];
    }
    if (!found) yield [SETTINGS_FILE, localHandle];
  };
  proto[Symbol.asyncIterator] = proto.entries;
  proto.values = async function*() { for await (const [, handle] of this.entries()) yield handle; };
  proto.keys = async function*() { for await (const [name] of this.entries()) yield name; };
  Object.defineProperty(proto, SETTINGS_ROUTE, {value:true});
}
