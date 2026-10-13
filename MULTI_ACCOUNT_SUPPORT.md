# Multi-account and shared-device changes

Fresh login/signup now fetches the authenticated profile before publishing the
session. Context and storage contain the same complete account. Session generations
discard previous-account responses, storage writes are serialized, and logout clears
the visible account immediately while completing push-token cleanup with the old JWT.
Profile refresh callbacks remain stable. A newer profile request wins over an older
one. Authorization refresh runs every 15 seconds and device association changes reset
screen caches without changing navigation layout.

Registration and profile editing use the same existing phone validation and trimming.
Phone numbers, dependent relationships, emergency contacts and notification settings
remain account-specific. A phone's Expo token transfers away from the previous
account when registered on the new account; tokens are no longer printed.

The existing Device.owner remains the primary owner. Device.guardians contains
accepted memberships; Device.invitations contains account-bound invitations with a
seven-day expiry. Existing devices with neither field still work for their owner.
The Profile screen adds a Device Sharing section using its existing styles:
owner invites a registered email, recipient accepts in their own Profile, owner revokes.
No invitation code, device API key, email service or new environment variable is used.
Knowing the physical device ID alone grants no access. Owners retain key rotation
and device update rights; sharing does not change Pi authentication or upload payloads.

GPS, history, events and Daily Activity read the authorized physical device's existing
records. No per-guardian GPS copies are made. Existing owner records lacking a device
field are included only for that owner's authorized device. SOS creates one alert;
each guardian's readBy state is independent, while legacy owner isRead values remain
valid. Information alerts remain private to their author. Revoked guardians lose
protected server access on their next request and are excluded from future delivery
checks. Open screens refresh authorization on the existing 15-second cadence.

SOS and low-battery pushes fan out to authorized guardians with individual preferences;
one delivery failure does not stop others. Offline delivery claims are stored per
guardian in a new OfflineGuardianDelivery collection, preserving legacy owner claims.
Daily claims remain per account/day. The battery threshold, two-minute offline
notification window, 24-hour eligibility and existing scheduler routes are preserved.
Device status keeps the existing 15-second heartbeat window. Dashboard status also
expires locally between requests; its JSX, SOS card and styles are unchanged.

## New authenticated routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/device/sharing` | Own devices/recipient invitations |
| POST | `/api/device/sharing/:deviceId/invite` | Owner invites `{ email }`; physical device ID |
| POST | `/api/device/sharing/:deviceId/accept` | Recipient accepts; MongoDB device `_id` from invitation |
| DELETE | `/api/device/sharing/:deviceId/guardians/:guardianId` | Owner revokes membership/pending invitation |

Existing routes and response fields remain available. Profile/login responses expose
the authorized device with current availability, excluding Pi key hashes, membership
lists and invitations.

## Changed files

- Backend controllers: `authController.js`, `deviceController.js`,
  `deviceSharingController.js` (new), `locationController.js`,
  `deviceSOSController.js`, `alertController.js`, `deviceEventController.js`.
- Backend models: `Device.js`, `Alert.js`, `Location.js`, `LiveLocation.js`,
  `DeviceEvent.js`; `User.js` is unchanged.
- Backend routes/middleware: `deviceRoutes.js`, `dailySummaryRoutes.js`,
  `deviceOfflineRoutes.js`, `authMiddleware.js` (reject reset-only JWTs).
- Backend services/utilities: `pushNotificationService.js`,
  `deviceAccessService.js` (new), `alertAccessService.js` (new), `utils/phone.js` (new).
- Frontend: `src/context/AuthContext.js`, `src/api/axiosConfig.js`,
  `src/api/sessionState.js` (new), `src/navigation/AppNavigator.js` (cache key only),
  `src/screens/DashboardScreen.js` (status calculation only),
  `src/screens/ProfileScreen.js` (sharing section only),
  `src/components/DeviceSharing.js` (new), and services `authService.js`,
  `deviceService.js`, `pushNotificationService.js`.
- Tests: `backend/tests/modelDouble.js`, `backend/tests/multiGuardian.test.js`,
  `frontend/tests/authSession.test.cjs` (all new).

## Validation

Run from the project root:

```powershell
node --test backend/tests/multiGuardian.test.js
node --test frontend/tests/authSession.test.cjs
```

16 backend tests and 11 frontend tests passed (27 total). Backend tests use real
Mongoose schemas and isolated in-memory persistence doubles.
They cover registration/phone edits, A/B/A login profiles, owner authorization,
invite acceptance/expiry/revoke, device-key validation, single GPS/SOS records,
shared history/events, heartbeat expiry, independent alert reads, notification
preferences, delivery failures, low-battery crossing, offline retry/deduplication,
daily activity/summary and legacy data. Frontend tests execute the actual AuthProvider
in a hook harness and the actual Axios interceptors with service/storage doubles;
they cover complete-profile gating, account switching, delayed responses/writes,
concurrent logins, stable refresh, edit refresh ordering, expired/offline restoration
and explicit-token cleanup. These are not live MongoDB, native Android or Pi tests.

All modified/new JavaScript is syntax/JSX checked. Dashboard JSX/styles and the
navigation layout are compared with the original Git version. No dependencies,
branding, splash/loading files, Pi scripts or device credentials are changed.

## Rollout and remaining real-device checks

No data migration, deletion or credential rotation is required. Membership/read fields
are additive. Mongoose creates the added device query indexes and the new per-guardian
offline delivery unique index through the existing connection defaults. Verify these
indexes exist after deployment; the local doubles cannot validate Atlas index creation.

After separate approval, deploy the backend changes to the existing Vercel project.
The existing database/environment settings and scheduler URLs stay the same. Then,
after separate APK-build approval, build/install the frontend using the existing workflow:

```powershell
Set-Location D:\SIGHTA-Guardian-App\frontend
npx --yes eas-cli@latest build --platform android --profile preview
```

A GitHub push alone cannot update an installed Android APK. None of these rollout
actions have been run as part of this change.

With the updated backend and APK, verify signup/edit phones in Atlas and on screen,
A/B/A switching, owner invite and recipient acceptance, unrelated-account rejection,
Pi GPS stop/reconnect, shared history/Daily Activity, SOS on both phones open/closed,
individual opt-outs, low-battery/offline/daily pushes, independent read states and
revocation. Confirm Dashboard/SOS layout, navigation and splash/loading/icon visually.
Actual battery/Wi-Fi telemetry remains limited to what the existing integration
already supplies; this change does not add hardware telemetry or redesign its display.
