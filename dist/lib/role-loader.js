import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');
let roleCache = {};
/**
 * Parse SKILL.md frontmatter to extract role config
 */
function parseSkillFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Extract YAML frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            return null;
        }
        const frontmatter = yaml.load(frontmatterMatch[1]);
        return frontmatter;
    }
    catch (error) {
        console.error(`[RoleLoader] Failed to parse ${filePath}:`, error);
        return null;
    }
}
/**
 * Load a role skill configuration by name
 */
export function loadRole(name) {
    if (roleCache[name]) {
        return roleCache[name];
    }
    const rolePath = path.join(SKILLS_DIR, name, 'SKILL.md');
    if (!fs.existsSync(rolePath)) {
        console.warn(`[RoleLoader] Role skill not found: ${name}`);
        return null;
    }
    const role = parseSkillFile(rolePath);
    if (role) {
        roleCache[name] = role;
    }
    return role;
}
/**
 * Get referenced skills for a role (lazy-load targets)
 */
export function getReferencedSkills(roleName) {
    const role = loadRole(roleName);
    return role?.references?.skills || [];
}
/**
 * Check if a skill is a role skill (has type: role in frontmatter)
 */
export function isRoleSkill(skillName) {
    const role = loadRole(skillName);
    return role?.type === 'role';
}
/**
 * Clear role cache (for testing)
 */
export function clearCache() {
    roleCache = {};
}
//# sourceMappingURL=role-loader.js.map