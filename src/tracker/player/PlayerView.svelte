<script lang="ts">
    import { setIcon } from "obsidian";
    import { fade } from "svelte/transition";
    import { SyncLoader } from "svelte-loading-spinners";

    import { AC, FRIENDLY, HP, INITIATIVE } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import type InitiativeTracker from "src/main";
    import { afterUpdate, createEventDispatcher, onDestroy, setContext, tick } from "svelte";
    import Portrait from "../ui/creatures/Portrait.svelte";

    import { tracker } from "../stores/tracker";
    const { state, ordered, data, bands } = tracker;

    export let plugin: InitiativeTracker;
    setContext<InitiativeTracker>("plugin", plugin);

    const hpIcon = (node: HTMLElement) => {
        setIcon(node, HP);
    };
    const acIcon = (node: HTMLElement) => {
        setIcon(node, AC);
    };
    const iniIcon = (node: HTMLElement) => {
        setIcon(node, INITIATIVE);
    };

    const getHpStatus = (hp: number, max: number) => {
        if (!hp) return "";
        if (hp <= 0) return "Defeated";
        if (hp < max / 2) return "Bloodied";
        if (hp < max) return "Hurt";
        return "Healthy";
    };

    const amIActive = (creature: Creature) => {
        if (creature.hidden) return false;
        if (creature.active) return true;

        const active = $ordered.findIndex((c) => c.active);
        const index = $ordered.indexOf(creature);
        if (active == -1 || active < index) return false;

        const remaining = $ordered.slice(index + 1, active + 1);
        if (remaining.every((c) => c.hidden)) return true;
        return false;
    };

    $: activeAndVisible = $ordered.filter((c) => c.enabled && !c.hidden);
    $: showInitiative = $data?.displayPlayerInitiative ?? true;
    $: showStatuses = $data?.displayPlayerStatuses ?? true;
    $: activeCreature = $ordered.find((c) => c.active);
    $: visibleBandStripes = (() => {
        const map = new Map<string, string>();
        let palette = 0;
        const palette_colors = [
            "var(--color-red)",
            "var(--color-orange)",
            "var(--color-yellow)",
            "var(--color-green)",
            "var(--color-cyan)",
            "var(--color-blue)",
            "var(--color-purple)",
            "var(--color-pink)"
        ];
        let i = 0;
        while (i < activeAndVisible.length) {
            const c = activeAndVisible[i];
            if (!c.bandId) {
                i++;
                continue;
            }
            let j = i + 1;
            while (
                j < activeAndVisible.length &&
                activeAndVisible[j].bandId === c.bandId
            )
                j++;
            if (j - i >= 2) {
                const color = palette_colors[palette % palette_colors.length];
                for (let k = i; k < j; k++)
                    map.set(activeAndVisible[k].id, color);
                palette++;
            }
            i = j;
        }
        return map;
    })();

    const name = (creature: Creature) => creature.getName();
    const friendIcon = (node: HTMLElement) => {
        setIcon(node, FRIENDLY);
    };

    // --- Auto-fit sizing ---------------------------------------------------
    // Scale font-size so rows fill the available height. Portrait sizes use em
    // units, so they grow with the font. When rows would shrink below the
    // readable floor, the container scrolls and the active row auto-scrolls
    // into view.
    const MIN_FONT_PX = 16;
    const MAX_FONT_PX = 32;
    // Initial guess; refined by measuring actual row height after first paint.
    const ROW_TO_FONT_INITIAL = 2.2;

    let container: HTMLElement;
    let headerEl: HTMLElement;
    let containerHeight = 0;
    let headerHeight = 0;
    let resizeObserver: ResizeObserver | undefined;

    const remeasure = () => {
        if (container) containerHeight = container.clientHeight;
        if (headerEl) headerHeight = headerEl.offsetHeight;
    };

    const observe = (node: HTMLElement) => {
        container = node;
        resizeObserver = new ResizeObserver(remeasure);
        resizeObserver.observe(node);
        containerHeight = node.clientHeight;
        return {
            destroy() {
                resizeObserver?.disconnect();
                resizeObserver = undefined;
            }
        };
    };

    const measureHeader = (node: HTMLElement) => {
        headerEl = node;
        headerHeight = node.offsetHeight;
        resizeObserver?.observe(node);
        return {
            destroy() {
                resizeObserver?.unobserve(node);
            }
        };
    };

    let rowToFont = ROW_TO_FONT_INITIAL;
    let tableEl: HTMLElement;

    // Safety margin in px so the last row never gets clipped at the boundary.
    const FIT_MARGIN_PX = 4;

    $: rowCount = activeAndVisible.length;
    $: available = Math.max(0, containerHeight - headerHeight - FIT_MARGIN_PX);
    // Round to whole px to prevent oscillation between header reflow and font recalc.
    $: ideal = rowCount > 0
        ? Math.floor(available / rowCount / rowToFont)
        : MAX_FONT_PX;
    $: fontPx = Math.max(MIN_FONT_PX, Math.min(MAX_FONT_PX, ideal));
    $: overflowing = rowCount > 0 && ideal < MIN_FONT_PX;

    // After the table renders, compare its actual height against the container
    // and adjust the rowToFont ratio so the next pass fills (without clipping).
    // Measures the WHOLE table — captures padding, border-spacing, etc. that a
    // single-row measurement misses. Uses afterUpdate (not $:) to avoid the
    // cyclical-dependency error since `ideal` reads `rowToFont`.
    afterUpdate(() => {
        if (!container || !tableEl || rowCount === 0 || fontPx <= 0) return;
        if (ideal !== fontPx) return;  // clamped — can't adjust meaningfully
        const containerH = container.clientHeight;
        const tableH = tableEl.offsetHeight;
        if (tableH <= 0 || containerH <= 0) return;
        // Target the table at (container - margin) to leave a hairline gap.
        const target = containerH - FIT_MARGIN_PX;
        const scale = target / tableH;
        if (Math.abs(1 - scale) < 0.02) return;  // within ~2% — good enough
        const next = rowToFont / scale;
        if (next > 0.8 && next < 5) {
            rowToFont = next;
        }
    });

    // Auto-scroll active row into view when it changes.
    $: activeId = $ordered.find((c) => c.active)?.id;
    let lastScrolledId: string | number | undefined;
    $: if (container && activeId !== undefined && activeId !== lastScrolledId) {
        lastScrolledId = activeId;
        tick().then(() => {
            const row = container.querySelector(
                `tr[data-creature-id="${activeId}"]`
            ) as HTMLElement | null;
            row?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
    }

    onDestroy(() => resizeObserver?.disconnect());
</script>

<div
    class="player-view-fit"
    class:overflowing
    style="--player-view-font-size: {fontPx}px"
    use:observe
>
<table class="initiative-tracker-table" transition:fade bind:this={tableEl}>
    <thead class="tracker-table-header" use:measureHeader>
        {#if showInitiative}
            <th class="center"><strong use:iniIcon /></th>
        {/if}
        <th style="width:8px" />
        <th class="portrait-col" />
        <th class="left name-col"><strong>Name</strong></th>
        <th class="center hp-col"><strong use:hpIcon /></th>
        {#if showStatuses}
            <th><strong> Statuses </strong></th>
        {/if}
    </thead>
    <tbody>
        {#each activeAndVisible as creature (creature.id)}
            {@const bandColor = visibleBandStripes.get(creature.id) ?? null}
            <tr
                data-creature-id={creature.id}
                class:active={amIActive(creature) && $state}
                class:band-active={$state &&
                    !amIActive(creature) &&
                    activeCreature &&
                    activeCreature.bandId &&
                    bandColor &&
                    creature.bandId === activeCreature.bandId}
                class:targeted={creature.target}
            >
                {#if showInitiative}
                    <td class="center">{creature.initiative}</td>
                {/if}
                <td
                    class="band-cell"
                    class:band-stripe={bandColor}
                    style={bandColor ? `--band-color: ${bandColor};` : ""}
                />
                <td class="portrait-cell">
                    <Portrait {creature} />
                </td>
                <td class="name-cell name-col">
                    <div class="name">
                        {#if creature.friendly}
                            <div
                                class="contains-icon"
                                use:friendIcon
                                aria-label={`This creature is an ally.`}
                            />
                        {/if}
                        {name(creature)}
                    </div>
                </td>
                <td
                    class:center={true}
                    class="hp-col {getHpStatus(creature.hp, creature.max).toLowerCase()}"
                >
                    {#if creature.player && $data.diplayPlayerHPValues}
                        <div class="center">{@html creature.hpDisplay}</div>
                    {:else}
                        <span>{getHpStatus(creature.hp, creature.max)}</span>
                    {/if}
                </td>
                {#if showStatuses}
                    <td class="center">
                        {[...creature.status].map((s) => s.name).join(", ")}
                    </td>
                {/if}
            </tr>
        {/each}
    </tbody>
</table>
</div>

<style scoped>
    .full-center {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .player-view-fit {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-size: var(--player-view-font-size, 1rem);
    }
    .player-view-fit.overflowing {
        overflow-y: auto;
    }
    .portrait-col {
        width: 2em;
    }
    .initiative-tracker-table {
        padding: 0.5rem;
        align-items: center;
        gap: 0.25rem 0.5rem;
        width: 100%;
        margin-left: 0rem;
        table-layout: auto;
        border-collapse: separate;
        border-spacing: 0 2px;
        font-size: inherit;
    }
    .left {
        text-align: left;
    }
    .name-cell {
        text-align: left;
        white-space: nowrap;
    }
    .name-col {
        width: 100%;
        padding-left: 0.4em;
    }
    .name, .name > :global(svg) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .hp-col {
        white-space: nowrap;
    }
    .center {
        text-align: center;
    }
    .portrait-cell {
        padding: 0;
        vertical-align: middle;
        text-align: center;
    }
    .healthy {
        color: var(--text-success);
    }
    .hurt {
        color: var(--text-warning);
    }
    .bloodied {
        color: var(--text-error);
    }
    .defeated {
        color: var(--text-faint);
    }
    .active {
        background-color: rgba(0, 0, 0, 0.1);
    }
    :global(.theme-dark) .active {
        background-color: rgba(255, 255, 255, 0.1);
    }
    .band-active {
        background-color: rgba(0, 0, 0, 0.04);
    }
    :global(.theme-dark) .band-active {
        background-color: rgba(255, 255, 255, 0.04);
    }
    .band-cell {
        padding: 0;
        position: relative;
    }
    .band-cell.band-stripe::before {
        content: "";
        position: absolute;
        left: 2px;
        top: 4px;
        bottom: 4px;
        width: 4px;
        background-color: var(--band-color);
        border-radius: 2px;
    }
    .targeted > td {
        border-top: 1px solid var(--text-error);
        border-bottom: 1px solid var(--text-error);
    }
    .targeted > td:first-child {
        border-left: 1px solid var(--text-error);
    }
    .targeted > td:last-child {
        border-right: 1px solid var(--text-error);
    }
</style>
