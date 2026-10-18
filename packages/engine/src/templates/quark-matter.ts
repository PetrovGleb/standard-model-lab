/* Templates of quark matter: a proton and a neutron dropped into an equilibrium plasma of quarks and gluons hotter than the QCD crossover melt into their quarks, and when the plasma cools below
   the crossover the quarks bind into hadrons again; the densities of the plasma are the ideal quantum gas at its temperature, nothing in the template places a quark by hand. */
import { BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN } from '@standard-model/constants';
import { experiment } from '../experiment/experiment-builder.js';

const HOT_TEMPERATURE_IN_EV = 3e8;
const COOLED_TEMPERATURE_IN_EV = 1e8;
const MELTING_TIME_IN_SECONDS = 1e-23;
const FREEZE_OUT_TIME_IN_SECONDS = 1e-22;
const SOUP_SHOTS = 1000;
const PLASMA_SPECIES = ['up', 'antiUp', 'down', 'antiDown', 'strange', 'antiStrange', 'gluon'];

function plasma(temperature: string) {
  return {
    components: PLASMA_SPECIES.map((species) => ({
      species,
      numberDensityPerCubicMeter: 0,
      densityLaw: 'thermalEquilibrium',
    })),
    temperatureInKelvin: temperature,
  };
}

export const QUARK_GLUON_SOUP_TEMPLATE = experiment('quarkGluonSoup')
  .describe(
    'Протон и нейтрон в кварк-глюонной плазме при 300 МэВ (3,5·10¹² К), как в первые микросекунды Вселенной или в столкновении тяжелых ионов на LHC. Плотности кварков и глюонов среды не заданы руками: это идеальный квантовый газ при температуре среды, n = g/(2π²)(kT/ħc)³∫x²dx/(e^√(x²+(m/kT)²) ± 1), где g считается из спина и цвета. Выше температуры перехода из решеточной КХД, 156,5 МэВ (PDG), цвет не заперт: нуклоны плавятся на свои кварки u, u, d и u, d, d с тепловыми импульсами среды. Потом плазма остывает до 100 МэВ, и конфайнмент снова собирает кварки в адроны — тем же законом, что работает после столкновений. В замерах видна фаза «кварк-глюонная плазма»',
  )
  .categorize('confinement')
  .shots(SOUP_SHOTS)
  .parameter(
    'hotTemperatureInKelvin',
    HOT_TEMPERATURE_IN_EV / BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value,
  )
  .parameter(
    'cooledTemperatureInKelvin',
    COOLED_TEMPERATURE_IN_EV / BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value,
  )
  .influence('setMedium', plasma('{{hotTemperatureInKelvin}}'))
  .create('proton', 'proton')
  .create('neutron', 'neutron')
  .evolve(MELTING_TIME_IN_SECONDS)
  .measureSystem('hot')
  .influence('setMedium', plasma('{{cooledTemperatureInKelvin}}'))
  .evolve(FREEZE_OUT_TIME_IN_SECONDS)
  .measureSystem('cooled')
  .report('frequency', ['hot'], 'Состав в горячей плазме')
  .report('frequency', ['hot.phase'], 'Фаза в горячей плазме')
  .report('mean', ['cooled.hadronCount'], 'Адронов после остывания')
  .report('frequency', ['cooled.heaviest'], 'Самая тяжелая частица после остывания')
  .build();

export const QUARK_MATTER_TEMPLATES = [QUARK_GLUON_SOUP_TEMPLATE];
