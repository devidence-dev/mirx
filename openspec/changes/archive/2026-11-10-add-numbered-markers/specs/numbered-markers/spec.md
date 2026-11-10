# Spec Delta

## Purpose

Let users mark an ordered sequence of points on a capture with filled circles that carry consecutive step numbers, and keep those numbers consecutive however markers are removed, restored or exported.

## ADDED Requirements

### Requirement: Place a numbered marker with one click

The system SHALL provide a numbered marker tool in the annotation toolbar. While it is active, each primary click inside the selection SHALL place one filled circle centred on the click point, labelled with the next number, starting at 1. The tool SHALL stay active after each click.

#### Scenario: Place markers in sequence
- **GIVEN** a selection exists and the marker tool is active
- **WHEN** the user clicks three different points inside the selection
- **THEN** three markers appear centred on those points, labelled 1, 2 and 3 in click order
- **AND** the marker tool is still active

#### Scenario: Click outside the selection
- **GIVEN** a selection exists and the marker tool is active
- **WHEN** the user clicks outside the selection
- **THEN** no marker is placed

#### Scenario: Selection handles stay available
- **GIVEN** the marker tool is active
- **WHEN** the user presses on a selection handle that lies outside the selection interior
- **THEN** the selection is resized and no marker is placed

#### Scenario: One click is one undoable action
- **WHEN** the user places a marker
- **THEN** a single undo removes exactly that marker

### Requirement: Markers stay consecutive in creation order

The system SHALL number markers by creation order among the markers that currently exist, so the numbers are always 1 to N without gaps. Deleting a marker, undoing its creation or redoing its removal SHALL renumber the remaining markers, and the next placed marker SHALL take the number after the highest one. Moving or restyling a marker SHALL NOT change its number.

#### Scenario: Delete a middle marker
- **GIVEN** markers 1, 2 and 3 exist
- **WHEN** the user deletes marker 2
- **THEN** the remaining markers are labelled 1 and 2, the former 3 now showing 2
- **AND** the next marker placed is labelled 3

#### Scenario: Undo and redo restore numbering
- **GIVEN** markers 1, 2 and 3 exist and marker 2 was deleted
- **WHEN** the user undoes the deletion
- **THEN** the markers are labelled 1, 2 and 3 as before the deletion
- **WHEN** the user redoes the deletion
- **THEN** the markers are labelled 1 and 2 again

#### Scenario: Undo a creation
- **GIVEN** markers 1, 2 and 3 exist
- **WHEN** the user undoes the last creation
- **THEN** markers 1 and 2 remain
- **AND** the next marker placed is labelled 3

#### Scenario: Other annotations do not affect numbers
- **GIVEN** an arrow, a text and markers 1 and 2 exist
- **WHEN** the user deletes the arrow and places a marker
- **THEN** the new marker is labelled 3

#### Scenario: Numbers across a new action after undo
- **GIVEN** the user has undone the creation of marker 3
- **WHEN** the user places a new marker
- **THEN** it is labelled 3
- **AND** redo does nothing

### Requirement: Marker appearance follows the current style

A marker SHALL be a solid circle in the colour that was current when it was placed. Its diameter SHALL grow with the width that was current when it was placed, with a minimum size that keeps one-digit numbers readable. The number SHALL be centred in the circle and drawn in white with a soft dark shadow, or in black without shadow on White and near-white markers. The number SHALL stay inside the circle for numbers of up to three digits.

#### Scenario: Colour and width apply to new markers only
- **GIVEN** the colour is Red and the width is 3 px, and a marker exists
- **WHEN** the user chooses Blue and 10 px and places another marker
- **THEN** the new marker is blue and larger than the first
- **AND** the first marker keeps its colour and size

#### Scenario: Contrasting number
- **WHEN** markers are placed with Yellow, White, Red, Blue and Black
- **THEN** the number is white with a soft shadow on Yellow, Red, Blue and Black, and black on White

#### Scenario: Large numbers fit
- **GIVEN** 100 or more markers exist
- **THEN** every number stays fully inside its circle

### Requirement: Markers are edited like other annotations

With no annotation tool active, the system SHALL let the user select a marker by clicking its circle, move it by dragging, change its colour and width while it is selected, and delete it with Delete. A selected marker SHALL be outlined by a blue ring just outside its circle, legible on light and dark content, and SHALL show no resize handles. Changing its width SHALL resize it around its centre.

#### Scenario: Select and move a marker
- **GIVEN** no annotation tool is active and a marker exists
- **WHEN** the user clicks inside its circle and drags it
- **THEN** the marker is selected, outlined by a blue ring, and moves with the pointer, keeping its number

#### Scenario: Click beside a marker
- **WHEN** the user clicks a point outside every marker's circle
- **THEN** no marker is selected

#### Scenario: Restyle a selected marker
- **GIVEN** a marker is selected
- **WHEN** the user chooses another colour or width
- **THEN** that marker takes the new colour and size, still centred on the same point
- **AND** the number colour is recomputed for the new colour

#### Scenario: Move and restyle are undoable
- **WHEN** the user moves or restyles a marker and presses undo
- **THEN** the marker returns to its previous position, colour and size

### Requirement: Markers are exported as displayed

Markers SHALL be included in PNG, JPG and clipboard exports exactly as shown on screen, with the same position, size, colour, number and contrast. A marker that extends past the selection SHALL be cropped at the selection edge. Selection state, hover and any editing decoration SHALL NOT appear in the export.

#### Scenario: Export with markers
- **GIVEN** markers 1 to 3 exist inside the selection
- **WHEN** the user copies or saves the capture
- **THEN** the image shows the three markers with their numbers
- **AND** it shows no handles, toolbar, magnifier, alignment guides, dimensions or dimming

#### Scenario: Marker crossing the selection edge
- **GIVEN** a marker is placed close to the edge of the selection
- **WHEN** the user copies or saves the capture
- **THEN** only the part of the marker inside the selection is in the image

#### Scenario: Renumbered markers export their current numbers
- **GIVEN** marker 2 of 1, 2 and 3 was deleted
- **WHEN** the user copies or saves the capture
- **THEN** the image shows markers numbered 1 and 2

### Requirement: Sharp markers at every display scale

A marker SHALL be drawn with GPU rendering and remain sharp and centred on its click point at 100%, 200% and fractional scaling, on every monitor, in the overlay and in the exported image. The number SHALL be aligned to the physical pixel grid.

#### Scenario: Fractional scaling
- **GIVEN** a monitor at approximately 133% scaling
- **WHEN** the user places markers and exports the capture
- **THEN** the circle edges are smooth and the number is not blurred
- **AND** the exported marker matches the on-screen marker

#### Scenario: Marker near the selection corner
- **GIVEN** a marker placed within its radius of a selection corner
- **WHEN** the capture is shown and exported
- **THEN** the marker is clipped by the selection and no part is drawn outside it
