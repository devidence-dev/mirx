# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Cursor mark at the guides' intersection

The system SHALL draw a small translucent grey disc with a thin grey cross through its centre at the point where the guides cross; the cross SHALL extend beyond the disc. The mark SHALL use the same point, monitor and visibility as the guides and magnifier, stay sharp on the physical pixel grid, and be clipped to the monitor under the cursor.

#### Scenario: Mark follows the cursor
- **GIVEN** the guides are visible
- **WHEN** the user moves the cursor
- **THEN** the disc and its cross are centred on the guides' intersection
- **AND** they stay recognizable over light and dark content

#### Scenario: Mark hides with the guides
- **WHEN** the guides hide because a selection is completed, an annotation tool or text edit is active, an export is running, no monitor is under the cursor, or the editor closes
- **THEN** no cursor mark remains visible

#### Scenario: Mark near monitor edges and across scales
- **GIVEN** a monitor at 100%, 200% or approximately 133% scaling
- **WHEN** the cursor is at a corner or edge of that monitor
- **THEN** the mark stays centred on the intersection and no part of it is drawn outside that monitor

#### Scenario: Mark is inert and never exported
- **WHEN** the user clicks or drags at a position covered by the mark, or copies or saves the capture
- **THEN** the editor receives the same input as without the mark
- **AND** the copied or saved image contains no mark
- **AND** if the image capture fails, the mark's prior visibility is restored

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
