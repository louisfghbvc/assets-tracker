# ui-responsiveness Specification

## Purpose
TBD - created by archiving change improve-ui-responsiveness. Update Purpose after archive.
## Requirements
### Requirement: Layout Fluidity
The application UI SHALL adapt its typography and spacing fluidly across various mobile screen sizes to maintain readability and aesthetic balance.

#### Scenario: Balance Display on Different Devices
- **GIVEN** the application is running on a device with 320px width (e.g. iPhone SE)
- **THEN** the total balance font size MUST scale down to avoid horizontal scrolling.
- **AND** on a 430px width device (e.g. iPhone 15 Pro Max), it MUST scale up to fill the space appropriately.

### Requirement: Modal Accessibility
All interactive modals SHALL remain fully functional and scrollable even on devices with limited vertical or horizontal space.

#### Scenario: Adding Asset in Landscape Mode
- **GIVEN** a mobile device in landscape orientation
- **WHEN** the "Add Asset" modal is opened
- **THEN** the form MUST be scrollable.
- **AND** the "Add Asset" submit button MUST be reachable by the user.

### Requirement: Asset Card Robustness
Asset list items SHALL handle long strings and large numeric values without layout breakage or overlapping elements.

#### Scenario: Long Asset Name on Narrow Screen
- **GIVEN** an asset with a very long name (e.g. "Pionex BTC-USD Dual-Investment Share")
- **WHEN** viewed on a 320px screen
- **THEN** the name MUST truncate with an ellipsis (`...`).
- **AND** the price and action buttons MUST remain correctly aligned and visible.

