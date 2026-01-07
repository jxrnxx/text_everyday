import { BaseModifier, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';
import * as json_heroes from '../json/npc_heroes_custom.json';

@registerModifier('modifier_custom_stats_handler')
export class modifier_custom_stats_handler extends BaseModifier {
    mainStat: string = '';

    IsHidden(): boolean {
        return true;
    }

    IsPurgable(): boolean {
        return false;
    }

    IsPermanent(): boolean {
        return true;
    }

    OnCreated(params: any): void {
        if (!IsServer()) return;

        const parent = this.GetParent();
        const unitName = parent.GetUnitName();

        // 从配置读取主属性 / Read main stat from JSON
        // @ts-ignore
        const heroData = json_heroes[unitName];
        if (heroData && heroData.CustomMainStat) {
            this.mainStat = heroData.CustomMainStat;
        } else {
            // 默认兜底 / Default fallback
            this.mainStat = 'Martial';
        }

        this.StartIntervalThink(1.0);
    }

    DeclareFunctions(): ModifierFunction[] {
        return [ModifierFunction.HEALTH_BONUS, ModifierFunction.HEALTH_REGEN_CONSTANT, ModifierFunction.BASEATTACK_BONUSDAMAGE];
    }

    GetModifierHealthBonus(): number {
        // constitution * 50
        const constitution = CustomStats.GetStat(this.GetParent(), 'constitution');
        return constitution * 50;
    }

    GetModifierConstantHealthRegen(): number {
        // constitution * 0.5
        const constitution = CustomStats.GetStat(this.GetParent(), 'constitution');
        return constitution * 0.5;
    }

    GetModifierBaseAttack_BonusDamage(): number {
        const parent = this.GetParent();
        const main = this.mainStat;

        if (main === 'Martial') {
            const val = CustomStats.GetStat(parent, 'martial');
            return val * 2.0;
        } else if (main === 'Divinity') {
            const val = CustomStats.GetStat(parent, 'divinity');
            return val * 2.0;
        }

        return 0;
    }
}
