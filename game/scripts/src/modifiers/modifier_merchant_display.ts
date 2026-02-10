/**
 * modifier_merchant_display.ts
 * 商人显示修饰器 - 隐藏血条、不可攻击、不可选中
 */

import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';

@registerModifier('modifier_merchant_display')
export class modifier_merchant_display extends BaseModifier {
    IsHidden(): boolean {
        return true;
    }

    IsPurgable(): boolean {
        return false;
    }

    RemoveOnDeath(): boolean {
        return false;
    }

    CheckState(): Partial<Record<ModifierState, boolean>> {
        return {
            [ModifierState.NO_HEALTH_BAR]: true,
            [ModifierState.INVULNERABLE]: true,
            [ModifierState.NOT_ON_MINIMAP]: true,
            [ModifierState.NO_UNIT_COLLISION]: true,
        };
    }
}
