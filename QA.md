# v0.14 device acceptance checks
This is a checklist for an actual browser/device, not a claim that these checks ran. Node suites and Canvas rendering do not exercise native touch, audio or file dialogs. Use the owning account for the private preview; avoid importing a valuable save while testing with disposable progress.

| Area | Steps | Expected result |
| --- | --- | --- |
| Touch | Hold movement with one finger, aim with another, press FIRE with a third; release each independently | Movement/aim stay independent; releasing FIRE stops shooting; cancellation leaves no held input |
| Orientation | Rotate between portrait and landscape, open MORE, MAP and BAG | Controls remain reachable; menus scroll; map taps select the intended nearby service |
| Focus | Hold movement, switch apps, then return | No stuck walking/firing and no long movement catch-up |
| Driving | Find starter car with MAP or minimap; ENTER; accelerate/steer/reverse; hold BRAKE then EXIT | Cars differ in handling, stop before exit, and do not rotate when stationary |
| Shop | MAP → nearest corner shop; approach entrance, SHOP; walk to counter, USE | Walkable shop and trade menu open; ammo/medkit/pistol purchases charge once; valuables sales deplete carried stock |
| Health | Lose some health, BAG → medkit USE; try again at full health | Heals at most 40, capped at 100; full health does not consume another kit |
| Courier | JOB, travel GPS to pickup, JOB; travel GPS to delivery, JOB | Parcel appears then is consumed; cash increases $225 exactly once; refresh preserves an active job |
| Apartment | Earn $1,200, HOME, buy then enter; approach bed, wardrobe, storage | Bed heals, STYLE previews/saves outfit, stash accepts transfers; storage pauses room movement |
| Custody | Put cash/items in stash or glovebox, carry others, die; return to bag within two minutes | Carried goods drop, protected goods remain, LOOT recovers only available bag contents |
| Police | ROB an unrobbed NPC while carrying pistol; move behind buildings or GIVE UP | No repeated NPC payment; police dispatch, visible shots stop at walls; surrender charges up to $150 |
| Audio | MORE → SOUND, shoot/reload/drive; mute and switch apps | Sound starts only after gesture; mute/focus loss stops engine tone; no console errors |
| Backups | SAVES → download; change progress; restore downloaded file; undo restore | Original progress returns after reload; undo restores pre-import progress; malformed file leaves current data intact |

## Automated checks
`npm run check` covers static bundle integrity, mock touch pointer ownership, menu isolation, clock/physics consistency, delayed reloads, inventory custody, economy bounds and fresh-context persistence. Browser harness is separate; it now opens MORE before accessing STYLE. Existing test scripts are not a substitute for the native checks above.
