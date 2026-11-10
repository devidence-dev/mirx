## Purpose

Defines the on-canvas feedback of the capture editor: which mouse cursor shows over each region, and how the selection frame and handles look and where they can be grabbed, so the pointer always shows what a press would do.

## ADDED Requirements

### Requirement: The cursor shows what a press would do

At any pointer position the cursor SHALL match the result of a primary press there: a hand over toolbar buttons, a resize cursor over a handle, a move cursor over things that Select and move can move, a crosshair where a selection or drawing would start, a text cursor where text would start, and the default arrow where a press does nothing. The cursor SHALL update after a tool change, a hotkey, a selection change or a toolbar move, without needing pointer movement.

#### Scenario: Hotkey changes the cursor without movement
- **GIVEN** a selection exists, the select tool is active and the pointer rests inside the selection
- **WHEN** I press R
- **THEN** the cursor becomes a crosshair without moving the pointer

#### Scenario: Pointer leaves a button
- **GIVEN** the pointer is over a toolbar button
- **WHEN** it moves onto the selection
- **THEN** the cursor changes from the hand to the one for that region

### Requirement: The hand cursor shows over toolbar controls

The pointer SHALL show a hand cursor over every enabled toolbar button and swatch. Over the toolbar background and dividers it SHALL show the default arrow. Over the text being edited it SHALL show the text cursor.

#### Scenario: Over a button
- **WHEN** the pointer moves over the rectangle button
- **THEN** the cursor is a hand

#### Scenario: Over a swatch
- **WHEN** the pointer moves over a colour swatch
- **THEN** the cursor is a hand

#### Scenario: Over the toolbar background
- **WHEN** the pointer moves over the gap between two groups
- **THEN** the cursor is the default arrow

#### Scenario: Over a text being edited
- **GIVEN** a text annotation is being edited
- **WHEN** the pointer moves over its box
- **THEN** the cursor is the text cursor

### Requirement: Selection handles show resize cursors

Over each of the eight selection handles, the cursor SHALL be the resize cursor for that handle: north-south for the top and bottom handles, east-west for the left and right handles, north-west to south-east for the top-left and bottom-right corners, north-east to south-west for the top-right and bottom-left corners. This SHALL hold while idle and with any tool, in the same area where a press starts a resize.

#### Scenario: Eight handles
- **GIVEN** a selection exists
- **WHEN** the pointer moves over each handle in turn
- **THEN** the cursor is north-south on top and bottom, east-west on left and right, north-west to south-east on top-left and bottom-right, and north-east to south-west on top-right and bottom-left

#### Scenario: Handle with a drawing tool active
- **GIVEN** the rectangle tool is active
- **WHEN** the pointer is over the bottom-right handle, outside the selection interior
- **THEN** the cursor is the resize cursor, and pressing starts a resize

#### Scenario: Cursor matches the press
- **WHEN** the pointer is just outside the handle hit area
- **THEN** the cursor is not a resize cursor, and a press there does not start a resize

### Requirement: Idle shows the arrow, except on handles

While idle (no tool chosen), the cursor SHALL be the default arrow inside the selection and over annotations, because a press there does nothing. Over a selection handle it SHALL be that handle's resize cursor. Before a selection exists it SHALL stay a crosshair.

#### Scenario: Idle inside the selection or over an annotation
- **GIVEN** no tool is chosen
- **WHEN** the pointer is inside the selection or over an annotation, off every handle
- **THEN** the cursor is the default arrow and a press does nothing

#### Scenario: Idle over a handle
- **GIVEN** no tool is chosen
- **WHEN** the pointer is over a selection handle
- **THEN** the cursor is that handle's resize cursor and a press starts a resize

#### Scenario: Choosing select/move changes the cursor
- **GIVEN** no tool is chosen and the pointer rests inside the selection
- **WHEN** I press V
- **THEN** the cursor becomes the move cross without moving the pointer

### Requirement: Movable things show the move cursor

With the select/move tool, the cursor SHALL be the move cross over an annotation that a press would select and move, and over the empty interior of the selection. Over the handle of a selected annotation it SHALL be that handle's resize cursor, or the move cross for an arrow endpoint. Outside the selection it SHALL be the default arrow.

#### Scenario: Inside the selection
- **GIVEN** the select/move tool is active and no annotation is under the pointer
- **WHEN** the pointer is inside the selection
- **THEN** the cursor is the move cross

#### Scenario: Over an annotation
- **GIVEN** the select/move tool is active
- **WHEN** the pointer is over a rectangle outline, an arrow or a marker
- **THEN** the cursor is the move cross

#### Scenario: Inside a rectangle outline but not on it
- **GIVEN** the select/move tool is active and a rectangle outline is drawn
- **WHEN** the pointer is in the hollow middle of the rectangle
- **THEN** the cursor is the move cross because a press would move the selection

#### Scenario: Outside the selection
- **GIVEN** a selection exists
- **WHEN** the pointer is outside it, off every handle
- **THEN** the cursor is the default arrow

#### Scenario: Arrow endpoint
- **GIVEN** an arrow is selected
- **WHEN** the pointer is over its tail or head
- **THEN** the cursor is the move cross

### Requirement: Drawing and choosing show a crosshair or a text cursor

Before a selection exists, and while a selection is being dragged, the cursor SHALL be a crosshair. With a drawing tool active, it SHALL be a crosshair inside the selection. With the text tool active it SHALL be the text cursor inside the selection. With any tool active, it SHALL be the default arrow outside the selection.

#### Scenario: Choosing an area
- **GIVEN** the overlay is open with no selection
- **WHEN** the pointer moves over the screen
- **THEN** the cursor is a crosshair

#### Scenario: Drawing tool
- **GIVEN** the ellipse tool is active
- **WHEN** the pointer is inside the selection
- **THEN** the cursor is a crosshair

#### Scenario: Text tool
- **GIVEN** the text tool is active
- **WHEN** the pointer is inside the selection
- **THEN** the cursor is the text cursor

#### Scenario: Tool active, pointer outside
- **GIVEN** the arrow tool is active
- **WHEN** the pointer is outside the selection and off every handle
- **THEN** the cursor is the default arrow

### Requirement: The cursor is fixed during a drag

While a drag is in progress, the cursor SHALL stay the one of the gesture: the resize cursor of the dragged handle, the move cross while moving the selection or an annotation, and the crosshair while choosing a selection or drawing. It SHALL NOT change when the pointer crosses the toolbar or another region.

#### Scenario: Resize across the toolbar
- **GIVEN** I am dragging the south-east handle
- **WHEN** the pointer passes over the toolbar
- **THEN** the cursor stays north-west to south-east and the toolbar receives no click

#### Scenario: Moving an annotation
- **GIVEN** I am dragging an annotation
- **WHEN** the pointer moves anywhere
- **THEN** the cursor is the move cross until I release

#### Scenario: After release
- **WHEN** I release the button
- **THEN** the cursor follows the region under the pointer again

### Requirement: The selection frame is thick and legible on any content

The selection frame SHALL be 2 px wide, in blue, with a thin dark ring on its outer side, so it reads over light and dark content. It SHALL be hidden in exported images.

#### Scenario: Dark content
- **GIVEN** the selection lies over dark content
- **WHEN** the frame is drawn
- **THEN** the blue frame is clearly visible

#### Scenario: Light content
- **GIVEN** the selection lies over a white window
- **WHEN** the frame is drawn
- **THEN** the dark ring keeps the frame distinguishable

#### Scenario: Frame width
- **WHEN** the frame is drawn at 100% scale
- **THEN** its blue part is 2 px wide

#### Scenario: Not exported
- **WHEN** I export the capture
- **THEN** the image contains no blue frame and no dark ring

### Requirement: Handles are round, visible and easy to grab

Selection handles and annotation handles SHALL be 10 px white circles with a blue border and a soft shadow, centred on the point they control. Every handle SHALL be grabbable within at least 16 px around its centre, and the cursor and the press SHALL use the same area.

#### Scenario: Handle look
- **GIVEN** a selection exists
- **WHEN** the handles are shown
- **THEN** each is a 10 px white circle with a blue border and a soft shadow, centred on a corner or edge midpoint

#### Scenario: Grab near the handle
- **WHEN** I press 7 px from a handle centre horizontally and vertically
- **THEN** the handle is grabbed

#### Scenario: Annotation handles
- **GIVEN** a rectangle is selected with the select tool
- **WHEN** its handles are shown
- **THEN** they look like the selection handles and have the same grab area

#### Scenario: Handles hidden in exports
- **WHEN** I export the capture
- **THEN** no handle appears in the image

#### Scenario: Overlapping handles on a tiny selection
- **GIVEN** the selection is smaller than 16 px wide
- **WHEN** the pointer is between two handle centres
- **THEN** the nearer handle is grabbed and shows its resize cursor
