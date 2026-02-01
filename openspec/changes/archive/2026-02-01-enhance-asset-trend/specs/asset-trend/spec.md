# asset-trend Specification

## Capability: Trend Visualization
The system SHALL provide a comprehensive view of the user's total asset value over time.

## ADDED Requirements

### Requirement: Flexible Display Modes
The system SHALL allow users to toggle the trend chart between absolute value and percentage change.

#### Scenario: Switching to Percentage Mode
- **WHEN** user selects "Profit %" mode
- **THEN** the chart MUST re-scale to show percentage changes relative to the earliest data point in the current view.
- **AND** the Y-axis MUST display percentage values.

### Requirement: Time Range Filtering
The user SHALL be able to filter the trend data by specific time periods.

#### Scenario: Filtering by 1 Month
- **WHEN** the user selects the "1M" range
- **THEN** the chart MUST display only the data points from the last 30 days.

### Requirement: Event Integration
The system SHALL allow users to mark significant events on the timeline.

#### Scenario: Adding a note to a history record
- **GIVEN** a history record exists for the current date
- **WHEN** the user adds a note (e.g., "Major Crypto Buy")
- **THEN** the system MUST store this note with the history record.
- **AND** the trend chart MUST display a marker on that date with the note content visible on hover or click.

### Requirement: High-End Aesthetics
The trend chart SHALL use premium visual styles.

#### Scenario: Visual Polish
- **THEN** chart MUST use smooth (Bezier) curves instead of jagged lines.
- **AND** the area under the curve MUST have a dynamic gradient.
- **AND** the line color SHOULD reflect the overall trend (e.g., green for up, red for down) relative to the start of the period.
