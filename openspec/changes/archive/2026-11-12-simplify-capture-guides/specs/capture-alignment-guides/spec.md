# Spec Delta

## MODIFIED Requirements

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
