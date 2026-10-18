/* Three-vector arithmetic for momenta, positions and field directions. */
import type { Vector3 } from '@standard-model/contracts';

export const ZERO_VECTOR: Vector3 = { x: 0, y: 0, z: 0 };

export function vectorMagnitude(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function dotProduct(first: Vector3, second: Vector3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

export function scaleVector(vector: Vector3, factor: number): Vector3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

export function addVectors(first: Vector3, second: Vector3): Vector3 {
  return { x: first.x + second.x, y: first.y + second.y, z: first.z + second.z };
}

export function subtractVectors(first: Vector3, second: Vector3): Vector3 {
  return { x: first.x - second.x, y: first.y - second.y, z: first.z - second.z };
}
