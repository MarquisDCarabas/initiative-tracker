<script lang="ts">
    import { DEFAULT_UNDEFINED, FRIENDLY, HIDDEN, INITIATIVE_TRACKER_VIEW } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import Initiative from "./Initiative.svelte";
    import CreatureControls from "./CreatureControls.svelte";
    import Status from "./Status.svelte";
    import Portrait from "./Portrait.svelte";
    import { Platform, setIcon, Notice } from "obsidian";
    import { tracker } from "../../stores/tracker";
    import { fetchDndBeyondHP } from "src/integrations/dndbeyond";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    const { updateTarget, bands, ordered } = tracker;

    export let creature: Creature;
    $: statuses = creature.status;
    $: bandColor = $bands.get(creature.id) ?? null;
    $: activeCreature = $ordered.find((c) => c.active);
    $: bandActive =
        !!bandColor &&
        !!activeCreature &&
        activeCreature.id !== creature.id &&
        activeCreature.bandId === creature.bandId;

    const name = () => creature.getName();
    const statblockLink = () => creature.getStatblockLink();
    const hiddenIcon = (div: HTMLElement) => {
        setIcon(div, HIDDEN);
    };
    const friendlyIcon = (div: HTMLElement) => {
        setIcon(div, FRIENDLY);
    };

    // D&D Beyond HP refresh: only meaningful for combatants that carry a DDB id.
    let ddbLoading = false;
    const ddbIcon = (div: HTMLElement) => {
        setIcon(div, "refresh-cw");
    };
    const ddbLinkIcon = (div: HTMLElement) => {
        setIcon(div, "link-2");
    };
    const refreshFromDDB = async () => {
        if (ddbLoading || creature.ddbCharacterId == null) return;
        ddbLoading = true;
        try {
            const hp = await fetchDndBeyondHP(creature.ddbCharacterId);
            // Absolute sets so the tracker mirrors D&D Beyond exactly.
            tracker.updateCreatures({
                creature,
                change: {
                    set_hp: hp.currentHP,
                    set_max_hp: hp.maxHP,
                    set_temp: hp.tempHP
                }
            });
        } catch (e) {
            // Leave HP untouched; just surface a brief error.
            new Notice(
                `D&D Beyond sync failed for ${creature.name}: ${
                    e instanceof Error ? e.message : String(e)
                }`,
                6000
            );
        } finally {
            ddbLoading = false;
        }
    };

    const hoverParent: { hoverPopover: null } = { hoverPopover: null };
    let hoverTimeout: NodeJS.Timeout = null;
    const tryHover = (evt: MouseEvent) => {
        hoverTimeout = setTimeout(() => {
            if (creature["statblock-link"]) {
                let link = statblockLink();
                if (/\[.+\]\(.+\)/.test(link)) {
                    //md
                    [, link] = link.match(/\[.+?\]\((.+?)\)/);
                } else if (/\[\[.+\]\]/.test(link)) {
                    //wiki
                    [, link] = link.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
                }

                app.workspace.trigger("hover-link", {
                    event: evt,
                    source: INITIATIVE_TRACKER_VIEW,
                    hoverParent,
                    targetEl: evt.target as HTMLElement,
                    linktext: link
                });
            }
        }, 1000);
    };

    const cancelHover = (evt: MouseEvent) => {
        clearTimeout(hoverTimeout);
    };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<td
    class="initiative-container"
    class:band-stripe={bandColor}
    style={bandColor ? `--band-color: ${bandColor};` : ""}
    on:click={(e) => e.stopPropagation()}
>
    <Initiative
        initiative={creature.initiative}
        modifier={[creature.modifier].flat().reduce((a, b) => a + b, 0)}
        on:click={(e) => e.stopPropagation()}
        on:initiative={(e) => {
            tracker.updateCreatures({
                creature,
                change: { initiative: Number(e.detail) }
            });
        }}
    />
</td>
<td class="portrait-container" on:click|stopPropagation>
    <Portrait {creature} />
</td>
<td class="name-container">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        class="name-holder"
        on:click|stopPropagation={(evt) => {
            dispatch("open-combatant", { creature, newLeaf: evt.ctrlKey || evt.metaKey });
        }}
        on:mouseenter={tryHover}
        on:mouseleave={cancelHover}
    >
        {#if creature.hidden}
            <div class="centered-icon" use:hiddenIcon />
        {/if}
        {#if creature.friendly}
            <div class="centered-icon" use:friendlyIcon />
        {/if}
        {#if creature.player}
            <strong class="name player">{creature.name}</strong>
        {:else}
            <span class="name">{name()}</span>
        {/if}
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="statuses" on:click={(e) => e.stopPropagation()}>
        {#if statuses.size}
            {#each [...statuses] as status}
                <Status
                    {status}
                    on:remove={() => {
                        tracker.updateCreatures({
                            creature,
                            change: { remove_status: [status] }
                        });
                    }}
                />
            {/each}
        {/if}
    </div>
</td>

<td
    class="center hp-container creature-adder"
    class:mobile={Platform.isMobile}
    on:click|stopPropagation={(evt) => {
        const prev = $updateTarget;
        $updateTarget = "hp";
        if (prev == "ac") return;
        tracker.setUpdate(creature, evt);
    }}
>
    <div class="hp-cell">
        <div>
            {@html creature.hpDisplay}
        </div>
        {#if creature.ddbCharacterId != null}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
                class="ddb-linked"
                aria-label={`D&D Beyond ID: ${creature.ddbCharacterId}`}
                use:ddbLinkIcon
                on:click|stopPropagation
            />
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
                class="ddb-refresh"
                class:spinning={ddbLoading}
                aria-label={ddbLoading
                    ? "Syncing HP from D&D Beyond…"
                    : "Refresh HP from D&D Beyond"}
                use:ddbIcon
                on:click|stopPropagation={refreshFromDDB}
            />
        {/if}
    </div>
</td>

<td
    class="center ac-container creature-adder"
    class:mobile={Platform.isMobile}
    on:click|stopPropagation={(evt) => {
        const prev = $updateTarget;
        $updateTarget = "ac";
        if (prev == "hp") return;
        tracker.setUpdate(creature, evt);
    }}
>
    <div
        class:dirty-ac={creature.current_ac != creature.ac}
        aria-label={creature.current_ac != creature.ac ? `${creature.ac}` : ""}
    >
        {creature.current_ac ? creature.current_ac : DEFAULT_UNDEFINED}
    </div>
</td>

<td class="controls-container">
    <CreatureControls
        on:click={(e) => e.stopPropagation()}
        on:tag
        on:edit
        on:hp
        {creature}
    />
</td>

<style scoped>
    .name-holder {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: small;
    }
    .centered-icon {
        display: flex;
        align-items: center;
    }
    .name {
        display: block;
        text-align: left;
        background-color: inherit;
        border: 0;
        padding: 0;
        height: unset;
        word-break: keep-all;
    }
    .center {
        text-align: center;
    }
    .creature-adder {
        cursor: pointer;
    }

    .statuses {
        display: flex;
        flex-flow: row wrap;
        column-gap: 0.25rem;
    }

    .initiative-container {
        border-top-left-radius: 0.25rem;
        border-bottom-left-radius: 0.25rem;
        position: relative;
    }
    .band-stripe::before {
        content: "";
        position: absolute;
        left: 0;
        top: 4px;
        bottom: 4px;
        width: 4px;
        background-color: var(--band-color);
        border-radius: 2px;
    }
    .portrait-container {
        padding: 0 0.25rem;
        vertical-align: middle;
    }
    .controls-container {
        border-top-right-radius: 0.25rem;
        border-bottom-right-radius: 0.25rem;
    }
    .dirty-ac {
        font-weight: var(--font-bold);
    }
    .mobile {
        font-size: smaller;
    }
    .hp-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
    }
    .ddb-refresh {
        display: flex;
        align-items: center;
        cursor: pointer;
        color: var(--text-muted);
    }
    .ddb-refresh:hover {
        color: var(--text-normal);
    }
    .ddb-linked {
        display: flex;
        align-items: center;
        color: var(--text-accent);
    }
    .ddb-linked :global(svg) {
        width: 13px;
        height: 13px;
    }
    .ddb-refresh :global(svg) {
        width: 14px;
        height: 14px;
    }
    .spinning :global(svg) {
        animation: ddb-spin 0.8s linear infinite;
    }
    @keyframes ddb-spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
