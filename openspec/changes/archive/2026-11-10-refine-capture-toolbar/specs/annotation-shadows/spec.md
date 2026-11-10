## Purpose

Gives annotations subtle visual depth with soft silhouette shadows that remain consistent during editing and in exported captures.

## ADDED Requirements

### Requirement: Annotations have a subtle silhouette shadow

Every annotation SHALL have a small, soft black shadow just below and to the right of its visible shape. The shadow SHALL follow strokes, glyphs and filled shapes rather than an opaque bounding box. It SHALL preserve hollow interiors, annotation colours and highlighter transparency. A marker's shadow SHALL follow its disc without changing its number.

#### Scenario: Outlines, text and filled annotations
- **WHEN** the user draws an arrow, rectangle, ellipse, marker, text, highlighter or pixelation region
- **THEN** a subtle soft shadow follows its visible shape and the annotation retains its existing appearance and geometry

#### Scenario: Hollow outline
- **WHEN** the user draws a large rectangle or ellipse outline
- **THEN** the shadow follows its outline without darkening the entire hollow interior

### Requirement: Shadows follow editing and display scale

Shadows SHALL move, resize, restyle, hide and disappear with their annotations, keeping the same stacking order. They SHALL have consistent logical size across display scales and SHALL NOT change hit testing or editor history. Closing the capture SHALL remove all shadow resources.

#### Scenario: Editing and removal
- **WHEN** the user moves, resizes, restyles, undoes or deletes an annotation
- **THEN** its shadow follows the resulting annotation without stale pixels or an independent history entry

#### Scenario: Editing text
- **WHEN** an existing text annotation is hidden while its text is being edited
- **THEN** its committed shadow is hidden too and returns with the committed text

#### Scenario: Scaled displays and reopening
- **WHEN** captures are opened at 100%, approximately 133% and 200%, closed and reopened
- **THEN** shadows have the same logical size, remain aligned and leave no old actors or effects

### Requirement: Shadows are annotation content in exports

Shadows SHALL be visible in the preview and exported PNG, JPG and clipboard captures, clipped to the selection alongside annotations. Toolbar controls, tooltips, selection frames and handles SHALL remain absent from exports.

#### Scenario: Export near the selection edge
- **GIVEN** an annotation and its shadow extend to the selection edge
- **WHEN** the user exports the capture
- **THEN** the shadow matches the preview inside the selection, nothing extends beyond its bounds and no editor decorations appear
