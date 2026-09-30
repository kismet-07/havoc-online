# Equipment Runtime Boundary

The equipment system is split into four responsibilities:

- `equipment-slots.js`: shared slot identifiers.
- `equipment-data.js`: immutable item definitions and creation of item instances.
- `equipment-manager.js`: runtime equipped-item state.
- `equipment-attachment.js`: character attachment profiles and runtime bindings.

The current Brawler gauntlets are embedded in the skinned `Brawler_inplace.glb` asset. Therefore the Brawler `hands` attachment profile records the Mixamo hand anchors but does not instantiate a second mesh.

Standalone equipment models can later be introduced through the attachment layer without changing item definitions or enhancement state.

Enhancement remains an item property. VFX and combat/stat calculation must remain separate consumers.
