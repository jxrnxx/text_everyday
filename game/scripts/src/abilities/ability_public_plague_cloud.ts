/**
 * 神念·噬魂毒阵 (Soul-Devouring Poison Formation)
 * Category: PUBLIC | Star: 1 | Element: DIVINITY
 *
 * 主动技能：在目标区域降下毒云
 * 每秒造成 [神念 × (1/1.2/1.5/1.8)] 法术伤害，持续5秒
 * 法力消耗: 10
 */

import { BaseAbility, BaseModifier, registerAbility, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';

@registerAbility('ability_public_plague_cloud')
export class ability_public_plague_cloud extends BaseAbility {
    GetAOERadius(): number {
        return this.GetSpecialValueFor('radius') || 300;
    }

    Precache(context: CScriptPrecacheContext) {
        PrecacheResource('particle', 'particles/custom_plague_cloud.vpcf', context);
        PrecacheResource('soundfile', 'soundevents/game_sounds_heroes/game_sounds_pugna.vsndevts', context);
    }

    OnSpellStart(): void {
        if (!IsServer()) return;

        const caster = this.GetCaster();
        const targetPoint = this.GetCursorPosition();

        const radius = this.GetSpecialValueFor('radius') || 300;
        const duration = this.GetSpecialValueFor('duration') || 5;
        const dmg_multiplier = this.GetSpecialValueFor('dmg_multiplier') || 1;

        // 创建地面毒云修改器 (使用虚拟目标或 thinker)
        CreateModifierThinker(
            caster,
            this,
            'modifier_plague_cloud_aura',
            {
                duration: duration,
                radius: radius,
                dmg_multiplier: dmg_multiplier,
            },
            targetPoint,
            caster.GetTeamNumber(),
            false
        );

        // 播放施法音效
        EmitSoundOnLocationWithCaster(targetPoint, 'Hero_Pugna.NetherBlast', caster);
    }
}

/** 毒云 Thinker 光环 — 挂在 npc_dota_thinker 上，提供区域光环 */
@registerModifier('modifier_plague_cloud_aura')
export class modifier_plague_cloud_aura extends BaseModifier {
    private radius: number = 300;
    private dmg_multiplier: number = 1;
    private particleIndex: ParticleID | undefined;

    IsHidden(): boolean {
        return true;
    }
    IsPurgable(): boolean {
        return false;
    }

    OnCreated(params: any): void {
        if (!IsServer()) return;

        this.radius = params.radius || 300;
        this.dmg_multiplier = params.dmg_multiplier || 1;

        const parent = this.GetParent();
        const pos = parent.GetAbsOrigin();

        // 使用自定义组合粒子（混合不同英雄子特效）
        this.particleIndex = ParticleManager.CreateParticle(
            'particles/custom_plague_cloud.vpcf',
            ParticleAttachment.WORLDORIGIN,
            parent
        );
        ParticleManager.SetParticleControl(this.particleIndex, 0, pos);
        ParticleManager.SetParticleControl(this.particleIndex, 1, Vector(this.radius, 0, 0));

        // 每秒跳一次伤害
        this.StartIntervalThink(1.0);
    }

    OnIntervalThink(): void {
        if (!IsServer()) return;

        const parent = this.GetParent();
        const caster = this.GetCaster()!;
        const ability = this.GetAbility()!;
        const pos = parent.GetAbsOrigin();

        // 读取施法者的神念面板值
        const stats = CustomStats.GetAllStats(caster);
        const divinity = stats.divinity || 0;

        // 伤害 = 神念 × 倍率
        const damage = divinity * this.dmg_multiplier;

        // 搜索范围内敌人
        const enemies = FindUnitsInRadius(
            caster.GetTeamNumber(),
            pos,
            undefined,
            this.radius,
            UnitTargetTeam.ENEMY,
            UnitTargetType.HERO + UnitTargetType.BASIC,
            UnitTargetFlags.NONE,
            FindOrder.ANY,
            false
        );

        for (const enemy of enemies) {
            if (enemy.IsAlive()) {
                ApplyDamage({
                    victim: enemy,
                    attacker: caster,
                    damage: damage,
                    damage_type: DamageTypes.MAGICAL,
                    ability: ability,
                });

                // 给敌人加绿色中毒效果（每次刷新持续时间）
                enemy.AddNewModifier(caster, ability, 'modifier_plague_cloud_debuff', { duration: 1.5 });
            }
        }
    }

    OnDestroy(): void {
        if (!IsServer()) return;

        // 清理粒子
        if (this.particleIndex !== undefined) {
            ParticleManager.DestroyParticle(this.particleIndex, false);
            ParticleManager.ReleaseParticleIndex(this.particleIndex);
        }

        // 销毁 Thinker 实体
        const parent = this.GetParent();
        if (parent && !parent.IsNull()) {
            UTIL_Remove(parent);
        }
    }
}

/** 毒阵中毒 Debuff — 让敌人模型变绿 */
@registerModifier('modifier_plague_cloud_debuff')
export class modifier_plague_cloud_debuff extends BaseModifier {
    private particleIndex: ParticleID | undefined;

    IsHidden(): boolean {
        return false; // 显示在状态栏
    }
    IsPurgable(): boolean {
        return true;
    }
    IsDebuff(): boolean {
        return true;
    }

    GetTexture(): string {
        return 'venomancer_poison_nova';
    }

    OnCreated(): void {
        if (!IsServer()) return;

        const parent = this.GetParent();

        // 给敌人模型加绿色染色
        parent.SetRenderColor(80, 255, 80);

        // 中毒粒子
        this.particleIndex = ParticleManager.CreateParticle(
            'particles/generic_gameplay/generic_slowed_cold.vpcf',
            ParticleAttachment.ABSORIGIN_FOLLOW,
            parent
        );
    }

    OnRefresh(): void {
        // 刷新持续时间即可，视觉效果保持
    }

    OnDestroy(): void {
        if (!IsServer()) return;

        // 恢复原色
        this.GetParent().SetRenderColor(255, 255, 255);

        if (this.particleIndex !== undefined) {
            ParticleManager.DestroyParticle(this.particleIndex, false);
            ParticleManager.ReleaseParticleIndex(this.particleIndex);
        }
    }

    DeclareFunctions(): ModifierFunction[] {
        return [];
    }
}
