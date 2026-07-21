@feature:PRIVATE-NOTES
Feature: Private notes

  Background:
    Given an isolated E2E backend is ready
    And an authenticated test user exists

  @id:SCN-NOTE-001
  @risk:critical
  @e2e
  @visual
  Scenario: A private note survives an application restart
    Given the user is on the new note screen
    When the user creates a valid private note
    And the application is terminated and reopened
    Then the note is visible to its owner
    And the note is not visible to another user
    And no duplicate note was created
