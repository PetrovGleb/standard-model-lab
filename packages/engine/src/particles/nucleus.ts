/* Nucleus: bound protons and neutrons such as d, t, ³He and ⁴He, with the CODATA magnetic dipole and the triton beta decay. */
import type { Decayable, DecayChannel, MagneticDipole } from '@standard-model/contracts';
import { gyromagneticRatioFromMoment, meanLifeInSecondsFromSpec } from './capabilities.js';
import { CompositeParticle } from './composite-particle.js';

export class Nucleus extends CompositeParticle implements MagneticDipole, Decayable {
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
