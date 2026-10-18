/* Checks the Lorentz boost, invariant mass and the sequential id generator. */
import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../src/identity.js';
import { invariantMassInGev, lorentzBoost } from '../src/kinematics.js';

describe('lorentzBoost', () => {
  it('turns a particle at rest into momentum gamma m v with the same invariant mass', () => {
    const massInGev = 2;
    const boosted = lorentzBoost(
      { energy: massInGev, momentum: { x: 0, y: 0, z: 0 } },
      { x: 0.6, y: 0, z: 0 },
    );
    expect(boosted.energy).toBeCloseTo(2.5, 12);
    expect(boosted.momentum.x).toBeCloseTo(1.5, 12);
    expect(invariantMassInGev(boosted)).toBeCloseTo(massInGev, 12);
  });

  it('is the identity for zero velocity and rejects light speed', () => {
    const fourMomentum = { energy: 3, momentum: { x: 1, y: 1, z: 1 } };
    expect(lorentzBoost(fourMomentum, { x: 0, y: 0, z: 0 })).toBe(fourMomentum);
    expect(() => lorentzBoost(fourMomentum, { x: 1, y: 0, z: 0 })).toThrow();
  });
});

describe('createSequentialIdGenerator', () => {
  it('counts per prefix independently', () => {
    const ids = createSequentialIdGenerator();
    expect(ids.next('electron')).toBe('electron-1');
    expect(ids.next('photon')).toBe('photon-1');
    expect(ids.next('electron')).toBe('electron-2');
  });
});
