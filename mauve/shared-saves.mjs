// The bundled Webleste loader imports this relative to _framework/ and calls
// installSaveRouting("vanilla"). The page boot has already installed the Mauve
// shared-save route, so map that loader alias back to the existing Mauve route.
import {installSaveRouting as installSharedSaveRouting} from '../shared-saves.mjs?extra-variants-v1';

export function installSaveRouting(mode) {
  return installSharedSaveRouting(mode === 'vanilla' ? 'mauve' : mode);
}
