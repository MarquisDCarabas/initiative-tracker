> 🥇 Our documentation has moved ***[here](https://plugins.javalent.com/it)***.
>
> <a href='https://www.buymeacoffee.com/valentine195' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
---

The Initiative Tracker plugin for **[Obsidian](https://obsidian.md)** allows you to keep track of initiative and turn order during combat encounters in tabletop role-playing games.

With this plugin, you can add creatures and NPCs to the initiative tracker, and track their health, armor class, and other stats. The plugin also calculates experience points for creatures, and supports both custom and SRD creatures from the **[Fantasy Statblocks](https://github.com/javalent/fantasy-statblocks)** plugin.

## Features
- Add and remove creatures from the encounter
- Input creature name, HP, AC and initiative
- Calculate creature XP based on level or challenge rating
- Group identical creatures together to simplify the encounter
- Set creature display names to differentiate identical creatures
- Supports dice rolls to add random amount creatures
- Keep track of creature HP, AC and status
- Sort creatures by initiative automatically
- Add several encounters in one code block
- Automatically save and load encounters
- And much, much more...

## Fork additions

This fork adds a few features that aren't covered by the [upstream documentation](https://plugins.javalent.com/it).

### Creature portraits

Combatants display a circular portrait next to their name in both the main tracker and the Player View. The image is read from YAML frontmatter on the creature's linked note — `token:` is preferred (typically a face crop), with `image:` as a fallback (matches Fantasy Statblocks). Wikilinks (`[[my-image.png]]`), vault paths, and absolute URLs all work. If neither field is set, a circle with the creature's initials is shown instead. Portrait dimensions scale with the row's font-size, so they grow alongside the text in the Player View.

### Initiative bands

Creatures who act as a unit can be grouped into a *band*. Adjacent rows in the initiative order sharing the same band get a colored left stripe and a softer background tint while the band is up; the active turn marker still moves within the band as you progress.

- **Apply Initiative Bands** (toolbar button or command) auto-groups consecutive creatures of the same side (party / friendly / hostile) into bands once initiative is rolled.
- The per-creature menu adds **Merge band with above** and **Break from band** for manual edits.
- **Next Band** / **Previous Band** commands jump across whole bands instead of stepping creature-by-creature.
- A new setting, **Display Initiative Column in Player View**, hides raw initiative numbers — useful when you're running pure band order and don't want individual values visible to players.

### Auto-fit Player View

The Player View now scales font-size and portrait dimensions to fill the available height. Fewer combatants render larger; more combatants render smaller. When the list won't fit even at the minimum readable size (16px), the view scrolls and auto-centers on the active row whenever the turn changes — useful for projection displays the GM doesn't see directly.

### Quickstart

- Install the Initiative Tracker plugin in Obsidian.
- Open a note where you want to keep track of your encounter.
- Create a code block with the language set to \`\`\`encounter.

````yaml
```encounter
name: Example
creatures:
 - 3: Goblin
```
````

- Add creatures to the encounter by name, dice roll or bestiary entry.
- Launch the encounter by clicking on the play button, and start tracking initiative.

Check out the **[plugin documentation](https://plugins.javalent.com/it)** for more detailed instructions and examples.

## Support

If you encounter any issues, want to give back and help out, or have suggestions for new features, file an issue on the **[GitHub repository](https://github.com/valentine195/obsidian-initiative-tracker/issues)**.

### TTRPG plugins

If you're using Obsidian to run/plan a TTRPG, you may find my other plugins useful:

- **[Obsidian Leaflet](https://github.com/valentine195/obsidian-leaflet-plugin)** Adds interactive maps to Obsidian notes
- **[Dice Roller](https://github.com/valentine195/obsidian-dice-roller)** Inline dice rolling for Obsidian
- **[Fantasy Statblocks](https://github.com/valentine195/obsidian-5e-statblocks)** Format Statblocks inside Obsidian
