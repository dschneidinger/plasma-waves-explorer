// World-space layout shared by the renderers (kept free of three.js so pure
// modules and tests can import it).

export const WORLD = {
  wavelengths: 3, // plane-wave default; packets show more
  L: 12, // length along k
  W: 6, // width of the plane
  H: 1.1, // height of a unit-amplitude crest
};
WORLD.lambda = WORLD.L / WORLD.wavelengths;
WORLD.floorY = -1.6 * WORLD.H;
