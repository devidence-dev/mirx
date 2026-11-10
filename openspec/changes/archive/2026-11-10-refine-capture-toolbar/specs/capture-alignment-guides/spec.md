## MODIFIED Requirements

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
