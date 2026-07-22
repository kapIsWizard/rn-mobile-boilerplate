@feature:REUSABLE-AUTH-FOUNDATION
@risk:critical
Feature: Reusable account and session foundation for native applications
  Every generated application needs a secure, platform-correct way for a person
  to create, access, recover, and delete an account without coupling product UI
  to one authentication provider.

  Background:
    Given an isolated non-production auth backend is ready
    And the installed application has a unique E2E application identifier
    And only enabled and completely configured auth methods are visible

  @id:SCN-TPL-001
  @requirement:REQ-TPL-001
  @configuration
  Scenario: A generated project declares its auth capabilities truthfully
    Given a new project was created from the boilerplate
    When its environment and provider configuration is validated
    Then every enabled method has complete platform and callback metadata
    And an incomplete enabled method blocks the build or preflight
    And no provider secret is present in application-readable configuration

  @id:SCN-TPL-002
  @requirement:REQ-TPL-002
  @e2e @email
  Scenario: A person creates and verifies an email account
    Given no account exists for a synthetic email address
    When the person registers with a valid password
    Then the application shows a non-enumerating verification state
    When the verification callback opens the installed application
    Then one authenticated account and one owner profile exist
    And the protected route is visible

  @id:SCN-TPL-003
  @requirement:REQ-TPL-002
  @e2e @email @recovery
  Scenario: A returning email user recovers access
    Given a verified synthetic email account exists
    When the person requests password recovery
    And opens the recovery callback from a terminated application
    And chooses a valid new password
    Then the new password signs the person in
    And the old password no longer signs the person in

  @id:SCN-TPL-004
  @requirement:REQ-TPL-003
  @e2e @phone
  Scenario: A phone OTP creates or restores one account
    Given a synthetic E.164 test number maps to a fixed non-production OTP
    When the person requests and verifies that OTP
    Then exactly one authenticated identity and one owner profile exist
    And repeating login for the same number restores the same account

  @id:SCN-TPL-005
  @requirement:REQ-TPL-003 @requirement:REQ-TPL-010
  @e2e @phone @recovery
  Scenario Outline: Phone verification fails safely
    Given a phone OTP challenge exists
    When the person encounters <condition>
    Then no authenticated session is created
    And the application exposes an actionable, non-enumerating recovery state
    And the backend rate and resend policy remains enforced

    Examples:
      | condition          |
      | an invalid code    |
      | an expired code    |
      | resend cooldown    |
      | a rate limit       |
      | network loss       |

  @id:SCN-TPL-006
  @requirement:REQ-TPL-004 @requirement:REQ-TPL-006
  @google @requires-human @provider-canary
  Scenario Outline: Google establishes the normalized application session
    Given a synthetic Google identity is available on <platform>
    When the person continues with Google and grants the approved scopes
    Then the expected backend identity is authenticated
    And the application enters the same authenticated route and profile contract as other methods
    And provider tokens are absent from evidence and unapproved storage

    Examples:
      | platform |
      | ios      |
      | android  |

  @id:SCN-TPL-007
  @requirement:REQ-TPL-005 @requirement:REQ-TPL-006
  @apple @requires-human @provider-canary
  Scenario: Apple establishes a native iOS session
    Given a synthetic Apple identity is available on an iOS device
    When the person continues with Apple and completes the native authorization
    Then the expected backend identity is authenticated
    And first-authorization profile data is handled without assuming it will be returned again
    And the application enters the normalized authenticated contract

  @id:SCN-TPL-008
  @requirement:REQ-TPL-005
  @apple @android @requires-human @provider-canary
  Scenario: The optional Android Apple path is capability-safe
    Given Apple authentication is enabled and completely configured for Android
    When the person completes the Apple authorization
    Then the expected backend identity is authenticated
    And state and nonce validation succeeds exactly once
    But when Apple authentication is not configured the method is unavailable without a broken button

  @id:SCN-TPL-009
  @requirement:REQ-TPL-007
  @e2e @lifecycle
  Scenario Outline: Session state survives native lifecycle correctly
    Given a synthetic user has <session-state>
    When the application follows <lifecycle>
    Then the route tree reflects only the verified current session
    And protected content is never rendered before verification

    Examples:
      | session-state | lifecycle                   |
      | valid         | termination and cold start  |
      | refreshable   | background and foreground   |
      | expired       | termination and cold start  |
      | revoked       | background and foreground   |

  @id:SCN-TPL-010
  @requirement:REQ-TPL-006 @requirement:REQ-TPL-009
  @e2e @logout
  Scenario: Logout removes local authority
    Given a synthetic user is authenticated
    When the person logs out
    And the application is terminated and reopened
    Then no platform-protected session credential remains
    And protected routes redirect to authentication
    And another user does not see the prior user's cached profile

  @id:SCN-TPL-011
  @requirement:REQ-TPL-008
  @backend @security
  Scenario: Backend authorization owns the profile boundary
    Given two synthetic users have separate profiles
    When one user reads or mutates the other user's profile through the public client
    Then the backend returns no accessible row or mutation
    And changing client-side route or state checks cannot bypass that denial

  @id:SCN-TPL-012
  @requirement:REQ-TPL-009
  @e2e @deletion @requires-human
  Scenario: A person deletes the complete account safely
    Given an authenticated person recently reauthenticated
    And application data exists for the account
    When the person confirms account deletion
    Then the auth identity and associated application data are deleted according to policy
    And an Apple token is revoked when Apple was linked
    And local session credentials and cached protected data are removed
    And the application returns to the unauthenticated state

  @id:SCN-TPL-013
  @requirement:REQ-TPL-010
  @e2e @negative
  Scenario Outline: Interrupted provider authentication creates no partial session
    Given no authenticated session exists
    When provider authentication ends with <outcome>
    Then no authenticated route or backend profile is created
    And retry starts from a coherent unauthenticated state

    Examples:
      | outcome                |
      | user cancellation      |
      | user denial            |
      | network loss           |
      | invalid state or nonce |
      | duplicate callback     |
      | backend outage         |

  @id:SCN-TPL-014
  @requirement:REQ-TPL-010
  @security @identity
  Scenario: Identity collision does not become account takeover
    Given an account already exists through one verified identity
    When another provider returns the same, private-relay, unverified, or unrelated identifier
    Then only the backend's approved verified-linking policy may reuse the account
    And ambiguous identities remain separate or require explicit reauthentication
    And the response does not reveal whether an unrelated account exists

  @id:SCN-TPL-015
  @requirement:REQ-TPL-011
  @security @storage
  Scenario: Authentication credentials remain inside approved boundaries
    Given every auth and lifecycle path was exercised with unique synthetic markers
    When application storage, bundle configuration, logs, telemetry, screenshots, crash fixtures, and committed evidence are inspected
    Then session and provider token markers are absent from every unapproved plaintext location
    And only approved public identifiers are present in the application bundle

