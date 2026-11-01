# Consent boxes K1 to K9: current wording and gentler proposals (not applied)

The consent box texts are hashed and versioned (`apps/edge/src/consent-text.json`, `CONSENT_VERSION` 2026-10-15). Changing a word changes what a person ticked, so the wording pass left every box untouched. Applying any proposal below needs a new `CONSENT_VERSION`, the same text in `terms.html` (the box table) and the tests that pin it.

| Box | Current text | Proposed gentler text |
|---|---|---|
| K1 A | I have read and agree to the Terms & Conditions, the Privacy Policy and the Refund Policy. | Keep as it is (positive already). |
| K1 B | I confirm: players pay nothing to play. I provide and hand over any prize. This game is allowed in my State. I am allowed to invite these guests. | I confirm that players play free of charge, that I provide and hand over any prize, that this game is allowed in my State, and that I may invite these guests. |
| K2 A | I have read and agree to the Terms & Conditions and the Privacy Policy. | Keep as it is. |
| K3 A | I agree to the Terms and the Refund Policy. I understand there is no refund; my payment stays as credit. | I agree to the Terms and the Refund Policy. I understand that if the game is cancelled, my payment stays with me as credit for my next game, in place of a refund. |
| K4 A | ... The final places are kept for 365 days as seat numbers, without names. We keep billing data for audit and tax reasons. This notice is available in Hindi on request. | ... The final places are kept for 365 days as seat numbers, without names. Billing data is kept for audit and tax reasons. This notice is available in Hindi on request. |
| K4 B | I am 18 or older. | Keep as it is. |
| K5 A | I will not charge any player. I will hand over prizes as the organizer decides. I follow the Terms. | I will keep the game free for every player. I will hand over prizes as the organizer decides. I follow the Terms. |
| K6 A | I am allowed to use these names and numbers for this game. The people have been told. | Keep as it is. |
| K7 A | I agree to the Terms, the Privacy Policy and the Refund Policy linked here. I understand there is no promise of funding or results. | I agree to the Terms, the Privacy Policy and the Refund Policy linked here. I understand that funding and results are not promised. |
| K9 A | I agree that you may use my details to reply to this request. | Keep as it is. |

The K4 sentence "We keep billing data for audit and tax reasons." is also the only first-person sentence left in the customer-visible text; `apps/web/test/no-first-person.test.ts` lists it as the one kept exception until K4 gets its new version.
