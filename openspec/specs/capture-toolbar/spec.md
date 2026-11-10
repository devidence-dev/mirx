# capture-toolbar Specification

## Purpose

Defines the editing toolbar shown beside the capture selection: its two-row layout, icons, tooltips, tool hotkeys, primary action, scaling and glass look, and its exclusion from exported images.

## Requirements

### Requirement: The toolbar has two rows of separated groups

While a selection exists, the toolbar SHALL show two rows. Row 1 SHALL hold the tools in this order: select/move, arrow, rectangle, ellipse, numbered marker, highlighter, pixelate, text; then undo and redo. Row 2 SHALL hold seven colour swatches, then width decrease, the width value and width increase, then the gradient toggle, then the actions. Adjacent groups SHALL be 12 px apart with a 1 px divider between them. Controls inside a group SHALL be 4 px apart.

#### Scenario: Row 1 content and order
- **GIVEN** a selection exists
- **WHEN** the toolbar is shown
- **THEN** row 1 lists select/move, arrow, rectangle, ellipse, numbered marker, highlighter, pixelate and text, then undo and redo
- **AND** a divider separates the tools from undo and redo

#### Scenario: Row 2 content and order
- **GIVEN** a selection exists
- **WHEN** the toolbar is shown
- **THEN** row 2 lists seven colour swatches, width decrease, the width value, width increase, the gradient toggle, and the actions, with a divider between each pair of adjacent groups

#### Scenario: Spacing
- **WHEN** the toolbar is shown
- **THEN** two controls of one group are 4 px apart and the last control of a group is 12 px from the first control of the next group, with a 1 px divider between them

#### Scenario: No persistent tool label
- **WHEN** the pointer rests over no control
- **THEN** the toolbar shows no text line under the tools

### Requirement: Controls are large, round-cornered and show their state

Tool, undo, redo, width, gradient and Cancel buttons SHALL be 36 px square with 18 px icons. Colour swatches SHALL be exact 28 px circles. The width value SHALL be shown as text between its two buttons. A tool button SHALL look checked exactly when it is the editor's current tool, so none does when the capture opens. The current colour and an enabled gradient toggle SHALL look checked, and hover, pressed and disabled states SHALL differ from the normal state.

#### Scenario: Control sizes
- **WHEN** the toolbar is shown on a 100% monitor
- **THEN** each icon button measures 36 × 36 px with an 18 px icon and each swatch measures 28 × 28 px

#### Scenario: Active tool and colour are marked
- **GIVEN** the rectangle tool and the blue swatch are current
- **WHEN** the toolbar updates
- **THEN** the rectangle button and the blue swatch look checked and no other tool or swatch does

#### Scenario: Swatches are circles
- **WHEN** the toolbar is shown
- **THEN** each swatch has equal width and height of 28 px and a corner radius of 14 px, so none looks like a rounded rectangle or a pill

#### Scenario: No tool highlighted at start
- **WHEN** a new capture opens and a selection exists
- **THEN** no tool button looks checked and the editor is idle: dragging inside the selection does nothing and annotations cannot be selected or moved, while the eight selection handles still resize the selection

#### Scenario: Select/move is checked only when chosen
- **GIVEN** no tool button looks checked
- **WHEN** I click select/move or press V
- **THEN** select/move looks checked, dragging inside the selection moves it, and annotations can be selected, moved and resized
- **AND** choosing arrow instead unchecks select/move and checks arrow

#### Scenario: Hover and pressed feedback
- **WHEN** the pointer moves over a button and I press it
- **THEN** the button looks different when hovered and again when pressed

### Requirement: Idle and Select and move are different editor states

While idle (no tool), only the eight selection handles SHALL act inside a completed selection: they resize it. Moving the selection, and selecting, moving, resizing, restyling or deleting an annotation, SHALL require the Select and move tool. Drawing tools SHALL behave as before. Choosing any tool, including idle, SHALL clear the annotation selection.

#### Scenario: Idle drag inside does nothing
- **GIVEN** a selection with annotations exists and no tool is chosen
- **WHEN** I drag inside the selection or on an annotation
- **THEN** the selection does not move and no annotation is selected or moved

#### Scenario: Idle handle still resizes
- **GIVEN** no tool is chosen
- **WHEN** I drag a selection handle
- **THEN** the selection is resized

#### Scenario: Select and move enables editing
- **GIVEN** no tool is chosen
- **WHEN** I press V and drag inside the selection
- **THEN** the selection moves, and a click on an annotation selects it

#### Scenario: Keyboard nudge in idle
- **GIVEN** no tool is chosen and a selection exists
- **WHEN** I press an arrow key
- **THEN** the selection moves by one step

#### Scenario: Other shortcuts do not depend on the tool
- **WHEN** no tool is chosen, or any tool
- **THEN** choosing an area, window or monitor before a selection, Ctrl+A, undo, redo, Enter and Escape work as before, and Delete acts only on a selected annotation, which needs Select and move

### Requirement: Icons form one symbolic set with a clear select/move icon

Every tool, undo, redo, width, gradient and Cancel icon SHALL come from one shipped set drawn on a 16 × 16 grid with filled shapes only, so the Shell recolours them like text. The select/move tool SHALL use a four-way move-arrows icon. No control SHALL use a text glyph as its icon.

#### Scenario: Select/move icon
- **WHEN** the toolbar is shown
- **THEN** the select/move button shows a four-way arrows icon and no ↖ glyph

#### Scenario: Icons follow the control colour
- **WHEN** a button is hovered, checked or disabled
- **THEN** its icon takes the foreground colour of that state

### Requirement: Tooltips show the name and the shortcut

Hovering or keyboard-focusing a toolbar control for 300 ms SHALL show a tooltip formatted as `Name (Shortcut)`, for example `Rectangle (R)` or `Undo (Ctrl+Z)`. A control without a shortcut SHALL show its name only. The tooltip SHALL fade in over about 150 ms and out over about 100 ms, stay on the screen of the toolbar and never take input.

#### Scenario: Tool tooltip
- **WHEN** the pointer rests on the rectangle button for 300 ms
- **THEN** a tooltip reads `Rectangle (R)`

#### Scenario: Action tooltips
- **WHEN** the pointer rests on undo, redo and Cancel
- **THEN** the tooltips read `Undo (Ctrl+Z)`, `Redo (Ctrl+Shift+Z)` and `Cancel (Esc)`

#### Scenario: Control without a shortcut
- **WHEN** the pointer rests on a colour swatch for 300 ms
- **THEN** the tooltip shows only the colour name, such as `Red`

#### Scenario: No tooltip for a quick pass
- **WHEN** the pointer crosses a button and leaves within 300 ms
- **THEN** no tooltip appears

#### Scenario: Tooltip near a screen edge
- **GIVEN** the toolbar sits at the edge of the monitor
- **WHEN** a tooltip is shown for the nearest button
- **THEN** the tooltip lies fully inside that monitor

### Requirement: Tooltips end cleanly and are never exported

A tooltip SHALL hide when the pointer leaves its control, when a control is pressed, when a key is pressed, when the toolbar hides, when an export starts and when the capture closes. A pending tooltip timer SHALL NOT fire after any of these. The tooltip SHALL NOT appear in any exported image.

#### Scenario: Pointer leaves
- **GIVEN** a tooltip is visible
- **WHEN** the pointer leaves the button
- **THEN** the tooltip fades out and is hidden

#### Scenario: Click hides it
- **GIVEN** a tooltip is visible
- **WHEN** I click the button
- **THEN** the tooltip is hidden and does not reappear until the pointer re-enters

#### Scenario: Capture closes while a tooltip is pending
- **GIVEN** the pointer entered a button less than 300 ms ago
- **WHEN** the capture closes
- **THEN** no tooltip appears afterwards and no error is logged

#### Scenario: Export with a visible tooltip
- **GIVEN** a tooltip is visible
- **WHEN** I export the capture
- **THEN** neither the tooltip nor the toolbar appears in the image, and both are restored if the export fails

### Requirement: Single keys select tools

While a selection exists, pressing V, A, R, E, N, H, P or T without Ctrl, Alt or Super SHALL select, respectively, select/move, arrow, rectangle, ellipse, numbered marker, highlighter, pixelate or text. The letter SHALL match in either case. Each tooltip SHALL show its key.

#### Scenario: Select a tool by key
- **GIVEN** a selection exists and no text is being edited
- **WHEN** I press R
- **THEN** the rectangle tool becomes active and its button looks checked

#### Scenario: Case does not matter
- **GIVEN** a selection exists
- **WHEN** I press Shift+E or have Caps Lock on and press E
- **THEN** the ellipse tool becomes active

#### Scenario: Back to select/move
- **GIVEN** the arrow tool is active
- **WHEN** I press V
- **THEN** the select/move tool becomes active and its button looks checked

### Requirement: Tool keys never interfere with typing or other shortcuts

Tool keys SHALL do nothing while text is being edited, while there is no selection, during a drag, during an export, and when Ctrl, Alt or Super is held. Ctrl+A, Ctrl+C, Ctrl+S, Ctrl+Z, Ctrl+Shift+Z, Delete, Enter, Escape and the arrow keys SHALL keep their current meaning.

#### Scenario: Typing text
- **GIVEN** I am editing a text annotation
- **WHEN** I type `rectangle`
- **THEN** the characters enter the text and the tool does not change

#### Scenario: No selection
- **GIVEN** no selection exists
- **WHEN** I press R
- **THEN** nothing changes

#### Scenario: Ctrl+A still selects the monitor
- **GIVEN** the overlay is open
- **WHEN** I press Ctrl+A
- **THEN** the monitor under the pointer is selected and the arrow tool is not chosen

#### Scenario: Ctrl+Z still undoes
- **GIVEN** a selection exists
- **WHEN** I press Ctrl+Z
- **THEN** the last change is undone and the tool does not change

#### Scenario: During a drag
- **GIVEN** I am dragging an annotation
- **WHEN** I press A
- **THEN** the tool does not change

### Requirement: The Enter action is the one suggested action

The action that Enter runs, set by the `enter-action` setting (copy by default), SHALL look like the accent "suggested" button. The other action SHALL look neutral. Copy and Save SHALL be icon-only buttons using the theme icons `edit-copy-symbolic` and `document-save-symbolic`, named by their tooltips and accessible names. Cancel SHALL be a ✕ icon button with the accessible name "Cancel". At most one action SHALL look suggested.

#### Scenario: Default
- **GIVEN** `enter-action` is `copy`
- **WHEN** the toolbar is shown
- **THEN** Copy has the accent style and Save is neutral

#### Scenario: Save configured
- **GIVEN** `enter-action` is `save`
- **WHEN** the toolbar is shown
- **THEN** Save has the accent style and Copy is neutral

#### Scenario: Setting changes while the editor is open
- **GIVEN** the editor is open with Copy suggested
- **WHEN** `enter-action` changes to `save`
- **THEN** the next toolbar update shows Save as suggested and Copy as neutral

#### Scenario: Tooltips name the shortcut
- **WHEN** I hover the suggested action
- **THEN** its tooltip includes both its shortcut and Enter, such as `Copy (Ctrl+C, Enter)`, while the other action shows only its own shortcut

#### Scenario: Actions are icon buttons
- **WHEN** the toolbar is shown
- **THEN** Copy and Save are 36 × 36 px icon buttons with 18 px icons and no text, and the suggested one has the accent fill

#### Scenario: Cancel
- **WHEN** I click the ✕ button
- **THEN** the capture closes without exporting

### Requirement: The toolbar scales with the display and the text size

All toolbar sizes SHALL be logical pixels, so they grow with the monitor scale. The toolbar SHALL be clipped to the monitor by shrinking, never by growing. Labels SHALL stay unclipped when the text scaling factor is raised.

#### Scenario: 100% and 200% monitors
- **WHEN** the toolbar is shown on a 100% monitor and on a 200% monitor
- **THEN** it has the same logical size on both and twice the physical size on the 200% monitor

#### Scenario: Fractional scale of about 133%
- **WHEN** the toolbar is shown at about 133%
- **THEN** icons, dividers and the card border look crisp and not doubled

#### Scenario: Large text
- **GIVEN** the text scaling factor is 1.5
- **WHEN** the toolbar is shown
- **THEN** the width value is not clipped and the Copy and Save icons stay 18 px

#### Scenario: Small monitor
- **GIVEN** the toolbar is wider than the monitor minus 12 px
- **WHEN** it is placed
- **THEN** it shrinks uniformly to fit and stays fully on the monitor

### Requirement: Controls are accessible

Every control SHALL be at least 24 × 24 px, SHALL keep an accessible name, and SHALL show a visible focus ring while focused with the keyboard. Icons SHALL keep a contrast of at least 3:1 against the toolbar background, whatever the captured content.

#### Scenario: Focus ring
- **WHEN** I tab to a toolbar button
- **THEN** a visible ring surrounds it and differs from the hover look

#### Scenario: Accessible names
- **WHEN** the toolbar is inspected with the accessibility tree
- **THEN** every button has a non-empty name, including icon-only buttons and swatches

#### Scenario: Bright capture behind the toolbar
- **GIVEN** the toolbar lies over a pure white area of the capture
- **WHEN** the toolbar is shown
- **THEN** its icons have a contrast of at least 3:1 with the toolbar background

### Requirement: The toolbar looks like glass and has a fallback

The toolbar SHALL be a 16 px rounded card with a translucent gradient tint, a thin light border, a soft shadow and a blur of the content behind it that scales with the display scale. If the blur does not show over the frozen screenshot, or its rounded corners are visibly wrong, the toolbar SHALL use a more opaque tint without any blur and SHALL stay equally legible.

#### Scenario: Glass look
- **WHEN** the toolbar is shown over the frozen screenshot
- **THEN** content behind it is blurred and tinted, and the card has rounded corners, a light border and a shadow

#### Scenario: Blur radius follows the scale
- **WHEN** the toolbar is built on a 200% display
- **THEN** its blur radius is twice that on a 100% display

#### Scenario: Fallback
- **GIVEN** the blur is switched off
- **WHEN** the toolbar is shown
- **THEN** the card uses the opaque tint and every control is as legible as with the blur

### Requirement: The toolbar and its tooltip leave nothing behind and no pixels in exports

Exported images SHALL NOT include the toolbar, its dividers or its tooltip. When the capture closes, the toolbar, the tooltip, their timers and their signal connections SHALL be removed.

#### Scenario: Exported image
- **GIVEN** the toolbar is visible with a tooltip
- **WHEN** I copy or save the capture
- **THEN** the image holds only the selection and its annotations

#### Scenario: Close and reopen
- **WHEN** I close the capture and open it again
- **THEN** exactly one toolbar and no tooltip exists, and no timer of the old toolbar fires
