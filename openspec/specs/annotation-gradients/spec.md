# annotation-gradients Specification

## Purpose

Let users give arrows, rectangles, ellipses and numbered markers a vivid sweep of their chosen colour into a neighbouring hue with one toggle, shown on screen and in the exported image exactly the same.

## Requirements

### Requirement: One gradient toggle in the toolbar

The toolbar SHALL offer a single on/off gradient toggle that shows its state. It SHALL be off at the start of every capture session. The system SHALL NOT offer a second colour picker, gradient presets, angles or colour stops.

#### Scenario: Default state
- **WHEN** the user opens the capture editor and a selection exists
- **THEN** the gradient toggle is shown as off

#### Scenario: Toggle on and off
- **GIVEN** no annotation is selected
- **WHEN** the user switches the toggle on and then off
- **THEN** the toggle shows on, then off
- **AND** no undo entry is created by either change

#### Scenario: State is not kept between sessions
- **GIVEN** the user switched the toggle on and closed the editor
- **WHEN** the user opens the editor again
- **THEN** the toggle is off

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
- **GIVEN** a gradient rectangle exists and no annotation tool is active
- **WHEN** the user moves it or resizes it
- **THEN** its gradient moves with it, or spans the new bounds, with the same start still at the top-left

### Requirement: Gradient excludes highlighter, text and pixelate

The toggle SHALL NOT change how highlighter, text or pixelate annotations look, whatever its state.

#### Scenario: Excluded tools
- **GIVEN** the toggle is on
- **WHEN** the user creates a highlighter, a text and a pixelated area
- **THEN** each looks exactly as it does with the toggle off

### Requirement: Gradient follows the same rules as colour and width

The toggle state SHALL be recorded when an annotation is created. Switching it while an arrow, rectangle, ellipse or numbered marker is selected SHALL apply or remove that annotation's gradient as one undoable change, like colour or width, without changing unselected annotations. Recolouring and undo or redo SHALL keep each annotation's own gradient state.

#### Scenario: Toggle does not restyle existing annotations
- **GIVEN** a flat arrow and a gradient rectangle exist
- **WHEN** the user switches the toggle and draws a new arrow
- **THEN** only the new arrow follows the toggle
- **AND** the flat arrow stays flat and the rectangle stays a gradient

#### Scenario: Toggle with a selected annotation
- **GIVEN** a flat rectangle is selected
- **WHEN** the user switches the toggle on
- **THEN** the selected rectangle becomes a gradient and other annotations keep their look
- **AND** one undo restores the flat rectangle

#### Scenario: Toggle with a selected unsupported annotation
- **GIVEN** a highlighter, text or pixelate annotation is selected
- **WHEN** the user switches the toggle
- **THEN** the selected annotation keeps its look and no undo entry is created
- **AND** the toggle state still changes for new annotations

#### Scenario: Recolour a selected gradient annotation
- **GIVEN** a gradient arrow is selected
- **WHEN** the user chooses another colour
- **THEN** the arrow's gradient is derived from the new colour

#### Scenario: Undo and redo
- **GIVEN** a gradient annotation and a flat annotation exist
- **WHEN** the user deletes both, then undoes twice and redoes once
- **THEN** each restored annotation has the look it had before deletion

### Requirement: Gradient is exported as displayed

PNG, JPG and clipboard exports SHALL contain each gradient exactly as shown on screen, with the same direction, shades, edges and position. Exports SHALL NOT include any toggle, selection or editing decoration.

#### Scenario: Export with gradients
- **GIVEN** gradient and flat annotations exist inside the selection
- **WHEN** the user copies or saves the capture
- **THEN** the image shows the same shading as the screen
- **AND** the image shows no toolbar, handles, magnifier, alignment guides, dimensions or dimming

#### Scenario: Gradient cropped by the selection
- **GIVEN** a gradient arrow extends past the selection edge
- **WHEN** the user copies or saves the capture
- **THEN** the image contains only the part inside the selection, with the shading it has on screen

### Requirement: Gradients stay sharp and smooth at every display scale

Gradient annotations SHALL be GPU rendered and keep the same crisp edges, stroke width and alignment as flat ones at 100%, 200% and fractional scaling, with a smooth transition and no visible banding, seams or clipped edges.

#### Scenario: Fractional scaling
- **GIVEN** a monitor at approximately 133% scaling
- **WHEN** the user draws gradient annotations and exports
- **THEN** the edges are as sharp as flat annotations of the same size
- **AND** the exported image matches the screen

#### Scenario: Integer scaling
- **GIVEN** a monitor at 200% scaling
- **WHEN** the user draws a gradient rectangle, an ellipse and a marker, and exports
- **THEN** each annotation has the same size and edges in physical pixels as its flat equivalent
- **AND** the shading direction and shades match the screen
