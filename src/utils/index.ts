import type InitiativeTracker from "src/main";
import type { SRDMonster } from "src/types/creatures";
import type { Creature } from "./creature";
import { DECIMAL_TO_VULGAR_FRACTION } from "./constants";
import { setIcon } from "obsidian";

export * from "./constants";
export * from "./icons";
export * from "./conditions";
export { getRpgSystem, RpgSystemSetting } from "./rpg-system";

export function convertFraction(s: string | number): number {
    if (typeof s == "number") return s;
    if (typeof s != "string") return null;
    if (!s || s == "undefined" || !s.length) return 0;

    let split = s.split("/");
    if (split.length == 1) {
        if (isNaN(Number(s))) {
            return 0;
        }
        return Number(s);
    }
    return Number(split[0]) / Number(split[1]);
}

export function crToString(cr: string | number): string {
    if (typeof cr == "string") cr = convertFraction(cr);
    if (cr == 0) return "0";
    const decimalPart = cr % 1;
    const wholePart = Math.floor(cr);
    if (decimalPart == 0) return wholePart.toString();
    let str = wholePart == 0 ? "" : wholePart.toString();
    if (decimalPart in DECIMAL_TO_VULGAR_FRACTION) {
        str += DECIMAL_TO_VULGAR_FRACTION[decimalPart];
    } else {
        str += decimalPart.toString().slice(1);
    }
    return str;
}

export function getFromCreatureOrBestiary<T>(
    plugin: InitiativeTracker,
    creature: Creature | SRDMonster,
    getter: (creature: Creature | SRDMonster | null) => T
): T {
    const fromBase = getter(creature);
    if (fromBase) return fromBase;
    return getter(plugin.getCreatureFromBestiary(creature.name));
}

export function resolveImageUrl(
    plugin: InitiativeTracker,
    raw: string | undefined,
    sourcePath = ""
): string | null {
    if (!raw || typeof raw !== "string") return null;
    let value = raw.trim();
    if (!value) return null;

    const wiki = value.match(/^!?\[\[(.+?)(?:\|.*?)?\]\]$/);
    if (wiki) value = wiki[1].trim();

    if (/^(https?:|data:|app:|blob:|file:)/i.test(value)) return value;

    const file = plugin.app.metadataCache.getFirstLinkpathDest(
        value,
        sourcePath
    );
    if (file) return plugin.app.vault.getResourcePath(file);
    return null;
}

export function getCreatureImageUrl(
    plugin: InitiativeTracker,
    creature: Creature
): string | null {
    const fromToken = resolveImageUrl(
        plugin,
        creature.token,
        creature.path ?? ""
    );
    if (fromToken) return fromToken;
    const fromImage = resolveImageUrl(
        plugin,
        creature.image,
        creature.path ?? ""
    );
    if (fromImage) return fromImage;
    if (creature.path) {
        const file = plugin.app.metadataCache.getFirstLinkpathDest(
            creature.path,
            ""
        );
        if (file) {
            const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            const fmToken = fm?.token;
            if (fmToken) return resolveImageUrl(plugin, fmToken, file.path);
            const fmImage = fm?.image;
            if (fmImage) return resolveImageUrl(plugin, fmImage, file.path);
        }
    }
    return null;
}

export function getInitialsForPortrait(name: string): string {
    if (!name) return "?";
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const buildLoader = (text: string): HTMLDivElement => {
    const loading = createDiv({
        cls: "is-loading"
    });
    setIcon(loading.createDiv("spinner"), "loader-2");
    loading.createEl("em", {
        text
    });
    return loading;
};
