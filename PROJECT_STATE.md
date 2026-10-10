# Project state
Design: hybrid GTA-like life/crime simulation, Bullet Echo-inspired top-down 2.5D movement and shooting; persistent multiplayer world with vehicles, properties, stores, jobs, heists, crews and economy. Target browser-first iPhone/PC.
Current implementation: one HTML file with Canvas 2D, no external dependencies, local simulation only.
Architecture target: Phaser client; Colyseus authoritative game server; database chosen later; shared schemas and automated tests. Safety/gameplay: safe zones, optional PvP, anti-cheat, anti-griefing and economy controls.
Art: placeholder geometric pixel art; replace with cohesive sprites at consistent scale. Preserve performant rendering on mobile.
