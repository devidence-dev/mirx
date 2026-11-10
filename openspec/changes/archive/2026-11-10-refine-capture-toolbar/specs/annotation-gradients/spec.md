## MODIFIED Requirements

### Requirement: Gradient sweeps the chosen colour into a neighbouring hue

When the toggle is on, a new arrow, rectangle, ellipse or numbered marker SHALL be filled or stroked with a smooth gradient that starts at a slightly lighter version of the chosen colour and slides into a neighbouring, equally saturated hue, without any white highlight. An arrow SHALL run from its tail to its head, including its head bars. A rectangle, ellipse or marker SHALL run from its top-left to its bottom-right corner, whatever direction it was drawn in.

#### Scenario: Arrow
- **GIVEN** the toggle is on and the colour is Blue
- **WHEN** the user draws an arrow
- **THEN** the arrow starts in a slightly lighter blue and slides into violet at its tip
- **AND** the head bars continue the same direction without a visible seam

#### Scenario: Rectangle and ellipse outline
- **GIVEN** the toggle is on
- **WHEN** the user draws a rectangle and an ellipse by dragging from bottom-right to top-left
- **THEN** each outline slides from the chosen colour at its top-left to the neighbouring hue at its bottom-right
- **AND** the outline width is unchanged by the gradient

#### Scenario: Numbered marker
- **GIVEN** the toggle is on
- **WHEN** the user places a marker
- **THEN** the circle slides from the chosen colour at its top-left to the neighbouring hue at its bottom-right
- **AND** the number is still drawn in one solid contrasting colour, not shaded

#### Scenario: Extreme colours
- **GIVEN** the toggle is on
- **WHEN** the user draws with White and with Black
- **THEN** White and Black stay flat, since they have no hue to sweep

#### Scenario: Gradient follows the shape
- **GIVEN** a gradient rectangle exists and the Select and move tool is active
- **WHEN** the user moves it or resizes it
- **THEN** its gradient moves with it, or spans the new bounds, with the same start still at the top-left
