// Type declarations for Lucide React icons compatibility
declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = FC<LucideProps>;

  // Common icons used in the project
  export const AlertCircle: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Info: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Check: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const X: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Plus: LucideIcon;
  export const Minus: LucideIcon;
  export const Settings: LucideIcon;
  export const Copy: LucideIcon;
  export const Trash2: LucideIcon;
  export const Save: LucideIcon;
  export const Play: LucideIcon;
  export const Code: LucideIcon;
  export const Type: LucideIcon;
  export const Mail: LucideIcon;
  export const Lock: LucideIcon;
  export const Hash: LucideIcon;
  export const Link: LucideIcon;
  export const Phone: LucideIcon;
  export const AlignLeft: LucideIcon;
  export const List: LucideIcon;
  export const Square: LucideIcon;
  export const Circle: LucideIcon;
  export const Upload: LucideIcon;
  export const Calendar: LucideIcon;
  export const Clock: LucideIcon;
  export const Palette: LucideIcon;
  export const Sliders: LucideIcon;
  export const ToggleLeft: LucideIcon;
  export const FileText: LucideIcon;
  export const Image: LucideIcon;
  export const Star: LucideIcon;
  export const CheckSquare: LucideIcon;
  export const DollarSign: LucideIcon;
  export const Grid3x3: LucideIcon;
  export const PenTool: LucideIcon;
  export const MapPin: LucideIcon;
  export const Loader2: LucideIcon;
  export const CheckIcon: LucideIcon;
  export const MinusIcon: LucideIcon;
}