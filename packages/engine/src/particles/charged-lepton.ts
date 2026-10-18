/* ChargedLepton: electron, muon, tau and their antiparticles; magnetic dipole from the measured g-factor, Dirac value when unmeasured. */
import { BOHR_MAGNETON, ELECTRON_MASS_IN_MEV } from '@standard-model/constants';
import type {
  Decayable,
  DecayChannel,
  ElectricallyCharged,
  LeptonFlavor,
  MagneticDipole,
} from '@standard-model/contracts';
import { mevToGev } from '@standard-model/utils';
import {
  gyromagneticRatioFromMoment,
  leptonFlavorOf,
  meanLifeInSecondsFromSpec,
} from './capabilities.js';
import { Fermion } from './fermion.js';

const ELECTRON_MASS_IN_GEV = mevToGev(ELECTRON_MASS_IN_MEV.value);

export class ChargedLepton
  extends Fermion
  implements ElectricallyCharged, MagneticDipole, Decayable
{
  get electricChargeInElementaryUnits(): number {
    return this.spec.electricChargeInElementaryUnits;
  }

  get flavor(): LeptonFlavor {
    return leptonFlavorOf(this.spec);
  }

  get magneticMomentInJoulesPerTesla(): number {
    return (
      this.spec.magneticMomentInJoulesPerTesla?.value ?? this.diracMagneticMomentInJoulesPerTesla()
    );
  }

  get gyromagneticRatioInRadiansPerSecondPerTesla(): number {
    return gyromagneticRatioFromMoment(
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

  private diracMagneticMomentInJoulesPerTesla(): number {
    const chargeSign = Math.sign(this.spec.electricChargeInElementaryUnits);
    return chargeSign * BOHR_MAGNETON.value * (ELECTRON_MASS_IN_GEV / this.massInGev);
  }
}
