# Spec Delta

## REMOVED Requirements

### Requirement: One gradient toggle in the toolbar

**Reason**: Its mandatory reset at every capture start is replaced by a persistent shared toggle. The existing single-toggle interface and exclusions remain part of the replacement requirement below.

**Migration**: Retain off as the first-use default, then restore the saved choice. Replace the old session-reset scenario with the cross-session persistence scenarios below.

## ADDED Requirements

### Requirement: One persistent gradient toggle in the toolbar

The toolbar SHALL offer a single on/off gradient toggle that shows its state. It SHALL be off when no gradient preference has been saved and SHALL otherwise restore the last explicitly chosen state at the start of each capture session. The toggle SHALL remain shared across tools. The system SHALL NOT offer a second colour picker, gradient presets, angles or colour stops.

#### Scenario: Default state
- **GIVEN** no gradient preference has been saved
- **WHEN** the user opens the capture editor and a selection exists
- **THEN** the gradient toggle is shown as off

#### Scenario: Toggle on and off
- **GIVEN** no annotation is selected
- **WHEN** the user switches the toggle on and then off
- **THEN** the toggle shows on, then off
- **AND** no undo entry is created by either change
- **AND** each explicit choice updates the remembered state

#### Scenario: State is kept between sessions
- **GIVEN** the user switched the toggle on and closed the editor
- **WHEN** the user opens the editor again
- **THEN** the toggle is on

#### Scenario: Disabled state is also remembered
- **GIVEN** the user previously enabled gradient
- **WHEN** the user switches it off, closes the editor and opens another capture
- **THEN** the toggle is off
