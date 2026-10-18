/* Three-component vectors and four-momentum used for positions, momenta and field directions. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FourMomentumInGev {
  readonly energy: number;
  readonly momentum: Vector3;
}
