/* ParticlePicker: guided choice of a particle in three dropdowns, class, matter or antimatter, then the particle itself; nuclei and atoms have their own creation steps. */
import type { CatalogParticleName, ParticleCatalogEntry } from '@standard-model/contracts';
import { PARTICLE_GLOSSARY } from '../glossary';
import {
  MATTER_KIND_LABELS,
  PARTICLE_CLASS_LABELS,
  matterKindOf,
  particleClassOf,
  particlesIn,
  type MatterKind,
  type ParticleClass,
} from '../presets';
import { FIELD_ICONS, FieldLabel } from '../icons';
import { Select } from './select';
import { say } from '../language';

interface Props {
  readonly value: CatalogParticleName;
  readonly particles: readonly ParticleCatalogEntry[];
  readonly onChange: (name: CatalogParticleName) => void;
}

const CLASSES: readonly ParticleClass[] = ['fermion', 'boson', 'hadron'];
const KINDS: readonly MatterKind[] = ['matter', 'antimatter'];

export function ParticlePicker({ value, particles, onChange }: Props) {
  const current = particles.find((entry) => entry.name === value);
  const particleClass = (current === undefined ? null : particleClassOf(current)) ?? 'fermion';
  const kind = current === undefined ? 'matter' : matterKindOf(current);
  const choices = particlesIn(particles, particleClass, kind);

  const pickFirst = (nextClass: ParticleClass, nextKind: MatterKind): void => {
    const [first] = particlesIn(particles, nextClass, nextKind);
    if (first !== undefined) {
      onChange(first.name as CatalogParticleName);
    }
  };

  return (
    <>
      <label
        data-tooltip={say(
          'Фермионы это кварки, лептоны и нейтрино; бозоны это переносчики и Хиггс; адроны это мезоны и барионы PDG, среди них протон. Ядра и атомы создаются своими шагами: «Создать ядро» и «Создать атом»',
          'Fermions are quarks, leptons and neutrinos; bosons are the force carriers and the Higgs; hadrons are the PDG mesons and baryons, the proton among them. Nuclei and atoms have their own steps: Create nucleus and Create atom',
        )}
      >
        <FieldLabel icon={FIELD_ICONS.particleClass}>{say('Класс', 'Class')}</FieldLabel>
        <Select
          value={particleClass}
          options={CLASSES}
          labels={PARTICLE_CLASS_LABELS}
          onChange={(next) =>
            pickFirst(
              next as ParticleClass,
              particlesIn(particles, next as ParticleClass, kind).length > 0 ? kind : 'matter',
            )
          }
        />
      </label>
      <label
        data-tooltip={say(
          'Античастица имеет те же массу и спин, но противоположные заряд и квантовые числа',
          'An antiparticle has the same mass and spin but opposite charge and quantum numbers',
        )}
      >
        <FieldLabel icon={FIELD_ICONS.matter}>
          {say('Вещество или антивещество', 'Matter or antimatter')}
        </FieldLabel>
        <Select
          value={kind}
          options={KINDS.filter(
            (candidate) => particlesIn(particles, particleClass, candidate).length > 0,
          )}
          labels={MATTER_KIND_LABELS}
          onChange={(next) => {
            const counterpart = current?.antiparticleName;
            const counterpartEntry = particles.find((entry) => entry.name === counterpart);
            if (counterpartEntry !== undefined && matterKindOf(counterpartEntry) === next) {
              onChange(counterpartEntry.name as CatalogParticleName);
              return;
            }
            pickFirst(particleClass, next as MatterKind);
          }}
        />
      </label>
      <label data-tooltip={PARTICLE_GLOSSARY[value] ?? ''}>
        <FieldLabel icon={FIELD_ICONS.particle}>{say('Частица', 'Particle')}</FieldLabel>
        <Select
          value={value}
          options={choices.map((entry) => entry.name)}
          titles={PARTICLE_GLOSSARY}
          onChange={(next) => onChange(next as CatalogParticleName)}
        />
      </label>
    </>
  );
}
