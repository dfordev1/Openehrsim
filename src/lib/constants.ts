/**
 * Shared clinical-simulation constants. Centralised here so the sentinel
 * strings used across client + server stay in sync — changing the value
 * in one place updates ExamTab, generate-case.ts, examine-system.ts, and
 * server.ts (which import from here via a relative path).
 */

/** Placeholder value written into every `physicalExam` field by the case
 *  generator. The client treats any field equal to this string as "not
 *  yet revealed" and gates the real finding behind an Examine action. */
export const LOCKED_SENTINEL = 'Not yet examined';

/** LocalStorage key prefix used by the reasoning draft autosaver. The
 *  final key is `${PR_DRAFT_STORAGE_PREFIX}${caseId}`. */
export const PR_DRAFT_STORAGE_PREFIX = 'openehr.prDraft.';

/** LocalStorage key recording whether a user has seen the onboarding
 *  tour. Presence of the key (any truthy value) suppresses the tour. */
export const ONBOARDING_SEEN_KEY = 'openehr.onboardingSeen.v1';
