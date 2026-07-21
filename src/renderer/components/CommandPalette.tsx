export type CommandPaletteCommand = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
};

type CommandPaletteProps = {
  commands: CommandPaletteCommand[];
  onClose: () => void;
};

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const availableCommands = commands.filter((command) => !command.disabled);

  return (
    <div className="command-palette-backdrop" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-header">
          <strong>Command palette</strong>
          <span>{availableCommands.length} available commands</span>
        </div>
        <div className="command-list">
          {commands.map((command) => (
            <button
              key={command.id}
              disabled={command.disabled}
              onClick={() => {
                command.run();
                onClose();
              }}
            >
              <span>{command.label}</span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
