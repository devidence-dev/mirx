## Purpose

Defines the mirx top bar indicator: an icon with a small menu that starts a capture or opens the preferences, and the preference that shows or hides it. It gives the extension a visible entry point without changing the keyboard shortcut.

## ADDED Requirements

### Requirement: A top bar icon is shown by default

While the extension is enabled and the preference "Show icon in top bar" is on, the top bar SHALL show one mirx icon. The preference SHALL default to on.

#### Scenario: Fresh install shows the icon
- **GIVEN** the extension is enabled and the preference was never changed
- **THEN** exactly one mirx icon is in the top bar

#### Scenario: Preference is off at enable time
- **GIVEN** the preference is off
- **WHEN** the extension is enabled
- **THEN** no mirx icon is in the top bar

#### Scenario: One icon after repeated enable
- **WHEN** the extension is disabled and enabled again
- **THEN** exactly one mirx icon is in the top bar

### Requirement: The icon follows the top bar colour

The icon SHALL be drawn in the same foreground colour as the other top bar icons, including their hover and active states, and SHALL stay legible when the shell theme is light or dark.

#### Scenario: Default dark top bar
- **GIVEN** the default GNOME top bar
- **THEN** the icon is visible and has the same colour as neighbouring top bar icons

#### Scenario: Light top bar colour
- **GIVEN** a shell theme with a light top bar, or a light colour scheme that changes the top bar foreground
- **THEN** the icon takes the foreground colour of that theme and is not drawn white on a light background

#### Scenario: Active state
- **WHEN** the menu is open
- **THEN** the icon is drawn in the active top bar colour like neighbouring icons

### Requirement: The menu offers two actions

Clicking the icon SHALL open a menu with exactly two items, "Take screenshot" (with its shortcut hint) and "Preferences", in that order.

#### Scenario: Menu content
- **WHEN** I click the icon
- **THEN** a menu opens with "Take screenshot" and then "Preferences", and nothing else

#### Scenario: Open preferences
- **WHEN** I choose "Preferences"
- **THEN** the mirx preferences window opens and the menu closes

### Requirement: The menu shows the capture shortcut

The "Take screenshot" item SHALL show the current capture shortcut as a dimmed hint aligned to the right of the item, formatted for reading (for example `Alt+Shift+X`). The hint SHALL follow changes to the shortcut without recreating the icon, and SHALL be hidden when no valid shortcut is set. Left and right click on the icon SHALL open the same menu.

#### Scenario: Default shortcut
- **GIVEN** the capture shortcut was never changed
- **WHEN** I open the menu
- **THEN** the "Take screenshot" item shows `Alt+Shift+X` at its right edge

#### Scenario: Changed shortcut
- **GIVEN** the menu was built with the default shortcut
- **WHEN** I change the capture shortcut to `Ctrl+Super+S` in the preferences or with `gsettings`
- **THEN** the hint shows `Ctrl+Super+S` at once, and there is still exactly one icon

#### Scenario: Empty shortcut
- **GIVEN** the capture shortcut setting is empty or not a valid accelerator
- **WHEN** I open the menu
- **THEN** the "Take screenshot" item shows no hint

#### Scenario: No update after disable
- **WHEN** the extension is disabled and the shortcut changes
- **THEN** nothing in the indicator is updated and no error is logged

### Requirement: Take screenshot behaves like the shortcut

Choosing "Take screenshot" SHALL close the menu and then start the same capture as the keyboard shortcut. The menu SHALL NOT appear in the frozen screen or in any exported image.

#### Scenario: Capture from the menu
- **WHEN** I choose "Take screenshot"
- **THEN** the menu is gone and the screen freezes in the same capture overlay the shortcut opens

#### Scenario: The menu is not captured
- **WHEN** I choose "Take screenshot" and export the capture
- **THEN** neither the open menu nor its highlighted item appears in the frozen screen or in the exported image

#### Scenario: A capture is already open
- **GIVEN** a capture session is already open
- **WHEN** a menu request to take a screenshot reaches the extension
- **THEN** it changes nothing, as with a second shortcut press

#### Scenario: Capture failure
- **GIVEN** the capture cannot be taken
- **WHEN** I choose "Take screenshot"
- **THEN** the usual capture error notification is shown and the menu is not left open

### Requirement: The preference shows or hides the icon at runtime

The preferences window SHALL offer a switch "Show icon in top bar". Changing it, from the window or by any other writer of the setting, SHALL add or remove the icon immediately, without restarting the extension or the session.

#### Scenario: Turn the icon off
- **GIVEN** the icon is shown
- **WHEN** I turn the switch off
- **THEN** the icon disappears from the top bar at once and no actor of it remains

#### Scenario: Turn the icon on
- **GIVEN** the icon is hidden
- **WHEN** I turn the switch on
- **THEN** one icon appears at once

#### Scenario: Open menu while hiding
- **GIVEN** the menu is open
- **WHEN** the preference turns off
- **THEN** the menu and the icon are removed and no error is logged

#### Scenario: Switch reflects the stored value
- **WHEN** the preferences window opens, or the value is changed elsewhere while it is open
- **THEN** the switch shows the stored value

### Requirement: Hiding the icon does not affect the shortcut

The keyboard shortcut SHALL keep working while the icon is hidden.

#### Scenario: Shortcut with hidden icon
- **GIVEN** the preference is off
- **WHEN** I press the capture shortcut
- **THEN** the capture opens as usual

### Requirement: Disabling the extension leaves nothing behind

When the extension is disabled, the icon, its menu, every signal connection made for the indicator and any pending menu-triggered capture SHALL be removed, and no timer or idle callback of the indicator SHALL fire afterwards.

#### Scenario: Disable removes the indicator
- **GIVEN** the icon is shown
- **WHEN** the extension is disabled
- **THEN** the top bar has no mirx icon and no status area entry for it remains

#### Scenario: Disable between menu click and capture
- **GIVEN** I chose "Take screenshot" and the capture has not started yet
- **WHEN** the extension is disabled
- **THEN** no capture starts

#### Scenario: Disable with the icon hidden
- **GIVEN** the preference is off
- **WHEN** the extension is disabled and enabled again
- **THEN** no error is logged and no icon appears
