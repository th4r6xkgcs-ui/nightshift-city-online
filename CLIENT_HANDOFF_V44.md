# Client v0.44 — Clean materials and foliage

Responds to feedback that the art remains grainy and cheap. Removed dense asphalt specks, yard flecks and roof grain. Broad shaded road fields, facade/roof material washes and dimensional window glass carry volume. Reduced corrugation frequency and masonry contrast. Curved tapered palm leaves and overlapping broadleaf masses replace blocky square foliage, with identical cached and depth-sorted crown shapes.

This is a cleaner illustrated environment direction, not a completed high-fidelity character/vehicle rebuild. Current character scale and coarse sprite proportions remain a larger follow-up task. No blur filter, bitmap dependency or gameplay change. Collision, saves, interaction anchors and Claude's magazine contract remain unchanged.

Touched world.js, game.js/index.html/package.json version labels and this handoff. Based on codex/visual-release-v43; no backend/shared/online/worker/RPG edits or merges. Reserved via PR #3.

Validation: all 65 suites and root syntax checks passed; actual daytime landscape and wet-night portrait Canvas renders inspected. Ground remains cached; gradients use bounded visible buildings and a solid fallback when unsupported. Physical iPhone touch/browser/DOM/audio and measured performance QA remain pending.
