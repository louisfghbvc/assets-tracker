# ui-responsiveness Specification Delta

## MODIFIED Requirements

### Requirement: Layout Fluidity
The application UI SHALL adapt its typography and spacing fluidly across various mobile screen sizes, including ultra-compact devices (under 360px width), to prevent element overlapping and maintain usability.

#### Scenario: Stats Grid on 320px Screen
- **GIVEN** the application is running on a 320px width device
- **THEN** the stats grid MUST switch to a 2-column layout.
- **AND** cards MUST show full values without overlapping adjacent cards.

#### Scenario: Asset Price and Actions Collision
- **GIVEN** an asset with a large balance and multiple action buttons
- **WHEN** viewed on a screen under 350px
- **THEN** the layout MUST stack the asset name above the price/actions area if they cannot fit horizontally.
- **AND** the delete button MUST NOT overlap with the asset price/value text.
