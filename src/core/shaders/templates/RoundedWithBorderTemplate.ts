import type { CoreShaderType } from '../../renderers/CoreShaderNode.js';
import { getBorderProps, type BorderProps } from './BorderTemplate.js';
import { RoundedTemplate, type RoundedProps } from './RoundedTemplate.js';
import type { PrefixedType } from '../utils.js';

export type RoundedWithBorderProps = RoundedProps &
  PrefixedType<BorderProps, 'border'> & {
    'border-fill': number;
  };

const props = Object.assign(
  {},
  RoundedTemplate.props,
  getBorderProps('border'),
  {
    'border-fill': 0x00000000,
  },
) as RoundedWithBorderProps;

export const RoundedWithBorderTemplate: CoreShaderType<RoundedWithBorderProps> =
  {
    props,
  };
