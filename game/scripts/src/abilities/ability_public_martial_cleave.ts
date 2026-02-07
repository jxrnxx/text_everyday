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
        // 横扫特效 - 白色分裂弧光
        PrecacheResource('particle', 'particles/units/heroes/hero_sven/sven_spell_great_cleave.vpcf', context);
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

        // 只有技能持有者攻击时才触发横扫
        if (attacker !== this.GetParent()) return;

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
        const targetPos = target.GetAbsOrigin();

        // 使用攻击者到目标的方向作为溅射方向
        const toTarget = (targetPos - origin) as Vector;
        toTarget.z = 0;
        const cleaveDirection = toTarget.Normalized();

        // 分裂特效 - Sven大分裂白色弧光
        const cleaveEffect = ParticleManager.CreateParticle(
            'particles/units/heroes/hero_sven/sven_spell_great_cleave.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            attacker
        );
        // CP0 = 攻击者位置, CP1 = 前方方向点(控制弧光方向)
        ParticleManager.SetParticleControl(cleaveEffect, 0, origin);
        const forwardPoint = (origin + cleaveDirection * 300) as Vector;
        ParticleManager.SetParticleControl(cleaveEffect, 1, forwardPoint);
        ParticleManager.ReleaseParticleIndex(cleaveEffect);

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

        // 使用更大的溅射角度 (60度半角 = 120度扇形)
        const angleThreshold = Math.cos(Math.PI / 3); // cos(60°) ≈ 0.5

        // 对锥形范围内的每个敌人造成物理伤害（排除原目标）
        for (const enemy of enemies) {
            if (enemy !== target && enemy.IsAlive()) {
                const enemyPos = enemy.GetAbsOrigin();
                const toEnemy = (enemyPos - origin) as Vector;
                toEnemy.z = 0;
                const toEnemyNormalized = toEnemy.Normalized();
                const dot = cleaveDirection.Dot(toEnemyNormalized);

                // 检查是否在锥形范围内
                if (dot >= angleThreshold) {
                    ApplyDamage({
                        victim: enemy,
                        attacker: attacker,
                        damage: damage,
                        damage_type: DamageTypes.PHYSICAL,
                        ability: ability,
                    });

                    // 击中反馈特效
                    const hitEffect = ParticleManager.CreateParticle(
                        'particles/generic_gameplay/generic_hit_blood.vpcf',
                        ParticleAttachment.ABSORIGIN_FOLLOW,
                        enemy
                    );
                    ParticleManager.ReleaseParticleIndex(hitEffect);
                }
            }
        }
    }
}
