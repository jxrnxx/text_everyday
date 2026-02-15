/**
 * 武道·横扫 (Martial Cleave)
 * Category: PUBLIC | Star: 1 | Element: MARTIAL
 *
 * 被动技能：攻击时对目标周围敌人造成溅射伤害
 * 特效：Sven 大分裂地面扇形波 (黑白色)
 */

import { BaseAbility, BaseModifier, registerAbility, registerModifier } from '../utils/dota_ts_adapter';

@registerAbility('ability_public_martial_cleave')
export class ability_public_martial_cleave extends BaseAbility {
    GetIntrinsicModifierName(): string {
        return 'modifier_public_martial_cleave';
    }

    Precache(context: CScriptPrecacheContext) {
        PrecacheResource('particle', 'particles/sven_spell_great_cleave_text.vpcf', context);
    }
}

@registerModifier('modifier_public_martial_cleave')
export class modifier_public_martial_cleave extends BaseModifier {
    cleave_percent: number = 30;
    cleave_start_width: number = 150;
    cleave_end_width: number = 360;
    cleave_distance: number = 650;

    OnCreated(params: any): void {
        const ability = this.GetAbility();
        if (ability) {
            const percent = ability.GetSpecialValueFor('cleave_percent');
            this.cleave_percent = percent && percent > 0 ? percent : 30;

            const startWidth = ability.GetSpecialValueFor('cleave_start_width');
            this.cleave_start_width = startWidth && startWidth > 0 ? startWidth : 150;

            const endWidth = ability.GetSpecialValueFor('cleave_end_width');
            this.cleave_end_width = endWidth && endWidth > 0 ? endWidth : 360;

            const distance = ability.GetSpecialValueFor('cleave_distance');
            this.cleave_distance = distance && distance > 0 ? distance : 650;
        }
    }

    IsHidden(): boolean {
        return true;
    }
    IsPurgable(): boolean {
        return false;
    }
    RemoveOnDeath(): boolean {
        return false;
    }

    DeclareFunctions(): ModifierFunction[] {
        return [ModifierFunction.ON_ATTACK_LANDED];
    }

    OnAttackLanded(event: ModifierAttackEvent): void {
        if (!IsServer()) return;
        const attacker = event.attacker;
        const target = event.target;
        if (attacker !== this.GetParent()) return;

        const damage = event.original_damage * (this.cleave_percent / 100);

        // DoCleaveAttack 内部会设置 CP0-CP17 + 扇形伤害 + 粒子特效
        DoCleaveAttack(
            attacker,
            target,
            this.GetAbility(),
            damage,
            this.cleave_start_width,
            this.cleave_end_width,
            this.cleave_distance,
            'particles/sven_spell_great_cleave_text.vpcf'
        );
    }
}
