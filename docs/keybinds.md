# Keybindings

The input box is the [`ratatui-textarea`](https://crates.io/crates/ratatui-textarea) widget. Editing keys come from its default keymap; the application adds two overrides on top of it.

## Application

- `Esc`: quit the application.
- `Shift+Enter`: submit the current input. The text is rendered in the main
  content area, replacing any previous submission, and the input is cleared.

## Input box

All other keys are forwarded to the input widget. The default keymap is:

### Editing

- Printable keys: insert the character at the cursor.
- `Enter`, `Ctrl+M`: insert a newline.
- `Tab`: insert a tab.
- `Backspace`, `Ctrl+H`: delete the character before the cursor.
- `Delete`, `Ctrl+D`: delete the character at the cursor.
- `Ctrl+K`: delete from the cursor to the end of the line.
- `Ctrl+J`: delete from the cursor to the start of the line.
- `Ctrl+W`, `Alt+H`, `Alt+Backspace`: delete the word before the cursor.
- `Alt+D`, `Alt+Delete`: delete the word after the cursor.

### Cursor movement

- `Left`, `Ctrl+B`: move one character left.
- `Right`, `Ctrl+F`: move one character right.
- `Up`, `Ctrl+P`: move one line up.
- `Down`, `Ctrl+N`: move one line down.
- `Ctrl+Left`, `Alt+B`: move to the previous word.
- `Ctrl+Right`, `Alt+F`: move to the next word.
- `Ctrl+Up`, `Alt+P`, `Alt+]`: move to the previous paragraph.
- `Ctrl+Down`, `Alt+N`, `Alt+[`: move to the next paragraph.
- `Home`, `Ctrl+A`: move to the start of the line.
- `End`, `Ctrl+E`: move to the end of the line.
- `Ctrl+Alt+Up`, `Alt+<`: move to the top of the buffer.
- `Ctrl+Alt+Down`, `Alt+>`: move to the bottom of the buffer.
- `PageUp`, `Alt+V`: scroll up by one page.
- `PageDown`, `Ctrl+V`: scroll down by one page.

### Selection

Hold `Shift` while pressing a movement key to extend the selection.

### Yank buffer

The widget maintains its own internal yank buffer (independent from the system
clipboard).

- `Ctrl+C`: copy the current selection into the yank buffer.
- `Ctrl+X`: cut the current selection into the yank buffer.
- `Ctrl+Y`: paste the yank buffer at the cursor.

Operations that delete more than one character (`Ctrl+K`, `Ctrl+J`, `Ctrl+W`,
`Alt+D`, ...) also write into the yank buffer.

### History

- `Ctrl+Z`: undo.
- `Ctrl+R`: redo.

### System paste

The terminal's bracketed paste mode is enabled, so the OS-level paste
shortcut (`Ctrl+Shift+V`, `Cmd+V`, right-click, ...) inserts the pasted block
at the cursor and preserves newlines.

### Mouse

- Mouse wheel inside the input area scrolls the visible region.
