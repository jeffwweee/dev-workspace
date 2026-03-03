export interface PersonaConfig {
    name: string;
    channel: string;
    response_format: string;
    auto_load: boolean;
    skills: string[];
}
/**
 * Load a persona configuration by name
 */
export declare function loadPersona(name: string): PersonaConfig | null;
/**
 * Get skills to auto-load for a persona
 */
export declare function getPersonaSkills(personaName: string): string[];
/**
 * Clear persona cache (for testing)
 */
export declare function clearCache(): void;
//# sourceMappingURL=persona-loader.d.ts.map