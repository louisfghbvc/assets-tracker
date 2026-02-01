# test-framework Specification

## Purpose
Establish the fundamental testing environment to support automated verification of the AssetTracker codebase.

## ADDED Requirements

### Requirement: Test Runner Integration
The system SHALL use Vitest as the primary test runner, integrated with the existing Vite build pipeline.

#### Scenario: Running Tests
- **GIVEN** the project is initialized
- **WHEN** the user runs `npm test`
- **THEN** Vitest should execute all discovered test files.

### Requirement: DOM Simulation
The system SHALL support testing React components using a simulated DOM environment.

#### Scenario: Component Rendering
- **GIVEN** a React component
- **WHEN** the test renders the component using React Testing Library
- **THEN** it should be able to query the DOM and assert on the output.

### Requirement: Tauri API Mocking
The system SHALL provide a mechanism to mock Tauri-specific APIs so that tests can run outside the Tauri environment.

#### Scenario: Mocking App Data Dir
- **GIVEN** a service that calls `appDataDir()` from Tauri API
- **WHEN** the test runs in a Node environment
- **THEN** the API call should return a mocked path instead of throwing an error.
