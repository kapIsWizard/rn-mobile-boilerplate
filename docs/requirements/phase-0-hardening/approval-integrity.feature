@feature:HUMAN-GATE-INTEGRITY
@risk:critical
Feature: Externally verifiable human approval
  A state transition that claims human approval must be bound to the exact
  reviewed artifacts and verified from a source the agent cannot impersonate.

  Background:
    Given the agent uses a dedicated GitHub App identity
    And the human reviewer uses a distinct allowlisted GitHub user identity
    And the gate workflow targets the expected protected environment

  @id:SCN-HARD-009
  @requirement:REQ-HARD-005 @requirement:REQ-HARD-006
  @approval @happy-path
  Scenario: Exact protected-environment approval advances one gate
    Given a gate request binds the repository, run, gate, revision, digests, commit, request ID, and expiry
    And the allowlisted human approves that request on the expected protected environment
    When the adapter independently verifies the workflow run and review history
    Then exactly that gate becomes eligible for transition
    And immutable approval provenance is persisted without credentials

  @id:SCN-HARD-010
  @requirement:REQ-HARD-008
  @approval @stale
  Scenario Outline: A mutated approval-bound field invalidates approval
    Given the human approved an exact gate request
    When the approved <field> differs from the current transition input
    Then approval verification fails closed
    And approval state is not mutated

    Examples:
      | field      |
      | repository |
      | run        |
      | gate       |
      | revision   |
      | digest     |
      | commit     |
      | request ID |

  @id:SCN-HARD-011
  @requirement:REQ-HARD-008
  @approval @replay
  Scenario: A consumed approval cannot be replayed
    Given an approval request was successfully consumed by its intended transition
    When the same request is presented again or for another run or gate
    Then approval verification fails closed
    And the original provenance remains unchanged

  @id:SCN-HARD-012
  @requirement:REQ-HARD-007 @requirement:REQ-HARD-008
  @approval @identity
  Scenario Outline: A non-human or conflicted reviewer cannot approve
    Given the review history attributes approval to <reviewer>
    When the adapter evaluates reviewer policy
    Then approval verification fails closed

    Examples:
      | reviewer                    |
      | the requesting agent app    |
      | the workflow actor          |
      | the request initiator       |
      | a bot                       |
      | a user outside the allowlist|

  @id:SCN-HARD-013
  @requirement:REQ-HARD-008
  @approval @availability
  Scenario Outline: Missing trustworthy external evidence blocks the gate
    Given the approval provider is <condition>
    When approval verification runs
    Then the transition is blocked
    And the outcome is classified without inventing approval

    Examples:
      | condition                    |
      | unavailable                  |
      | inconsistent                 |
      | missing review history       |
      | expired                      |
      | revoked or rejected          |

  @id:SCN-HARD-014
  @requirement:REQ-HARD-009
  @approval @manual
  Scenario: Development-only manual approval cannot authorize release
    Given the kernel is configured with the local manual adapter
    When any actor attempts to approve or enter a release state
    Then the transition is blocked
    And the diagnostic identifies the adapter as unenforced and development-only

  @id:SCN-HARD-015
  @requirement:REQ-HARD-006 @requirement:REQ-HARD-007
  @approval @trust-root
  Scenario: An untrusted branch cannot replace its approval policy
    Given a feature branch changes the gate workflow, reviewer policy, or trust-root configuration
    When that branch requests approval
    Then the trusted default-branch policy remains authoritative
    And the changed branch cannot self-authorize

