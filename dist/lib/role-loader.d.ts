export interface RoleReferences {
    skills?: string[];
}
export interface RoleConfig {
    name: string;
    type: 'role';
    description?: string;
    references?: RoleReferences;
}
/**
 * Load a role skill configuration by name
 */
export declare function loadRole(name: string): RoleConfig | null;
/**
 * Get referenced skills for a role (lazy-load targets)
 */
export declare function getReferencedSkills(roleName: string): string[];
/**
 * Check if a skill is a role skill (has type: role in frontmatter)
 */
export declare function isRoleSkill(skillName: string): boolean;
/**
 * Clear role cache (for testing)
 */
export declare function clearCache(): void;
//# sourceMappingURL=role-loader.d.ts.map