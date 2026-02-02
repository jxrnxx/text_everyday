/**
 * 武道·横扫 (Martial Cleave)
 * Category: PUBLIC | Star: 1 | Element: MARTIAL
 *
 * 被动技能：攻击时对目标周围敌人造成溅射伤害
 */

import { BaseAbility, BaseModifier, registerAbility, registerModifier } from '../utils/dota_ts_adapter';

@registerAbility('ability_public_martial_cleave')
export class ability_public_martial_cleave extends BaseAbility {
    GetIntrinsicModifierName(): string {
        return 'modifier_public_martial_cleave';
    }

    Precache(context: CScriptPrecacheContext) {
        PrecacheResource('particle', 'particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf', context);
    }
}

@registerModifier('modifier_public_martial_cleave')
export class modifier_public_martial_cleave extends BaseModifier {
    // 技能数值
    cleave_percent: number = 30;
    cleave_start_width: number = 150;
    cleave_end_width: number = 350;
    cleave_distance: number = 650;

    OnCreated(params: any): void {
        const ability = this.GetAbility();
        if (ability) {
            const percent = ability.GetSpecialValueFor('cleave_percent');
            this.cleave_percent = percent && percent > 0 ? percent : 30;

            const startWidth = ability.GetSpecialValueFor('cleave_start_width');
            this.cleave_start_width = startWidth && startWidth > 0 ? startWidth : 150;

            const endWidth = ability.GetSpecialValueFor('cleave_end_width');
            this.cleave_end_width = endWidth && endWidth > 0 ? endWidth : 350;

            const distance = ability.GetSpecialValueFor('cleave_distance');
            this.cleave_distance = distance && distance > 0 ? distance : 650;
        }
    }

    IsHidden(): boolean {
        return true; // 被动技能不显示buff图标
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

        // 计算溅射伤害
        const originalDamage = event.original_damage;
        const cleaveDamage = originalDamage * (this.cleave_percent / 100);

        // 执行溅射攻击
        this.DoCleaveAttack(attacker, target, cleaveDamage);
    }

    /**
     * 执行溅射攻击
     */
    private DoCleaveAttack(attacker: CDOTA_BaseNPC, target: CDOTA_BaseNPC, damage: number): void {
        const ability = this.GetAbility();
        const origin = attacker.GetAbsOrigin();
        const forward = attacker.GetForwardVector();
        const forward2D = Vector(forward.x, forward.y, 0).Normalized();

        // 主溅射特效 - 使用Juggernaut暴击特效（已验证可用）
        const cleaveVisual = ParticleManager.CreateParticle(
            'particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            attacker
        );
        ParticleManager.ReleaseParticleIndex(cleaveVisual);

        // 查找溅射范围内的敌人 (锥形区域)
        const enemies = FindUnitsInRadius(
            attacker.GetTeamNumber(),
            origin,
            undefined,
            this.cleave_distance,
            UnitTargetTeam.ENEMY,
            UnitTargetType.HERO + UnitTargetType.BASIC,
            UnitTargetFlags.MAGIC_IMMUNE_ENEMIES,
            FindOrder.ANY,
            false
        );

        // 计算扇形角度阈值
        const halfAngle = Math.atan2(this.cleave_end_width / 2, this.cleave_distance);
        const angleThreshold = Math.cos(halfAngle);

        // 对锥形范围内的每个敌人造成物理伤害（排除原目标）
        for (const enemy of enemies) {
            if (enemy !== target && enemy.IsAlive()) {
                const enemyPos = enemy.GetAbsOrigin();
                const toEnemy = (enemyPos - origin) as Vector;
                toEnemy.z = 0;
                const toEnemyNormalized = toEnemy.Normalized();
                const dot = forward2D.Dot(toEnemyNormalized);

                // 检查是否在锥形范围内
                if (dot >= angleThreshold) {
                    ApplyDamage({
                        victim: enemy,
                        attacker: attacker,
                        damage: damage,
                        damage_type: DamageTypes.PHYSICAL,
                        ability: ability,
                    });

                    // 击中特效
                    const hitEffect = ParticleManager.CreateParticle(
                        'particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf',
                        ParticleAttachment.ABSORIGIN_FOLLOW,
                        enemy
                    );
                    ParticleManager.ReleaseParticleIndex(hitEffect);
                }
            }
        }
    }
}
