# capture-magnifier Specification

## Purpose

Show the pixel under the cursor magnified, with a target marker that frames that pixel without hiding it, so users can place capture edges with pixel precision.

## Requirements

### Requirement: Band crosshair that keeps the target pixel visible

The magnifier SHALL mark the target pixel with a horizontal and a vertical translucent band, each exactly one magnified source pixel wide, centred on the target pixel's row and column and spanning the whole magnified area. The target pixel itself SHALL stay uncovered, and the magnifier SHALL show no other crosshair marks.

#### Scenario: Target pixel framed by the bands
- **GIVEN** the magnifier is visible
- **WHEN** the cursor rests on any pixel
- **THEN** the pixels in the target's row and column are covered by translucent bands that reach the magnified area's edges
- **AND** the target pixel shows its own colour without any band, tick or box over it

#### Scenario: Band follows the magnified pixel size
- **GIVEN** a capture taken at 100%, 200% or approximately 133% scaling
- **WHEN** the cursor moves across fractional positions
- **THEN** each band stays exactly one magnified source pixel wide and lines up with the magnified pixel grid
- **AND** the band edges stay sharp on the monitor's physical pixel grid

### Requirement: Band crosshair legible over any content

The band SHALL be a translucent dark grey with a faint light halo along its edges, so the target row and column stay recognizable over light, dark and mixed content, while the underlying pixel colours remain visible through the band.

#### Scenario: Light and dark content
- **WHEN** the magnified area shows white, black, or high-contrast mixed content
- **THEN** the band edges remain recognizable
- **AND** the colours of the pixels under the band remain distinguishable

### Requirement: Square rounded magnifier

The magnifier SHALL be a square showing only the magnified image, with all four corners rounded and the image clipped to them. It SHALL show no coordinates; these are shown next to the cursor. It SHALL keep a gap below or above the cursor that leaves room for the coordinates, and its size limits and visibility rules SHALL stay unchanged.

#### Scenario: Corners clip the magnified image
- **WHEN** the magnifier is visible over any content
- **THEN** it is as wide as it is tall and no magnified pixel is drawn outside its rounded corners
- **AND** it contains no coordinates label

#### Scenario: Room for the coordinates
- **WHEN** the magnifier is placed below or above the cursor, including near the bottom edge of the monitor
- **THEN** it does not overlap the cursor mark or the coordinates label

#### Scenario: Small monitor
- **GIVEN** a monitor smaller than the magnifier's normal size
- **WHEN** the magnifier is shown scaled down to fit
- **THEN** the corners remain rounded and clipped, and the bands keep framing the target pixel
