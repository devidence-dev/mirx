# Spec Delta

## Purpose

Remember annotation appearance locally so repeated captures retain shared colour and gradient choices while each drawing tool keeps its own size.

## ADDED Requirements

### Requirement: Shared appearance choices survive capture sessions

The system SHALL remember explicitly chosen colour and gradient state as shared preferences across tools, captures, extension disable/enable and GNOME sessions. Changes SHALL be saved when made, independently of exporting or cancelling a capture. New captures SHALL remain idle with no annotations or restored selection.

#### Scenario: Cancel still remembers appearance
- **GIVEN** a selection exists
- **WHEN** the user chooses Blue, enables gradient and cancels the capture
- **THEN** the next capture shows Blue and gradient enabled after a selection is made
- **AND** no tool, annotation or previous capture selection is restored

#### Scenario: Export remembers appearance
- **WHEN** the user chooses Yellow, disables gradient and copies or saves the capture successfully
- **THEN** the next capture uses Yellow and gradient disabled

#### Scenario: Settings survive restarting the extension and session
- **GIVEN** the user chose Blue, enabled gradient and set the marker size to 5 px
- **WHEN** the extension is disabled and enabled, or the user logs out and logs in again
- **THEN** a new capture retains Blue, gradient enabled and the marker size of 5 px

#### Scenario: Gradient stays shared across unsupported tools
- **GIVEN** gradient is enabled
- **WHEN** the user switches to highlighter, text or pixelate and then to arrow
- **THEN** the toggle remains enabled throughout
- **AND** only gradient-capable annotations receive gradient rendering

### Requirement: Each drawing tool remembers an independent size

Arrow, rectangle, ellipse, numbered marker, highlighter, pixelate and text SHALL each retain an independent integer size from 1 to 30 using the existing width control and size interpretation. Choosing a tool by button or shortcut SHALL restore its size without changing shared colour or gradient, existing annotations or undo history.

#### Scenario: Arrows and markers keep different sizes
- **GIVEN** arrow size is 3 px and marker size is 5 px
- **WHEN** the user alternates between Arrow and Numbered marker using buttons or A and N
- **THEN** the width value alternates between 3 px and 5 px
- **AND** new annotations use the size belonging to their tool

#### Scenario: All drawing tools have separate memory
- **WHEN** the user assigns different valid sizes to arrow, rectangle, ellipse, numbered marker, highlighter, pixelate and text and opens another capture
- **THEN** each tool restores its own value when chosen
- **AND** marker diameter, text size and pixelation block size keep their existing relationship to that value
- **AND** highlighter coverage remains determined by its drawn region

#### Scenario: Switching tools preserves existing work
- **GIVEN** annotations exist and arrow size is 3 px while rectangle size is 8 px
- **WHEN** the user switches between those tools
- **THEN** existing annotations and undo history remain unchanged
- **AND** the toolbar shows the active tool's size, with the same shared colour and gradient

### Requirement: Defaults remain compatible with existing preferences

Without a remembered size, each tool SHALL use the configured default width, initially 3 px. Without saved appearance choices, colour SHALL use the existing colour preference, initially Red, and gradient SHALL be off. Changing the colour preference SHALL set the shared colour for subsequent captures. Changing default width SHALL affect only tools without an explicit remembered size on subsequent captures; preferences SHALL explain that distinction.

#### Scenario: Existing settings seed first use
- **GIVEN** the existing preferences specify Yellow and a default width of 6 px, with no remembered tool sizes or gradient
- **WHEN** the user opens a capture and chooses each drawing tool
- **THEN** each tool starts at 6 px, shared colour is Yellow and gradient is off

#### Scenario: Default width does not erase individual choices
- **GIVEN** marker size was explicitly set to 5 px and rectangle has no remembered size
- **WHEN** the user changes default width to 7 px in preferences and opens another capture
- **THEN** marker size is 5 px and rectangle size is 7 px

#### Scenario: Appearance preference changes are read on the next capture
- **GIVEN** Blue was remembered in the toolbar
- **WHEN** the user sets the colour preference to Yellow and opens another capture
- **THEN** the shared colour is Yellow

### Requirement: Only explicit edits update appearance memory

An explicit colour or gradient edit SHALL update its shared preference. An explicit size edit SHALL update the active drawing tool's memory, or the selected annotation's type when Select and move is active. Selecting an annotation SHALL NOT update preferences. With no active drawing tool or selected annotation, size controls SHALL be disabled and SHALL NOT change any tool's size.

#### Scenario: Editing a selected marker updates marker memory
- **GIVEN** arrow size is 3 px and a marker is selected with Select and move
- **WHEN** the user changes its size to 5 px
- **THEN** the marker is resized and new markers use 5 px, including in subsequent captures
- **AND** arrow size remains 3 px

#### Scenario: Selection alone does not learn an old style
- **GIVEN** marker size is remembered as 5 px and an older 9 px red marker exists while shared colour is Blue
- **WHEN** the user selects and moves the older marker without restyling it, then chooses Numbered marker
- **THEN** new markers use 5 px and Blue
- **AND** selecting the old marker displays its existing colour and size without saving them

#### Scenario: Undo changes annotations without undoing preferences
- **GIVEN** a selected marker was explicitly changed from 3 px to 5 px and from Red to Blue
- **WHEN** the user undoes the style edits
- **THEN** the selected marker returns to its previous appearance
- **AND** remembered marker size stays 5 px and shared colour stays Blue
- **AND** redo restores the annotation without writing preference changes

#### Scenario: Idle and empty Select and move have no size target
- **WHEN** the editor is idle, or Select and move is active without a selected annotation
- **THEN** size decrease and increase are disabled
- **AND** the displayed size is the configured default width until a tool or annotation supplies a target
- **AND** choosing shared colour or gradient remains available and remembered

### Requirement: Invalid or unwritable memory does not block capture

The system SHALL ignore unknown tool identifiers and invalid remembered values, using a valid configured fallback or the initial default for the affected field while retaining valid fields. A failed preference write SHALL leave the current editing change usable, report that the preference could not be saved and SHALL NOT prevent capture, cancellation or export.

#### Scenario: Invalid entries are isolated
- **GIVEN** stored colour is invalid and stored sizes include arrow 0, marker 5, text 31 and an unknown tool
- **WHEN** a capture opens
- **THEN** colour falls back to Red, arrow and text use the valid configured default width, and marker keeps 5 px
- **AND** the unknown tool creates no control or annotation

#### Scenario: Read-only preference storage
- **GIVEN** preference storage rejects writes
- **WHEN** the user explicitly chooses Blue or changes marker size to 5 px
- **THEN** the current capture uses the chosen value and reports that it could not be saved
- **AND** the user can continue editing, cancel, copy or save
- **AND** a subsequent capture uses the last successfully stored values

### Requirement: Preference memory remains local and ends cleanly

Only appearance preferences SHALL be persisted; screenshots, annotations, numbering, undo history and selections SHALL NOT be stored by this feature. Closing or disposing a capture SHALL release any preference callbacks or subscriptions for that capture; late events from it SHALL NOT write settings or affect a later capture.

#### Scenario: New captures have fresh content
- **GIVEN** a capture contains annotations including three numbered markers
- **WHEN** it closes and another capture opens
- **THEN** appearance preferences remain but annotations, selection and undo history are empty
- **AND** the first newly placed marker is numbered 1

#### Scenario: Old view cannot write after close
- **GIVEN** one capture closed and another opened
- **WHEN** a retained callback from the old capture attempts to report a style change
- **THEN** no preference is written and the current capture is unchanged

### Requirement: Remembered appearance preserves scaling and exports

Remembered sizes SHALL retain their existing logical-size interpretation at 100%, 200% and fractional display scales, without being multiplied when stored or restored. GPU rendering, selection clipping and exclusion of editing decorations from PNG, JPG and clipboard exports SHALL remain unchanged.

#### Scenario: Restored sizes on different display scales
- **GIVEN** arrow size is remembered as 3 px and marker size as 5 px on a 100% monitor
- **WHEN** the user opens captures on 200% and approximately 133% monitors and exports PNG, JPG or clipboard images
- **THEN** the toolbar still shows 3 px for arrows and 5 px for markers
- **AND** each annotation matches the existing rendering of the same size at that scale
- **AND** the export matches the preview inside the selection with no toolbar or editing decorations
