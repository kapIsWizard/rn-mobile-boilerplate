@feature:CONTROL-PLANE-CONTRACT-VALIDATION
@risk:critical
Feature: Complete machine-contract validation
  The delivery control plane must reject malformed and unowned machine data
  before an agent can act on it.

  @id:SCN-HARD-001
  @requirement:REQ-HARD-002
  @ci @schema
  Scenario: A newly added controlled JSON artifact has no schema owner
    Given every controlled JSON artifact is covered by the schema registry
    When a controlled JSON artifact is added without a mapping or active exclusion
    Then contract validation fails
    And the diagnostic identifies the unmapped artifact

  @id:SCN-HARD-002
  @requirement:REQ-HARD-002
  @ci @schema
  Scenario: One artifact is ambiguously owned
    Given two registry mappings match the same controlled JSON artifact
    When contract validation runs
    Then contract validation fails
    And the diagnostic identifies both conflicting mappings

  @id:SCN-HARD-003
  @requirement:REQ-HARD-003
  @ci @schema
  Scenario: Invalid data is rejected with an actionable path
    Given a registered artifact violates its schema
    When contract validation runs
    Then contract validation fails
    And the diagnostic identifies the artifact, schema, instance path, and failed keyword
    And no secret value is printed

  @id:SCN-HARD-004
  @requirement:REQ-HARD-003
  @ci @schema
  Scenario: An invalid or unintended schema cannot start the validator
    Given a registered schema is invalid or uses an unapproved draft behavior
    When the schema registry is compiled in strict mode
    Then validator startup fails
    And no artifact is reported as valid

  @id:SCN-HARD-005
  @requirement:REQ-HARD-003
  @ci @negative
  Scenario Outline: Negative fixtures prove every schema family rejects bad data
    Given schema family <family> has a focused negative fixture
    When the fixture is validated
    Then it is rejected for the documented keyword and instance path

    Examples:
      | family                |
      | runtime configuration |
      | workflow definition   |
      | run state             |
      | approval evidence     |
      | environment readiness |
      | verification evidence |

  @id:SCN-HARD-006
  @requirement:REQ-HARD-004
  @ci @supply-chain
  Scenario: CI installs the exact reviewed validator dependency graph
    Given the validator dependencies and lockfile are committed
    When CI starts in a clean workspace
    Then dependency installation uses the lockfile without updating it
    And the same contract suite runs as the local required check

  @id:SCN-HARD-007
  @requirement:REQ-HARD-001
  @preflight
  Scenario: Control-plane maintenance uses a truthful readiness profile
    Given a control-plane hardening run has no mobile application
    When its environment preflight is evaluated
    Then control-plane readiness can be proven without native identifiers or devices
    And no mobile readiness fact is fabricated

  @id:SCN-HARD-008
  @requirement:REQ-HARD-001
  @preflight @mobile
  Scenario: A mobile workflow cannot select the control-plane profile
    Given a mobile application workflow lacks required native readiness
    When its environment preflight is evaluated
    Then the transition is blocked
    And choosing the control-plane profile cannot bypass the mobile requirements

