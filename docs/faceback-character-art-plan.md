# FACEBACK.CAM character art plan

## Source of truth

Every character asset uses one adult base character, one isometric camera, one light direction, one 96×96 runtime frame and a shared foot baseline. The master source contains four direction columns (northwest, northeast, southeast, southwest) and four action rows (stand, walk, sit, dance).

The production masters and fitted layers live under `public/coke-music/art/avatar/generated`. Their runtime sheets are slices of AI-generated 4×4 atlases, not independently drawn canvas shapes.

## Acceptance rules

- The head is about one fifth of the full height; reject childlike or chibi proportions.
- Hands, arms, legs and feet remain attached and anatomically consistent.
- Direction, body size, face, lighting and baseline do not drift between frames.
- Stand, walk, sit and dance have visibly different poses.
- A garment must change the silhouette to count as a separate choice. Recolours are colour choices.
- Every visible body, hairstyle, garment, shoe and accessory must originate from an AI-generated image sheet. Runtime code may slice, align, recolour and animate those pixels, but it must not draw replacement character art.
- Every wearable is generated against the matching body master in all four directions and actions, then composited in the same fixed frame grid.
- Accessories start unequipped. Headphones, shades and hats are optional.
- Test assets in the normal loaded-asset renderer on a narrow phone viewport before release.

## Wardrobe production order

1. Base body and four required actions.
2. Six hair silhouettes across all directions.
3. Four tops, three bottoms and three shoes, each checked in all actions.
4. Three optional accessories with explicit hair compatibility.
5. Additional body builds only after clothing deformation and performance pass.

## Asset manifest

Each asset records: category, style ID, source master version, directions, actions, layer order, hidden body regions, colourable regions, incompatible combinations and validation status.
