# Security Specification - Mutaba'ah Qur'an

## 1. Data Invariants
- **User Isolation**: A user can only access, create, or update their own user profile document `/users/{userId}` where `userId == request.auth.uid`.
- **Daily Reading Integrity**: A user can only write or read records in their own subcollection `/users/{userId}/records/{date}`.
- **Office Group Integrity**: Only authenticated users can access the community office groups.
- **Office Member State Partitioning**:
  - A user can only register or update their own colleague progress entry (`userId == request.auth.uid`).
  - Peer colleagues can ONLY increment the `duasReceived` counter (+1) and update `updatedAt`, and are strictly prohibited from altering reading statistics, pages, or user identification.
- **Boundary Limits**: All string inputs are constrained by `.size() <= max`, numbers are clamped within safe realistic ranges (e.g., pages 1-604, juz 1-30).
- **Default Deny**: All unspecified paths are closed by default (`match /{document=**} { allow read, write: if false; }`).

## 2. The Dirty Dozen Payloads (Audit Matrix)

| # | Attack Vector | Target Path | Injected Payload | Expected Result | Enforced Rule Gate |
|---|---|---|---|---|---|
| 1 | Identity Spoofing | `/users/victim-uid` | `{ userId: 'attacker-uid', ... }` | `PERMISSION_DENIED` | `request.auth.uid == userId` |
| 2 | Shadow Field Injection | `/users/{uid}` | `{ ..., isAdmin: true }` | `PERMISSION_DENIED` | `data.keys().hasOnly([...])` |
| 3 | Ghost Record Mutation | `/users/{uid}/records/{date}` | `{ ..., hackedField: 1337 }` | `PERMISSION_DENIED` | `isValidRecord()` strict keys |
| 4 | Denial-of-Wallet String Bomb | `/users/{uid}` | `{ displayName: 'A'.repeat(5000) }` | `PERMISSION_DENIED` | `data.displayName.size() <= 100` |
| 5 | ID Traversal Poisoning | `/users/..%2Fadmin` | Invalid path character | `PERMISSION_DENIED` | `isValidId(userId)` regex `^[a-zA-Z0-9_\-]+$` |
| 6 | Unauthenticated Record Read | `/users/{uid}/records/2026-03-01` | Read without auth token | `PERMISSION_DENIED` | `isSignedIn()` |
| 7 | Cross-User Record Snooping | `/users/other-uid/records` | Query by attacker | `PERMISSION_DENIED` | `request.auth.uid == userId` |
| 8 | Colleague Progress Hijacking | `/officeGroups/{g}/members/{victim}` | `{ totalPagesRead: 9999 }` by non-owner | `PERMISSION_DENIED` | `existing().userId == request.auth.uid` |
| 9 | Dua Multiplier Spam | `/officeGroups/{g}/members/{victim}` | `{ duasReceived: existing + 100 }` | `PERMISSION_DENIED` | `incoming().duasReceived == existing().duasReceived + 1` |
| 10 | Group Creation by Non-Creator | `/officeGroups/{g}` | `{ createdBy: 'someone-else' }` | `PERMISSION_DENIED` | `incoming().createdBy == request.auth.uid` |
| 11 | Out-of-Range Page Count | `/users/{uid}` | `{ lastReadPage: 999 }` | `PERMISSION_DENIED` | `data.lastReadPage >= 1 && data.lastReadPage <= 604` |
| 12 | Blanket Document Dump | `/{document=**}` | Direct unauthenticated crawl | `PERMISSION_DENIED` | Default deny catch-all |
