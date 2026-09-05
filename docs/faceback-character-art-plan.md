# FACEBACK.CAM character art plan

## Source of truth

Every character asset uses one adult base character, one isometric camera, one light direction, one 96×96 runtime frame and a shared foot baseline. The master source contains four direction columns (northwest, northeast, southeast, southwest) and four action rows (stand, walk, sit, dance).

`public/coke-music/art/avatar/master-v2.png` is the first master. The four runtime sheets are slices of this file, not independently generated characters.

## Acceptance rules

- The head is about one fifth of the full height; reject childlike or chibi proportions.
- Hands, arms, legs and feet remain attached and anatomically consistent.
- Direction, body size, face, lighting and baseline do not drift between frames.
- Stand, walk, sit and dance have visibly different poses.
- A garment must change the silhouette to count as a separate choice. Recolours are colour choices.
- Hair, clothing and accessories must be generated from this master and tested over every supported direction and action.
- Accessories start unequipped. Headphones, shades and hats are optional.
- Test assets in the normal loaded-asset renderer on a narrow phone viewport before release.

## Wardrobe production order

1. Base body and four required actions.
2. Eight hair silhouettes across all directions.
3. Eight tops, eight bottoms and five shoes, each checked in all actions.
4. Eight optional accessories with explicit hair compatibility.
5. Additional body builds only after clothing deformation and performance pass.

## Asset manifest

Each asset records: category, style ID, source master version, directions, actions, layer order, hidden body regions, colourable regions, incompatible combinations and validation status.
