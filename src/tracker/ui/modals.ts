import {
    App,
    FuzzySuggestModal,
    Modal,
    Setting,
    type FuzzyMatch
} from "obsidian";
import type { Creature } from "src/utils/creature";
import type { Condition } from "src/types/creatures";

/**
 * Picks one creature from a list ordered by initiative.
 * Pressing 1-9 in the input selects that index in the visible list (best-effort).
 */
export class CreaturePickModal extends FuzzySuggestModal<Creature> {
    constructor(
        app: App,
        private creatures: Creature[],
        private placeholderText: string,
        private onChoose: (creature: Creature | null) => void
    ) {
        super(app);
        this.setPlaceholder(placeholderText);
        this.setInstructions([
            { command: "↑↓", purpose: "navigate" },
            { command: "↵", purpose: "select" },
            { command: "1-9", purpose: "quick-pick" },
            { command: "esc", purpose: "cancel" }
        ]);
        this.scope.register([], "1", () => this.quickPick(0));
        this.scope.register([], "2", () => this.quickPick(1));
        this.scope.register([], "3", () => this.quickPick(2));
        this.scope.register([], "4", () => this.quickPick(3));
        this.scope.register([], "5", () => this.quickPick(4));
        this.scope.register([], "6", () => this.quickPick(5));
        this.scope.register([], "7", () => this.quickPick(6));
        this.scope.register([], "8", () => this.quickPick(7));
        this.scope.register([], "9", () => this.quickPick(8));
    }
    private quickPick(index: number) {
        if (index < this.creatures.length) {
            const pick = this.creatures[index];
            this.close();
            this.onChoose(pick);
        }
    }
    getItems(): Creature[] {
        return this.creatures;
    }
    getItemText(creature: Creature): string {
        const idx = this.creatures.indexOf(creature);
        const prefix = idx < 9 ? `${idx + 1}. ` : "";
        return `${prefix}${creature.getName()}`;
    }
    onChooseItem(creature: Creature): void {
        this.onChoose(creature);
    }
    onClose() {
        super.onClose?.();
    }
}

/**
 * Prompts for an integer amount. Resolves with the number on submit, or null on cancel.
 */
export class AmountModal extends Modal {
    private amount: string = "";
    private submitted = false;

    constructor(
        app: App,
        private title: string,
        private onSubmit: (amount: number | null) => void
    ) {
        super(app);
    }

    onOpen(): void {
        this.titleEl.setText(this.title);
        const { contentEl } = this;
        contentEl.empty();

        let inputEl: HTMLInputElement | null = null;

        new Setting(contentEl)
            .setName("Amount")
            .addText((t) => {
                inputEl = t.inputEl;
                t.setPlaceholder("e.g. 12");
                t.inputEl.type = "number";
                t.inputEl.inputMode = "numeric";
                t.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        this.submit();
                    }
                });
                t.onChange((v) => (this.amount = v));
            });

        new Setting(contentEl)
            .addButton((b) =>
                b.setButtonText("Cancel").onClick(() => {
                    this.close();
                })
            )
            .addButton((b) =>
                b.setButtonText("Apply").setCta().onClick(() => this.submit())
            );

        // Focus the input on open.
        window.setTimeout(() => inputEl?.focus(), 0);
    }

    private submit() {
        const n = Number(this.amount);
        if (!Number.isFinite(n) || n === 0) {
            this.close();
            return;
        }
        this.submitted = true;
        this.onSubmit(n);
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.submitted) this.onSubmit(null);
    }
}

export class ConditionPickModal extends FuzzySuggestModal<Condition> {
    constructor(
        app: App,
        private conditions: Condition[],
        private onChoose: (condition: Condition | null) => void
    ) {
        super(app);
        this.setPlaceholder("Apply condition…");
    }
    getItems(): Condition[] {
        return this.conditions;
    }
    getItemText(condition: Condition): string {
        return condition.name;
    }
    onChooseItem(condition: Condition): void {
        this.onChoose(condition);
    }
}
