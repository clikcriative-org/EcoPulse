// Shared by the API (validation) and the Groups page (pickers). Icons are lucide-react names,
// mapped to components on the client; the server only stores and validates the key.

export const CATEGORY_ICONS = [
    "Briefcase", "Users", "User", "Home", "GraduationCap", "Folder", "Tag", "Star", "Heart", "ShoppingBag",
    "Megaphone", "Building2", "Car", "Gamepad2", "Music", "Camera", "Plane", "Wrench", "DollarSign", "BookOpen",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_COLORS = ["#10B981", "#0EA5E9", "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#64748B"];

/** "  Trabalho   Remoto " -> "trabalho remoto": the uniqueness key, ignoring extra spaces and case. */
export const categoryKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

/** Display form of a name: trimmed, single spaces. */
export const cleanCategoryName = (name: string) => name.trim().replace(/\s+/g, " ");

export const isHexColor = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
export const isCategoryIcon = (i: unknown): i is CategoryIcon => typeof i === "string" && (CATEGORY_ICONS as readonly string[]).includes(i);
