@feature:PRIVATE-NOTES
@risk:critical
Feature: Private notes on an installed native application
  An authenticated user needs notes that survive application restarts
  without exposing their contents or creating duplicates during recovery.

  Background:
    Given an isolated E2E backend is ready
    And synthetic users "owner" and "other-user" exist
    And the installed application uses the E2E application identifier

  @id:SCN-NOTE-001
  @requirement:REQ-NOTE-001
  @e2e @backend
  Scenario: A private note survives an application restart
    Given "owner" is authenticated
    And no note exists for scenario "SCN-NOTE-001"
    When the owner creates a note titled "Plan na jutro" with body "Sprawdzić wersję natywną"
    And the application is terminated and reopened
    Then exactly one note titled "Plan na jutro" is visible
    And the backend contains exactly one matching note owned by "owner"

  @id:SCN-NOTE-002
  @requirement:REQ-NOTE-002
  @e2e @backend @security
  Scenario: Another user cannot read an owner's note
    Given "owner" has a private note with known identifier
    And the application is reset and "other-user" is authenticated
    When the other user opens the owner's note deep link
    Then the note content is not rendered
    And a non-revealing not-found message is shown
    And a backend query as "other-user" returns no row

  @id:SCN-NOTE-003
  @requirement:REQ-NOTE-003
  @e2e @deep-link
  Scenario: A cold-start deep link opens the correct note
    Given "owner" is authenticated and has a private note with known identifier
    And the application is terminated
    When the operating system opens the note deep link
    Then the application cold-starts on that note
    And the title and body match the backend row

  @id:SCN-NOTE-004
  @requirement:REQ-NOTE-004
  @e2e @backend @network
  Scenario: An offline create can be retried without a duplicate
    Given "owner" is authenticated on the new note screen
    And the owner entered a valid title and body
    And network connectivity is unavailable
    When the owner submits the note
    Then an actionable offline error is shown
    And the entered title and body remain editable
    And the backend contains no matching note
    When connectivity is restored and the owner retries once
    Then exactly one matching note is visible
    And the backend contains exactly one row for the operation idempotency key

  @id:SCN-NOTE-005
  @requirement:REQ-NOTE-005
  @e2e @visual
  Scenario Outline: Required visual states conform to the platform contract
    Given the device is normalized for <platform> visual verification
    And the deterministic fixture exposes the <state> state
    When the notes screen is captured
    Then every required semantic element for <state> is present
    And the screenshot conforms to the approved <platform> reference region

    Examples:
      | platform | state     |
      | ios      | default   |
      | ios      | loading   |
      | ios      | error     |
      | ios      | populated |
      | android  | default   |
      | android  | loading   |
      | android  | error     |
      | android  | populated |

  @id:SCN-NOTE-006
  @requirement:REQ-NOTE-006
  @security @device-storage @backend
  Scenario: Confidential data stays inside the approved protection boundary
    Given "owner" created a note containing a unique synthetic confidentiality marker
    And the application completed restart, offline failure, retry, logout, and re-authentication paths
    When device storage, application logs, native logs, crash and analytics fixtures, screenshots metadata, and committed evidence are inspected
    Then the note marker is absent from every unapproved plaintext location
    And session credentials exist only in the approved platform-protected store while the session is active
    And logout removes the locally persisted session credentials
    And the backend oracle records that authorized storage can read note plaintext under the explicitly accepted P0 trust boundary
