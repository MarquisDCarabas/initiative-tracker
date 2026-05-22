import { requestUrl } from "obsidian";

/**
 * D&D Beyond's public, read-only character endpoint.
 *
 * It returns a JSON envelope shaped like:
 *   { id, success, message, data: { ...the actual character... } }
 *
 * We hit the "v5" character-service host (not www.dndbeyond.com) because it
 * serves clean JSON and is what the DDB site itself calls.
 */
const DDB_CHARACTER_ENDPOINT =
    "https://character-service.dndbeyond.com/character/v5/character/";

/** Ability scores are stored in a fixed array; Constitution is id 3. */
const CONSTITUTION_STAT_ID = 3;

/** Abandon a request that hasn't responded in this long (requestUrl can hang). */
const REQUEST_TIMEOUT_MS = 10000;

/** The three numbers the rest of the plugin actually cares about. */
export interface DndBeyondHP {
    /** Current hit points = max HP minus damage already taken. */
    currentHP: number;
    /** Maximum hit points (see computeMaxHP for how it's assembled). */
    maxHP: number;
    /** Temporary hit points (a separate pool that sits on top of current HP). */
    tempHP: number;
}

/** One ability score entry, e.g. { id: 3, value: 14 } for Constitution. */
interface DdbStat {
    id: number;
    value: number | null;
}

/** One class the character has levels in. We only need the level count. */
interface DdbClass {
    level: number;
}

/**
 * A single rules modifier (a racial bonus, a feat, an item effect, etc.).
 * `subType` names what it touches (e.g. "constitution-score",
 * "hit-points-per-level") and `type` is how it touches it ("bonus", "set", ...).
 */
interface DdbModifier {
    type: string;
    subType: string;
    value: number | null;
}

/**
 * Only the slice of the character payload we read. The real object has
 * hundreds of fields; typing just these keeps the parsing honest and readable.
 */
interface DdbCharacterData {
    /**
     * HP granted purely by hit dice across all levels. This deliberately does
     * NOT include the Constitution modifier or per-level HP feats — we add those
     * in computeMaxHP() below.
     */
    baseHitPoints: number;
    /** Flat bonus HP added to the maximum (e.g. some magic items). null = none. */
    bonusHitPoints: number | null;
    /** A hard override of the maximum HP. When set, it wins over everything else. */
    overrideHitPoints: number | null;
    /** HP that has been removed by damage. current = max - removed. */
    removedHitPoints: number;
    /** Temporary HP pool. */
    temporaryHitPoints: number;
    /** Base ability scores (point-buy/rolled), one entry per ability. */
    stats: DdbStat[];
    /** Legacy flat bonuses to ability scores; usually all null. */
    bonusStats: DdbStat[];
    /** Manual overrides of ability scores; null unless the player set one. */
    overrideStats: DdbStat[];
    /** The character's classes; total level is the sum of these levels. */
    classes: DdbClass[];
    /**
     * Modifiers grouped by source: { race, class, background, item, feat, ... }.
     * Racial CON bonuses, ASIs, feats and items all live here — NOT in `stats`.
     */
    modifiers: { [group: string]: DdbModifier[] };
    /**
     * The "Extras" tab — pets/familiars/mounts/companions the character controls.
     * Each carries its statblock under `definition` and its own live HP state.
     */
    creatures?: DdbExtraCreature[];
}

/**
 * One entry from the "Extras" tab. The pet's live HP is top-level
 * (removedHitPoints / temporaryHitPoints); its MAXIMUM is the statblock's
 * `averageHitPoints` under `definition` (there is no `hitPoints` field). The
 * top-level `name` is a custom override and is often null, so fall back to
 * `definition.name` when matching.
 */
interface DdbExtraCreature {
    name: string | null;
    removedHitPoints: number;
    temporaryHitPoints: number;
    definition: {
        name: string;
        averageHitPoints: number;
    } | null;
}

/** The envelope the endpoint wraps every character in. */
interface DdbCharacterResponse {
    success: boolean;
    message: string;
    data: DdbCharacterData | null;
}

/**
 * Fetch a D&D Beyond character's HP and reduce it to { currentHP, maxHP, tempHP }.
 *
 * @param characterId The numeric character ID (the number in a DDB sheet URL,
 *                     e.g. dndbeyond.com/characters/12345678 -> 12345678).
 * @param extraName   Optional. When set, returns the HP of the matching creature
 *                    from this character's "Extras" tab (pet/familiar/mount)
 *                    instead of the character's own HP. Matched by case-insensitive
 *                    substring against the creature's name.
 * @throws If the ID is malformed, the character is private/missing, the named
 *         Extra isn't found, the network fails, or the response can't be
 *         understood — each with a clear message.
 */
export async function fetchDndBeyondHP(
    characterId: number | string,
    extraName?: string
): Promise<DndBeyondHP> {
    // --- 1. Validate the ID up front so we never build a nonsense URL. ----------
    // DDB character IDs are positive integers; reject anything else early.
    const id = String(characterId).trim();
    if (!/^\d+$/.test(id)) {
        throw new Error(
            `Invalid D&D Beyond character ID "${characterId}" — it must be a positive integer.`
        );
    }

    const url = `${DDB_CHARACTER_ENDPOINT}${id}`;

    // --- 2. Make the request through Obsidian's requestUrl. --------------------
    // We use requestUrl (NOT fetch) on purpose: it runs through Obsidian's own
    // networking layer, which bypasses the browser CORS restrictions that would
    // otherwise block a cross-origin call to dndbeyond.com from a plugin.
    //
    // `throw: false` tells requestUrl not to throw on HTTP error statuses (403,
    // 404, etc.) so we can inspect the status ourselves and produce friendly
    // messages. A genuine network failure (no connection, DNS error) still
    // rejects the promise, which we catch and rewrap below.
    let response;
    try {
        response = await withTimeout(
            requestUrl({ url, method: "GET", throw: false }),
            REQUEST_TIMEOUT_MS
        );
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        throw new Error(
            `Could not reach D&D Beyond while fetching character ${id}. ` +
                `Check your internet connection. (${detail})`
        );
    }

    // --- 3. Turn HTTP error statuses into clear errors. ------------------------
    // A private character (or one that doesn't exist) typically comes back as
    // 403 Forbidden or 404 Not Found.
    if (response.status === 403 || response.status === 404) {
        throw new Error(
            `D&D Beyond character ${id} is private or does not exist ` +
                `(HTTP ${response.status}). Set the character's privacy to ` +
                `"Public" on D&D Beyond and try again.`
        );
    }
    if (response.status < 200 || response.status >= 300) {
        throw new Error(
            `D&D Beyond returned an unexpected status (HTTP ${response.status}) ` +
                `for character ${id}.`
        );
    }

    // --- 4. Parse the JSON body. ----------------------------------------------
    // response.json is a getter that parses response.text; it can throw if the
    // body isn't valid JSON, so guard it.
    let payload: DdbCharacterResponse;
    try {
        payload = response.json as DdbCharacterResponse;
    } catch {
        throw new Error(
            `D&D Beyond sent a response for character ${id} that wasn't valid JSON.`
        );
    }

    // The envelope itself reports success/failure. A private character can also
    // surface here as success === false rather than via an HTTP status.
    if (!payload || payload.success === false || !payload.data) {
        const reason =
            payload?.message?.trim() ||
            "the character may be private or may not exist";
        throw new Error(
            `D&D Beyond could not return character ${id}: ${reason}.`
        );
    }

    // --- 5. Reduce the raw HP fields to the three numbers we want. -------------
    const data = payload.data;

    // If an Extra (pet/familiar/mount) was named, read that creature's HP from
    // the "Extras" tab instead of the character's own HP.
    if (extraName != null && extraName.trim().length > 0) {
        return extractExtraHP(data, extraName, id);
    }

    const removed = toNumber(data.removedHitPoints);
    const tempHP = toNumber(data.temporaryHitPoints);

    const maxHP = computeMaxHP(data);
    // Guard against partial/garbage payloads (valid JSON, but empty/incomplete
    // character data). A real character always has a positive maximum, so a 0
    // here means the response was incomplete — refuse it rather than zeroing the
    // combatant. Callers leave HP unchanged when this throws.
    if (maxHP <= 0) {
        throw new Error(
            `D&D Beyond returned incomplete data for character ${id} ` +
                `(computed a max HP of ${maxHP}). Leaving HP unchanged.`
        );
    }
    // Current HP is simply the max minus whatever damage has been logged on DDB.
    const currentHP = maxHP - removed;

    return { currentHP, maxHP, tempHP };
}

/**
 * Extract one Extra's (pet/familiar/mount) HP from the character payload.
 *
 * Matched by case-insensitive substring against the creature's custom name or,
 * when that's null, its statblock name — so "Vengeance" matches
 * "Vengeance (7th Level)" and keeps matching after the character levels up.
 * Max HP is the statblock's `averageHitPoints` (no Con math — it's a monster);
 * current = max - removedHitPoints; temp = temporaryHitPoints.
 */
function extractExtraHP(
    data: DdbCharacterData,
    extraName: string,
    characterId: string
): DndBeyondHP {
    const creatures = Array.isArray(data.creatures) ? data.creatures : [];
    const needle = extraName.trim().toLowerCase();
    const match = creatures.find((c) =>
        (c?.name ?? c?.definition?.name ?? "").toLowerCase().includes(needle)
    );
    if (!match) {
        throw new Error(
            `D&D Beyond character ${characterId} has no Extra matching ` +
                `"${extraName}". Check the name (a partial match is fine) and ` +
                `that the creature is on the character's Extras tab.`
        );
    }
    const maxHP = toNumber(match.definition?.averageHitPoints);
    if (maxHP <= 0) {
        throw new Error(
            `D&D Beyond Extra "${extraName}" returned incomplete HP data ` +
                `(max HP ${maxHP}). Leaving HP unchanged.`
        );
    }
    const currentHP = maxHP - toNumber(match.removedHitPoints);
    const tempHP = toNumber(match.temporaryHitPoints);
    return { currentHP, maxHP, tempHP };
}

/**
 * Assemble the maximum HP the way D&D Beyond does.
 *
 * If the player set a manual override on DDB, that value IS the max and wins.
 * Otherwise:
 *
 *   max = baseHitPoints                       (HP from hit dice)
 *       + bonusHitPoints                      (flat bonuses, e.g. items)
 *       + (constitutionModifier) * totalLevel (the big one DDB stores separately)
 *       + (perLevelHpBonus)       * totalLevel (feats/traits like Tough, Hill Dwarf)
 *
 * This is the piece that was previously missing: `baseHitPoints` is hit-dice
 * only, so without the CON term the max read low by (CON modifier x level).
 *
 * Remaining edge cases (rare): per-level bonuses tied to a single class on a
 * multiclassed character (e.g. Draconic Bloodline counts sorcerer levels only)
 * are applied across the full level total here, which can be slightly high.
 */
function computeMaxHP(data: DdbCharacterData): number {
    // A manual override on the sheet IS the max and wins outright.
    if (data.overrideHitPoints != null) {
        return toNumber(data.overrideHitPoints);
    }
    const base = toNumber(data.baseHitPoints);
    const bonus = toNumber(data.bonusHitPoints);
    const totalLevel = getTotalLevel(data);
    const conMod = abilityModifier(getConstitutionScore(data));
    const perLevelHp = getPerLevelHpBonus(data);
    return base + bonus + (conMod + perLevelHp) * totalLevel;
}

/** D&D's standard ability modifier: floor((score - 10) / 2). */
function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
}

/**
 * Work out the character's true Constitution score.
 *
 * DDB keeps the base score in `stats` and applies racial bonuses, ASIs, feats
 * and items as separate `modifiers` — so we have to add those in by hand. A
 * manual override on the sheet, if present, replaces the whole calculation.
 */
function getConstitutionScore(data: DdbCharacterData): number {
    const override = findStatValue(data.overrideStats, CONSTITUTION_STAT_ID);
    if (override != null) return override;

    // Base score (default 10 if somehow absent) plus the legacy flat-bonus column.
    let score =
        (toNumber(findStatValue(data.stats, CONSTITUTION_STAT_ID)) || 10) +
        toNumber(findStatValue(data.bonusStats, CONSTITUTION_STAT_ID));

    // Fold in modifier-based bonuses (e.g. racial +2 CON) and any "set" effects
    // (e.g. an Amulet of Health setting CON to 19 — we take whichever is higher).
    let setScore: number | null = null;
    for (const mod of allModifiers(data)) {
        if (mod.subType !== "constitution-score") continue;
        if (mod.type === "bonus") {
            score += toNumber(mod.value);
        } else if (mod.type === "set" && mod.value != null) {
            setScore = setScore == null ? mod.value : Math.max(setScore, mod.value);
        }
    }
    if (setScore != null) score = Math.max(score, setScore);

    return score;
}

/** Sum of all class levels = the character's total level. */
function getTotalLevel(data: DdbCharacterData): number {
    if (!Array.isArray(data.classes)) return 0;
    return data.classes.reduce((sum, c) => sum + toNumber(c.level), 0);
}

/**
 * Total of all "extra HP per level" modifiers (Tough = +2, Hill Dwarf = +1, etc.).
 * Each is multiplied by total level back in computeMaxHP.
 */
function getPerLevelHpBonus(data: DdbCharacterData): number {
    let sum = 0;
    for (const mod of allModifiers(data)) {
        if (mod.subType === "hit-points-per-level") sum += toNumber(mod.value);
    }
    return sum;
}

/** Flatten DDB's source-grouped modifiers (race/class/feat/item/...) into one list. */
function allModifiers(data: DdbCharacterData): DdbModifier[] {
    if (!data.modifiers) return [];
    return Object.values(data.modifiers)
        .flat()
        .filter((m): m is DdbModifier => !!m);
}

/** Pull a single ability score's value out of one of the stat arrays. */
function findStatValue(
    stats: DdbStat[] | undefined,
    id: number
): number | null {
    const stat = stats?.find((s) => s.id === id);
    return stat ? stat.value : null;
}

/**
 * Coerce a possibly-null/undefined field into a usable number. DDB uses null for
 * "not set" on several fields, so default those to 0 rather than letting NaN
 * leak into the arithmetic.
 */
function toNumber(value: number | null | undefined): number {
    return typeof value === "number" && !isNaN(value) ? value : 0;
}

/**
 * Reject if a promise doesn't settle within `ms`. requestUrl has no timeout of
 * its own, so a hung connection would otherwise stall the auto-sync loop
 * forever — its re-entrancy guard would never release and ticks would be skipped
 * indefinitely. A rejection here flows into the normal error handling instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`timed out after ${ms / 1000}s`)),
            ms
        );
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}
