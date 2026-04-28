<script lang="ts">
    import { setIcon } from "obsidian";
    import { fade } from "svelte/transition";
    import { SyncLoader } from "svelte-loading-spinners";

    import { AC, FRIENDLY, HP, INITIATIVE } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import type InitiativeTracker from "src/main";
    import { createEventDispatcher, setContext } from "svelte";
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
</script>

<table class="initiative-tracker-table" transition:fade>
    <thead class="tracker-table-header">
        {#if showInitiative}
            <th style="width:5%"><strong use:iniIcon /></th>
        {/if}
        <th style="width:8px" />
        <th style="width:40px" />
        <th class="left" style="width:25%"><strong>Name</strong></th>
        <th style="width:15%" class="center"><strong use:hpIcon /></th>
        <th><strong> Statuses </strong></th>
    </thead>
    <tbody>
        {#each activeAndVisible as creature (creature.id)}
            {@const bandColor = visibleBandStripes.get(creature.id) ?? null}
            <tr
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
                <td class='name'>
                    {#if creature.friendly}
                        <div
                            class="contains-icon"
                            use:friendIcon
                            aria-label={`This creature is an ally.`}
                        />
                    {/if}
                    {name(creature)}
                </td>
                <td
                    class:center={true}
                    class={getHpStatus(creature.hp, creature.max).toLowerCase()}
                >
                    {#if creature.player && $data.diplayPlayerHPValues}
                        <div class="center">{@html creature.hpDisplay}</div>
                    {:else}
                        <span>{getHpStatus(creature.hp, creature.max)}</span>
                    {/if}
                </td>
                <td class="center">
                    {[...creature.status].map((s) => s.name).join(", ")}
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style scoped>
    .full-center {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .initiative-tracker-table {
        padding: 0.5rem;
        align-items: center;
        gap: 0.25rem 0.5rem;
        width: 100%;
        margin-left: 0rem;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0 2px;
        font-size: larger;
    }
    .left {
        text-align: left;
    }
    .name, .name > :global(svg) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .center {
        text-align: center;
    }
    .portrait-cell {
        padding: 0 0.25rem;
        vertical-align: middle;
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
