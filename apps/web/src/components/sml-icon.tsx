/* SmlIcon: the standard model lab icon set (24×24 grid, 1.75 stroke, accent through --icon-accent) rendered from the bundled icon bodies; sml(name) gives a component with the lucide props shape. */
import icons from '../sml-icons.json';

const BODIES: ReadonlyMap<string, string> = new Map(icons.map((icon) => [icon.name, icon.body]));
const DEFAULT_SIZE = 18;
const DEFAULT_STROKE = 1.75;

export interface IconProps {
  readonly size?: number;
  readonly x?: number;
  readonly y?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
  readonly 'aria-hidden'?: boolean | 'true' | 'false';
  readonly 'aria-label'?: string;
}

export type IconComponent = (props: IconProps) => React.JSX.Element;

export function hasSmlIcon(name: string): boolean {
  return BODIES.has(name);
}

export function SmlIcon({
  name,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
  className,
  ...aria
}: IconProps & { readonly name: string }) {
  return (
    <svg
      className={className === undefined ? 'sml-icon' : `sml-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...aria}
      dangerouslySetInnerHTML={{ __html: BODIES.get(name) ?? '' }}
    />
  );
}

const COMPONENTS = new Map<string, IconComponent>();

export function sml(name: string): IconComponent {
  const cached = COMPONENTS.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const component: IconComponent = (props) => <SmlIcon name={name} {...props} />;
  COMPONENTS.set(name, component);
  return component;
}
