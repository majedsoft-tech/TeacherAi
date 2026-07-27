# Security Specification for Teacher Dashboard Firestore Rules

## 1. Data Invariants
- **Auth Integrity**: Each Quiz and Student document must be tied to a valid, authenticated teacher user whose `request.auth.uid` matches `resource.data.teacherId` (on read/update/delete) or `request.resource.data.teacherId` (on create/update).
- **ID Integrity**: All path variables (e.g., `quizId`, `studentId`) must be valid alphanumeric IDs formatted appropriately (`isValidId`).
- **Input Size Hardening**: String fields must have strictly enforced length limits to prevent Denial of Wallet and buffer issues.
- **Enumeration Constraints**: Status fields must only accept defined enums (`active`, `closed` for quizzes; `excellent`, `good`, `average`, `needs_improvement` for students).
- **Immutable Fields**: `teacherId` and `id` must never change once a document is created.

---

## 2. The "Dirty Dozen" Payloads (Malicious Payloads)

### Payload 1: Unauthenticated Creation (Quiz/Student)
- **Target Path**: `/quizzes/malicious-1`
- **Attempt**: Create a quiz without an authentication token.
- **Outcome**: `PERMISSION_DENIED`

### Payload 2: Teacher ID Spoofing (Quiz)
- **Target Path**: `/quizzes/malicious-2`
- **Attempt**: Authenticated user (UID: `teacher_123`) attempts to create a quiz with `teacherId` set to `teacher_456`.
- **Outcome**: `PERMISSION_DENIED`

### Payload 3: Cross-Teacher Write (Quiz)
- **Target Path**: `/quizzes/q1_other` (whose existing `teacherId` is `teacher_789`)
- **Attempt**: Authenticated user (UID: `teacher_123`) tries to edit.
- **Outcome**: `PERMISSION_DENIED`

### Payload 4: Invalid Status Enumeration (Quiz)
- **Target Path**: `/quizzes/q1`
- **Attempt**: Setting `status` to `"superseded"` instead of `"active"` or `"closed"`.
- **Outcome**: `PERMISSION_DENIED`

### Payload 5: Document ID Poisoning / Denial of Wallet (Quiz)
- **Target Path**: `/quizzes/some-extremely-long-1000-char-garbage-key-overflowing-buffer-attack-trying-to-exhaust-firestore-index-resources`
- **Attempt**: Creating a quiz with a toxically long document ID or invalid characters.
- **Outcome**: `PERMISSION_DENIED`

### Payload 6: Value Poisoning - Toxic Types
- **Target Path**: `/quizzes/q1`
- **Attempt**: Updating `durationMinutes` with a boolean value `true`, or a negative integer `-10`.
- **Outcome**: `PERMISSION_DENIED`

### Payload 7: Cross-Teacher Write (Student)
- **Target Path**: `/students/s1_other` (whose existing `teacherId` is `teacher_789`)
- **Attempt**: Authenticated user `teacher_123` tries to edit student info.
- **Outcome**: `PERMISSION_DENIED`

### Payload 8: Immutable TeacherId Alteration
- **Target Path**: `/students/s1`
- **Attempt**: Authenticated user `teacher_123` attempts to change `teacherId` from `teacher_123` to `teacher_abc`.
- **Outcome**: `PERMISSION_DENIED`

### Payload 9: Bulk Data List Theft (Blanket List Query)
- **Target Path**: `/students`
- **Attempt**: Querying student collections without filtering by `teacherId == request.auth.uid`.
- **Outcome**: `PERMISSION_DENIED`

### Payload 10: Array Guard Overrun
- **Target Path**: `/quizzes/q1`
- **Attempt**: Creating a quiz with `questions` array set to a flat string or containing malicious object structures that do not match the Question Schema.
- **Outcome**: `PERMISSION_DENIED`

### Payload 11: Invalid Student Performance Status
- **Target Path**: `/students/s1`
- **Attempt**: Updating student status to `"godlike_genius"` (invalid performance classification).
- **Outcome**: `PERMISSION_DENIED`

### Payload 12: Missing Required Student Schema Field
- **Target Path**: `/students/s_new`
- **Attempt**: Creating student without `detailedGrades` array.
- **Outcome**: `PERMISSION_DENIED`

---

## 3. Test Runner Design Outline
To run rules locally with the Firebase Emulator or in-memory, assertions on the above cases can be executed like:

```typescript
// Sample test structures:
import { assertFails, assertSucceeds, initializeTestEnv } from '@firebase/rules-unit-testing';

describe('Firestore Rules Security Tests', () => {
  it('prevents anonymous creation of quizzes', async () => {
    const db = getUnauthenticatedFirestore();
    await assertFails(db.doc('quizzes/q1').set({ title: 'Unauth' }));
  });

  it('enforces teacherId identity integrity', async () => {
    const db = getAuthenticatedFirestore({ uid: 'teacher_123' });
    await assertFails(db.doc('quizzes/q1').set({
      id: 'q1',
      teacherId: 'teacher_invalid',
      title: 'Math Quiz',
      subject: 'Math',
      durationMinutes: 30,
      status: 'active',
      dateCreated: '2026-06-03',
      questions: []
    }));
  });
});
```
