# Spec Delta

## Purpose

Help align the edges of a capture with screen elements using dotted guides that follow the cursor and complement the magnifier's precision.

## ADDED Requirements

### Requirement: Full-screen alignment guides on the active monitor

The system SHALL show one horizontal and one vertical dotted guide, intersecting at the screen point indicated by the cursor and magnifier. The guides SHALL extend to the edges of the monitor under the cursor, maintain contrast over light and dark backgrounds, and keep the selection point recognizable.

#### Scenario: Align before selecting
- **GIVEN** the capture editor is open, there is no selection, and the cursor is inside a monitor
- **WHEN** the user moves the cursor
- **THEN** the guides follow the point indicated by the cursor and magnifier
- **AND** the horizontal guide spans the full width and the vertical guide the full height of that monitor
- **AND** the dotted pattern is visible over both light and dark content

#### Scenario: Preserve magnifier content
- **WHEN** the guides are visible alongside the magnifier
- **THEN** the magnification, internal crosshair, and magnifier coordinates remain legible
- **AND** the guides add no numbers or measurement marks

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
- **WHEN** the user chooses an annotation tool, edits text, or moves the selection from its interior
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
