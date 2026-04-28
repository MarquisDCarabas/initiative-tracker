<script lang="ts">
    import { getContext } from "svelte";
    import type InitiativeTracker from "src/main";
    import type { Creature } from "src/utils/creature";
    import { getCreatureImageUrl, getInitialsForPortrait } from "src/utils";

    export let creature: Creature;

    const plugin = getContext<InitiativeTracker>("plugin");

    $: url = plugin ? getCreatureImageUrl(plugin, creature) : null;
    $: initials = getInitialsForPortrait(creature.getName());
</script>

<div class="initiative-tracker-portrait" aria-label={creature.getName()}>
    {#if url}
        <img src={url} alt={creature.getName()} />
    {:else}
        <span class="initials">{initials}</span>
    {/if}
</div>

<style scoped>
    .initiative-tracker-portrait {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--background-modifier-border);
        color: var(--text-muted);
        font-size: 0.75rem;
        font-weight: 600;
        flex-shrink: 0;
    }
    .initiative-tracker-portrait img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    .initials {
        user-select: none;
    }
</style>
