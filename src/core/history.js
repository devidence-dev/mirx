/** Records immutable annotation snapshots, one entry per completed action. */
export class CommandHistory {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
    }

    snapshot(value) {
        return JSON.parse(JSON.stringify(value));
    }

    commit(before, value) {
        const after = this.snapshot(value);
        if (JSON.stringify(before) === JSON.stringify(after)) return false;
        this.undoStack.push({before: this.snapshot(before), after});
        this.redoStack = [];
        return true;
    }

    undo() {
        const command = this.undoStack.pop();
        if (!command) return null;
        this.redoStack.push(command);
        return this.snapshot(command.before);
    }

    redo() {
        const command = this.redoStack.pop();
        if (!command) return null;
        this.undoStack.push(command);
        return this.snapshot(command.after);
    }
}
