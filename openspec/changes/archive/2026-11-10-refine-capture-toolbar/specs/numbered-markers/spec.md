## MODIFIED Requirements

### Requirement: Markers are edited like other annotations

With the Select and move tool active, the system SHALL let the user select a marker by clicking its circle, move it by dragging, change its colour and width while it is selected, and delete it with Delete. A selected marker SHALL be outlined by a blue ring just outside its circle, legible on light and dark content, and SHALL show no resize handles. Changing its width SHALL resize it around its centre.

#### Scenario: Select and move a marker
- **GIVEN** the Select and move tool is active and a marker exists
- **WHEN** the user clicks inside its circle and drags it
- **THEN** the marker is selected, outlined by a blue ring, and moves with the pointer, keeping its number

#### Scenario: Click beside a marker
- **GIVEN** the Select and move tool is active
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
