// Route each new launcher to a private mod overlay and the existing shared Saves folder.
// The source game's install folder is reused; its Mods archives are copied, never replaced.
export const SHARED_NAMESPACE = 'public-celeste-shared-v1';
export const SAVE_LOCK = 'public-celeste-shared-save-session-v1';

const ROUTES = {
  randomizer: {
    gameRoot: 'public-celeste-randomizer-v1',
    overlayRoot: 'public-celeste-randomizer-extra-variants-mods-v1',
    id: 'randomizer-extra-variants'
  },
  'spring-collab': {
    gameRoot: 'public-celeste-spring-collab-v1',
    overlayRoot: 'public-celeste-spring-collab-extra-variants-mods-v1',
    id: 'spring-collab-extra-variants'
  },
  mauve: {
    gameRoot: 'public-celeste-mauve-v1',
    overlayRoot: 'public-celeste-mauve-extra-variants-mods-v1',
    id: 'mauve-extra-variants'
  },
  'randomizer-extra-variants': {
    gameRoot: 'public-celeste-randomizer-v1',
    overlayRoot: 'public-celeste-randomizer-extra-variants-mods-v1',
    id: 'randomizer-extra-variants'
  },
  'spring-collab-extra-variants': {
    gameRoot: 'public-celeste-spring-collab-v1',
    overlayRoot: 'public-celeste-spring-collab-extra-variants-mods-v1',
    id: 'spring-collab-extra-variants'
  },
  'mauve-extra-variants': {
    gameRoot: 'public-celeste-mauve-v1',
    overlayRoot: 'public-celeste-mauve-extra-variants-mods-v1',
    id: 'mauve-extra-variants'
  }
};

const MIGRATION_MODES = ['vanilla', 'randomizer', 'spring-collab', 'mauve'];
const LOCK_MODES = [
  'vanilla', 'randomizer', 'spring-collab', 'mauve',
  'randomizer-extra-variants', 'spring-collab-extra-variants', 'mauve-extra-variants'
];
const ROUTING_MARKER = Symbol.for('a-faus.celeste-extra-variants.routing.v1');
const ORIGINAL_GET_DIRECTORY = Symbol.for('a-faus.celeste-extra-variants.original-get-directory.v1');
const ORIGINAL_ENTRIES = Symbol.for('a-faus.celeste-extra-variants.original-entries.v1');
const ROUTED_MODE = Symbol.for('a-faus.celeste-extra-variants.routed-mode.v1');
const ROUTED_MODS = Symbol.for('a-faus.celeste-extra-variants.routed-mods.v1');

async function writeFile(folder, name, bytes) {
  const file = await folder.getFileHandle(name, {create:true});
  const writer = await file.createWritable();
  try { await writer.write(bytes); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
}

async function collect(folder, prefix = '') {
  const found = [];
  for await (const [name, handle] of folder.entries()) {
    if (handle.kind === 'directory') found.push(...await collect(handle, `${prefix}${name}/`));
    else found.push({path:`${prefix}${name}`, file:await handle.getFile()});
  }
  return found;
}

async function destination(root, path) {
  const parts = path.split('/');
  let folder = root;
  for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, {create:true});
  return {folder, name:parts.at(-1)};
}

async function mergeMissingFiles(source, target) {
  for await (const [name, handle] of source.entries()) {
    if (handle.kind === 'directory') {
      const child = await target.getDirectoryHandle(name, {create:true});
      await mergeMissingFiles(handle, child);
      continue;
    }
    let alreadyThere = false;
    try { await target.getFileHandle(name); alreadyThere = true; }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
    if (!alreadyThere) await writeFile(target, name, await (await handle.getFile()).arrayBuffer());
  }
}

export async function migrateSharedSaves(origin) {
  const shared = await origin.getDirectoryHandle(SHARED_NAMESPACE, {create:true});
  const saves = await shared.getDirectoryHandle('Saves', {create:true});
  let firstMigration = false;
  try { await shared.getFileHandle('.MigrationComplete-v1'); }
  catch (error) { if (error.name !== 'NotFoundError') throw error; firstMigration = true; }
  const backups = firstMigration ? await shared.getDirectoryHandle('MigrationBackups', {create:true}) : null;
  const candidates = new Map();

  // Keep a verified snapshot before changing shared data on the first migration.
  // Later runs merge only files with a newer timestamp, never older copies.
  for (const mode of MIGRATION_MODES) {
    let previous;
    try {
      const root = await origin.getDirectoryHandle(`public-celeste-${mode}-v1`);
      previous = await (await root.getDirectoryHandle('Celeste')).getDirectoryHandle('Saves');
    } catch (error) { if (error.name === 'NotFoundError') continue; throw error; }
    const backup = backups ? await backups.getDirectoryHandle(mode, {create:true}) : null;
    for (const entry of await collect(previous)) {
      if (backup) {
        const bytes = await entry.file.arrayBuffer();
        const target = await destination(backup, entry.path);
        await writeFile(target.folder, target.name, bytes);
        const verified = await (await target.folder.getFileHandle(target.name)).getFile();
        const copy = new Uint8Array(await verified.arrayBuffer());
        const original = new Uint8Array(bytes);
        if (copy.length !== original.length || copy.some((value, index) => value !== original[index])) {
          throw new Error('Save backup verification failed. Existing saves were not changed.');
        }
      }
      const prior = candidates.get(entry.path);
      if (!prior || entry.file.lastModified > prior.file.lastModified) candidates.set(entry.path, entry);
    }
  }

  for (const entry of candidates.values()) {
    const target = await destination(saves, entry.path);
    let current;
    try { current = await (await target.folder.getFileHandle(target.name)).getFile(); }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
    if (!current || entry.file.lastModified > current.lastModified) {
      await writeFile(target.folder, target.name, await entry.file.arrayBuffer());
    }
  }
  if (firstMigration) {
    await writeFile(shared, '.MigrationComplete-v1', 'Legacy Celeste saves preserved; newest conflicting file selected.');
  }
  return saves;
}

export async function installSaveRouting(mode) {
  const route = ROUTES[mode];
  if (!route) throw new Error(`Unsupported Extra Variants game mode: ${mode}`);
  const proto = FileSystemDirectoryHandle.prototype;
  if (proto[ROUTING_MARKER]) {
    if (proto[ROUTED_MODE] !== route.id) throw new Error('Only one Extra Variants game can run in this page.');
    return proto[ROUTED_MODS];
  }

  const getDirectory = proto[ORIGINAL_GET_DIRECTORY] || proto.getDirectoryHandle;
  const entries = proto[ORIGINAL_ENTRIES] || proto.entries;
  if (!proto[ORIGINAL_GET_DIRECTORY]) Object.defineProperty(proto, ORIGINAL_GET_DIRECTORY, {value:getDirectory});
  if (!proto[ORIGINAL_ENTRIES]) Object.defineProperty(proto, ORIGINAL_ENTRIES, {value:entries});

  const origin = typeof mode === 'string' ? await navigator.storage.getDirectory() : mode;
  const gameRoot = await getDirectory.call(origin, route.gameRoot, {create:true});
  const celeste = await getDirectory.call(gameRoot, 'Celeste', {create:true});
  // Keep physical entries for the WASM filesystem's directory/type checks.
  await getDirectory.call(celeste, 'Saves', {create:true});
  await getDirectory.call(gameRoot, 'Mods', {create:true});
  await getDirectory.call(celeste, 'Mods', {create:true});

  const overlayRoot = await getDirectory.call(origin, route.overlayRoot, {create:true});
  const mods = await getDirectory.call(overlayRoot, 'Mods', {create:true});
  const modSources = [
    await getDirectory.call(gameRoot, 'Mods'),
    await getDirectory.call(celeste, 'Mods')
  ];
  if (route.id === 'spring-collab-extra-variants') {
    try { modSources.push(await getDirectory.call(origin, 'public-celeste-spring-collab-mods-v1')); }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
  }
  for (const source of modSources) await mergeMissingFiles(source, mods);

  const shared = await getDirectory.call(origin, SHARED_NAMESPACE, {create:true});
  const saves = await getDirectory.call(shared, 'Saves', {create:true});
  proto.getDirectoryHandle = async function(name, options) {
    if (name === 'Saves' && this.name === 'Celeste' && await this.isSameEntry(celeste)) return saves;
    if (name === 'Mods' && (await this.isSameEntry(gameRoot) || await this.isSameEntry(celeste))) return mods;
    return getDirectory.call(this, name, options);
  };
  proto.entries = async function*() {
    const inCeleste = this.name === 'Celeste' && await this.isSameEntry(celeste);
    const inRoot = await this.isSameEntry(gameRoot);
    for await (const [name, handle] of entries.call(this)) {
      yield [
        name,
        inCeleste && name === 'Saves' ? saves :
          (inCeleste || inRoot) && name === 'Mods' ? mods : handle
      ];
    }
  };
  proto[Symbol.asyncIterator] = proto.entries;
  proto.values = async function*() { for await (const [,handle] of this.entries()) yield handle; };
  proto.keys = async function*() { for await (const [name] of this.entries()) yield name; };
  Object.defineProperties(proto, {
    [ROUTING_MARKER]: {value:true},
    [ROUTED_MODE]: {value:route.id},
    [ROUTED_MODS]: {value:mods}
  });
  return mods;
}

const EXTRA_VARIANTS_ARCHIVE = {
  name: 'ExtendedVariantMode.zip',
  size: 499117,
  sha256: '468077af4655349ded0821e3dd283d7dc366d9e3a781a15dc67698f8fb3c9fcc'
};

export async function installExtraVariantMode(mods) {
  const file = await mods.getFileHandle(EXTRA_VARIANTS_ARCHIVE.name, {create:true});
  try {
    const existing = await file.getFile();
    if (existing.size === EXTRA_VARIANTS_ARCHIVE.size) {
      const digest = await crypto.subtle.digest('SHA-256', await existing.arrayBuffer());
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash === EXTRA_VARIANTS_ARCHIVE.sha256) return;
    }
  } catch (error) {
    if (error.name !== 'NotFoundError') throw error;
  }

  const url = new URL('./shared-mods/ExtendedVariantMode.zip', import.meta.url);
  const response = await fetch(url, {cache:'no-cache'});
  if (!response.ok) throw new Error(`Extended Variant Mode download failed (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== EXTRA_VARIANTS_ARCHIVE.size) throw new Error('Extended Variant Mode download was incomplete.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== EXTRA_VARIANTS_ARCHIVE.sha256) throw new Error('Extended Variant Mode failed its integrity check.');

  const writer = await file.createWritable();
  try { await writer.write(bytes); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
}

export async function withSaveSession(locks, action) {
  if (!locks) throw new Error('Shared saves require a current Chrome or Edge browser with Web Locks support.');
  const names = [SAVE_LOCK, ...LOCK_MODES.map(mode => `public-celeste-${mode}-v1`)];
  const acquire = index => index === names.length ? action() : locks.request(names[index], {ifAvailable:true}, lock => {
    if (!lock) throw new Error('A Celeste game is already open in another tab. Close it before switching modes so its latest save is kept safe.');
    return acquire(index + 1);
  });
  return acquire(0);
}
