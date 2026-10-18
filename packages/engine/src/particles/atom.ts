/* Atom: a nucleus with bound electrons; mass includes the NIST electron binding, the magnetic moment comes from the Landé factor of the ground level, decays follow the nucleus with the electrons kept bound. */
import type { Decayable, DecayChannel, MagneticDipole } from '@standard-model/contracts';
import { gyromagneticRatioFromMoment, meanLifeInSecondsFromSpec } from './capabilities.js';
import { CompositeParticle } from './composite-particle.js';

export class Atom extends CompositeParticle implements Decayable, MagneticDipole {
  get magneticMomentInJoulesPerTesla(): number {
    return this.spec.magneticMomentInJoulesPerTesla?.value ?? 0;
  }

  get gyromagneticRatioInRadiansPerSecondPerTesla(): number {
    return this.spec.spinInReducedPlanckUnits === 0
      ? 0
      : gyromagneticRatioFromMoment(
          this.magneticMomentInJoulesPerTesla,
          this.spec.spinInReducedPlanckUnits,
        );
  }

  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays;
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }
}
