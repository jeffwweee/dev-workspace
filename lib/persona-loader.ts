import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSONAS_DIR = path.join(__dirname, '..', '.claude', 'personas');

export interface PersonaConfig {
  name: string;
  channel: string;
  response_format: string;
  auto_load: boolean;
  skills: string[];
}

let personaCache: Record<string, PersonaConfig> = {};

/**
 * Load a persona configuration by name
 */
export function loadPersona(name: string): PersonaConfig | null {
  if (personaCache[name]) {
    return personaCache[name];
  }

  const personaPath = path.join(PERSONAS_DIR, `${name}.yaml`);

  if (!fs.existsSync(personaPath)) {
    console.warn(`[PersonaLoader] Persona not found: ${name}`);
    return null;
  }

  try {
    const content = fs.readFileSync(personaPath, 'utf-8');
    const persona = yaml.load(content) as PersonaConfig;
    personaCache[name] = persona;
    return persona;
  } catch (error) {
    console.error(`[PersonaLoader] Failed to load persona ${name}:`, error);
    return null;
  }
}

/**
 * Get skills to auto-load for a persona
 */
export function getPersonaSkills(personaName: string): string[] {
  const persona = loadPersona(personaName);
  return persona?.skills || [];
}

/**
 * Clear persona cache (for testing)
 */
export function clearCache(): void {
  personaCache = {};
}
