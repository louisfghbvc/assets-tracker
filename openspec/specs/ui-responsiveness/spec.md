# ui-responsiveness Specification

## Purpose
TBD - created by archiving change improve-ui-responsiveness. Update Purpose after archive.
## Requirements
### Requirement: Layout Fluidity
The application UI SHALL adapt its typography and spacing fluidly across various mobile screen sizes, including ultra-compact devices (under 360px width), to prevent element overlapping and maintain usability.

#### Scenario: Responsive Market Cards
- **GIVEN** a screen width under 480px
- **WHEN** market stats cards are displayed
- **THEN** the badge containing profit and percentage MUST stack below the market label or the layout MUST adjust to prevent truncation.

### Requirement: Modal Accessibility
All interactive modals SHALL remain fully functional and scrollable even on devices with limited vertical or horizontal space.

#### Scenario: Adding Asset in Landscape Mode
- **GIVEN** a mobile device in landscape orientation
- **WHEN** the "Add Asset" modal is opened
- **THEN** the form MUST be scrollable.
- **AND** the "Add Asset" submit button MUST be reachable by the user.

### Requirement: Asset Card Robustness
Asset list items SHALL handle long strings and large numeric values without layout breakage or overlapping elements.

#### Scenario: Display Absolute Profit on Mobile
- **GIVEN** a mobile screen
- **WHEN** the asset list is displayed
- **THEN** high-precision profit values MUST be formatted or containers MUST adjust to prevent overlapping with labels.

