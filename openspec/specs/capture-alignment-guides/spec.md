# capture-alignment-guides Specification

## Purpose

Help align the edges of a capture with screen elements using dotted guides that follow the cursor and complement the magnifier's precision.

## Requirements

### Requirement: Full-screen alignment guides on the active monitor

The system SHALL show one horizontal and one vertical thin solid guide, intersecting at the screen point indicated by the cursor and magnifier. The guides SHALL extend to the edges of the monitor under the cursor, maintain contrast over light and dark backgrounds, and keep the selection point recognizable.

#### Scenario: Align before selecting
- **GIVEN** the capture editor is open, there is no selection, and the cursor is inside a monitor
- **WHEN** the user moves the cursor
- **THEN** the guides follow the point indicated by the cursor and magnifier
- **AND** the horizontal guide spans the full width and the vertical guide the full height of that monitor
- **AND** each guide is a continuous line visible over both light and dark content

#### Scenario: Preserve magnifier content
- **WHEN** the guides are visible alongside the magnifier
- **THEN** the magnification, the band crosshair and the cursor coordinates remain legible
- **AND** the guides add no scale or measurement marks

### Requirement: Visibility linked to capture selection

The system SHALL automatically show the guides in the same states as the magnifier: before selection and while creating or resizing a selection. It SHALL hide them when those gestures end with a selection in place, while annotating, editing text, during an export operation, or when there is no monitor under the cursor.

#### Scenario: Create or resize a selection
- **WHEN** the user drags to create a selection or drags one of its handles
- **THEN** the guides and magnifier remain visible and follow the cursor

#### Scenario: Finish a selection
- **WHEN** the user finishes creating or resizing a selection, or selects a window or monitor
- **THEN** the guides hide along with the magnifier

#### Scenario: Annotate or move an existing selection
- **GIVEN** a selection exists
- **WHEN** the user chooses an annotation tool or Select and move, edits text, or moves the selection from its interior with Select and move
- **THEN** the guides remain hidden

#### Scenario: No monitor or capture session closed
- **WHEN** the cursor is outside all monitors or the capture editor closes
- **THEN** no guide remains visible

### Requirement: Alignment with scaling and multiple monitors

The system SHALL keep the guides aligned with the pixel indicated by the magnifier at integer and fractional scaling. It SHALL clip the guides to the monitor under the cursor and update their extent and scale when the monitor changes, without changing the existing selection bounds.

#### Scenario: Integer and fractional scaling
- **GIVEN** a monitor at 100%, 200%, or approximately 133% fractional scaling
- **WHEN** the cursor moves across fractional positions or near the monitor edges
- **THEN** the guides remain aligned with the pixel indicated by the magnifier and keep a sharp stroke
- **AND** no part of the guides is drawn outside that monitor

#### Scenario: Change monitors before selecting
- **GIVEN** two monitors with different scales or offsets
- **WHEN** the cursor moves from one to the other before selection
- **THEN** the guides span only the monitor that now contains the cursor
- **AND** no guides remain on the previous monitor

#### Scenario: Drag onto another monitor
- **GIVEN** a selection is being created or resized within one monitor
- **WHEN** the cursor moves to another monitor
- **THEN** the guides follow the cursor onto that other monitor, just like the magnifier
- **AND** the selection remains limited to the monitor where it began

### Requirement: Decorations do not affect interaction or export

The guides SHALL be a visual aid only: they SHALL NOT modify the selection or annotations, intercept input events, or appear in copied or saved images. If image capture fails, the system SHALL restore the guides' prior visibility when applicable.

#### Scenario: Interact through the guides
- **WHEN** the user clicks or drags at a position crossed by a guide
- **THEN** the editor or control receives the same interaction as it would without guides
- **AND** the guide does not create annotations or alter input coordinates

#### Scenario: Copy or save an image
- **WHEN** the user copies a capture or saves it as PNG or JPG
- **THEN** the image contains the selection and its annotations without any guide

#### Scenario: Recover the interface after a capture failure
- **GIVEN** the guides were visible or hidden before image capture began
- **WHEN** that capture fails
- **THEN** the interface restores the guides' prior visibility and allows the session to continue

### Requirement: Cursor mark at the guides' intersection

The system SHALL draw a compact thin cross without a disc, circular outline or filled backing where the guides cross. The cross SHALL span at most 21 logical stage units per axis, excluding a narrow contrast outline. It SHALL use the guides' and magnifier's point, monitor and visibility, stay sharp on the physical pixel grid, and be clipped to that monitor. While the mark is visible, a platform crosshair SHALL NOT be superimposed on it; other interaction cursors SHALL retain their normal behavior.

#### Scenario: Mark follows the cursor
- **GIVEN** the guides are visible
- **WHEN** the user moves the cursor
- **THEN** a compact cross is centred on the guides' intersection
- **AND** its stroke remains recognizable over light and dark content
- **AND** content between the arms remains visible without a disc or circular outline

#### Scenario: Mark hides with the guides
- **WHEN** the guides hide because a selection is completed, an annotation tool or text edit is active, an export is running, no monitor is under the cursor, or the editor closes
- **THEN** no cursor mark remains visible

#### Scenario: Mark near monitor edges and across scales
- **GIVEN** a monitor at 100%, 200% or approximately 133% scaling
- **WHEN** the cursor is at a corner or edge of that monitor
- **THEN** the mark stays centred on the intersection and no part of it is drawn outside that monitor
- **AND** its thin strokes remain aligned with the physical pixel grid and its logical span remains within the size limit

#### Scenario: Mark follows a monitor change
- **GIVEN** two monitors with different scales or offsets
- **WHEN** the cursor moves from one monitor to the other, before selection or during a selection drag
- **THEN** the cross follows the guides and magnifier onto the new monitor without a mark remaining on the previous monitor
- **AND** a selection drag stays limited to its starting monitor

#### Scenario: Mark is inert and never exported
- **WHEN** the user clicks or drags at a position covered by the mark, or copies or saves the capture
- **THEN** the editor receives the same input as without the mark
- **AND** the copied or saved image contains no mark
- **AND** if the image capture fails, the mark's prior visibility is restored

#### Scenario: Only one capture crosshair
- **GIVEN** the capture aids are visible on the monitor under the pointer
- **WHEN** the user points or drags to create a capture selection
- **THEN** the user sees the single thin cross drawn by Mirx without a platform crosshair superimposed on it
- **AND** the coordinate format, styling and placement remain unchanged

#### Scenario: Preserve normal cursors and restore on transitions
- **WHEN** the pointer is over a control, text, a resize handle or a movable object
- **THEN** its normal pointer, text, resize or move cursor remains available
- **WHEN** the custom mark hides because the editor is busy, text editing starts, there is no monitor under the pointer, or the capture editor closes
- **THEN** cursor suppression does not persist beyond the custom-mark state

### Requirement: Cursor coordinates next to the cursor

The system SHALL show the cursor's stage coordinates next to the cursor mark, labelled `x:` above `y:`, in white text on a small dark translucent rounded background. The label SHALL follow the guides' visibility, stay inside the monitor under the cursor by moving to the other side near its right or bottom edge, never overlap the magnifier, and never be exported.

#### Scenario: Coordinates follow the cursor
- **GIVEN** the guides are visible
- **WHEN** the cursor rests at stage position 99.6, 49.9
- **THEN** the label shows `x: 99` above `y: 49`, below and to the right of the cursor mark
- **AND** it is legible over light and dark content

#### Scenario: Near the monitor edge
- **WHEN** the cursor is close to the right or bottom edge of its monitor
- **THEN** the label moves to the left of or above the cursor and stays fully inside that monitor

#### Scenario: Hidden and excluded with the guides
- **WHEN** the guides hide, or the user copies or saves the capture
- **THEN** no coordinates label is visible and the image contains none
