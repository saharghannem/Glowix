# Firebase Security Specification - Glowix

## 1. Data Invariants
- **Multi-Tenancy**: Every Device and Telemetry packet MUST belong to a valid Client ID.
- **Identity Integrity**: Clients can only be managed by Administrators.
- **Device Registration**: Devices require a valid `clientId` to be registered.
- **Telemetry Origin**: Telemetry data must include a valid `deviceId`.
- **System Integrity**: Alerts with `deviceId: 'SYSTEM'` can only be created by the system logic (mocked via rules for now, but strictly validated).

## 2. The "Dirty Dozen" Payloads (Abridged for Test Planning)
1. **Identity Spoofing**: Attempt to create a client with a fake `ownerId`.
2. **Resource Poisoning**: Use a 1MB string as a `clientId`.
3. **State Shortcutting**: Change a device status from `inactive` to `active` without being an admin.
4. **PII Leak**: Non-admin user attempts to read client contact info.
5. **Orphaned Write**: Create telemetry for a non-existent device ID.
6. **Immutable Violation**: Attempt to change `createdAt` on an existing client.
7. **Type Poisoning**: Sending a boolean where a string (status) is expected.
8. **Malicious ID**: Using `../` or script tags in a document ID.

## 3. Test Runner Plan
- Location: `src/tests/firestore.rules.test.ts` (To be implemented once project linkage is fixed or simulated environment is set up).
