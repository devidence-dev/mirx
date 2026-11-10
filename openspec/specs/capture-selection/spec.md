# capture-selection Specification

## Purpose

Define how the capture area is chosen before it is adjusted: a window, a free area or a full monitor, and what the overlay highlights while the choice is pending.

## Requirements

### Requirement: A click on empty space selects the monitor under the pointer

Before a selection exists, a click (press and release with less than 5 px of movement) where no window is under the pointer SHALL select the whole monitor under the pointer. The desktop background and the top bar SHALL count as no window. A click on a window SHALL still select that window, and a drag SHALL still make a free selection limited to the monitor where it started.

#### Scenario: Click on the empty desktop
- **GIVEN** the overlay is open with no selection and no window under the pointer
- **WHEN** I click on the empty desktop
- **THEN** the selection covers the whole monitor under the pointer

#### Scenario: Click on the top bar
- **GIVEN** the overlay is open with no selection
- **WHEN** I click on the top bar
- **THEN** the selection covers the whole monitor under the pointer

#### Scenario: Click on a window still selects the window
- **GIVEN** the overlay is open with no selection and a window under the pointer
- **WHEN** I click on that window
- **THEN** the selection fits the frame of that window, not the monitor

#### Scenario: A tiny movement still counts as a click
- **GIVEN** the overlay is open with no selection and no window under the pointer
- **WHEN** I press and release after moving the pointer less than 5 px
- **THEN** the selection covers the whole monitor under the pointer

#### Scenario: A drag still makes a free selection
- **GIVEN** the overlay is open with no selection
- **WHEN** I drag at least 5 px, even starting on empty desktop
- **THEN** the selection is the dragged rectangle, limited to the monitor where the drag started
- **AND** the full monitor is not selected

#### Scenario: With two monitors, the monitor under the pointer is selected
- **GIVEN** two connected monitors and no window under the pointer
- **WHEN** I click on the empty desktop of the second monitor
- **THEN** the selection covers the whole second monitor
- **AND** it does not extend to the first monitor

#### Scenario: Ctrl+A is unchanged
- **GIVEN** the overlay is open with no selection
- **WHEN** I press Ctrl+A
- **THEN** the selection covers the whole monitor under the pointer, as before

### Requirement: The hover highlight shows what a click would select

Before a selection exists, the overlay SHALL highlight the window under the pointer, clipped to its monitor, or the whole monitor under the pointer when no window is there. Once a selection exists, no hover highlight SHALL be shown.

#### Scenario: Hover over an empty area highlights the monitor
- **GIVEN** the overlay is open with no selection
- **WHEN** I move the pointer over the desktop or the top bar
- **THEN** the whole monitor under the pointer is highlighted and the rest of the screen is dimmed

#### Scenario: Hover over a window highlights the window
- **GIVEN** the overlay is open with no selection
- **WHEN** I move the pointer over a window
- **THEN** that window is highlighted, not the monitor

#### Scenario: Highlight follows the pointer between monitors
- **GIVEN** two connected monitors and no window under the pointer
- **WHEN** I move the pointer from the first monitor to the second
- **THEN** the highlight changes from the first monitor to the second

#### Scenario: No hover highlight once a selection exists
- **GIVEN** a selection exists
- **WHEN** I move the pointer over the desktop or over a window
- **THEN** the highlight stays on the selection and no hover highlight appears
