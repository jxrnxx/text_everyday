/**
 * 通用·金钟罩 (Golden Bell Shield)
 * Category: PUBLIC | Star: 1 | Element: GENERAL (通用)
 *
 * 主动技能：激活后获得根骨×5的护盾，持续3秒
 * 护盾结束或被击碎时，对周围敌人造成 根骨×(5/7/9/11) 伤害
 * 冷却: 8s | 法力消耗: 10
 */

import { BaseAbility, BaseModifier, registerAbility, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';

@registerAbility('ability_public_golden_bell')
export class ability_public_golden_bell extends BaseAbility {
    Precache(context: CScriptPrecacheContext) {
        PrecacheResource('particle', 'particles/omniknight_repel_buff_text.vpcf', context);
        PrecacheResource(
            'particle',
            'particles/units/heroes/hero_sven/sven_storm_bolt_projectile_explosion.vpcf',
            context
        );
        PrecacheResource('soundfile', 'soundevents/game_sounds_heroes/game_sounds_omniknight.vsndevts', context);
        PrecacheResource('soundfile', 'soundevents/game_sounds_heroes/game_sounds_earthshaker.vsndevts', context);
    }

    OnSpellStart(): void {
        if (!IsServer()) return;

        const caster = this.GetCaster();
        const stats = CustomStats.GetAllStats(caster);
        const constitution = stats.constitution || 0;

        const dmg_multiplier = this.GetSpecialValueFor('dmg_multiplier') || 5;
        const shield_multiplier = this.GetSpecialValueFor('shield_multiplier') || 5;
        const shield_duration = this.GetSpecialValueFor('shield_duration') || 3;

        const shieldAmount = constitution * shield_multiplier;

        // 给自己加护盾
        caster.AddNewModifier(caster, this, 'modifier_golden_bell_shield', {
            duration: shield_duration,
            shield_amount: shieldAmount,
            dmg_multiplier: dmg_multiplier,
            constitution: constitution,
        });

        // 播放施法音效
        EmitSoundOn('Hero_Omniknight.Repel', caster);
    }
}

/** 金钟罩护盾 — 吸收伤害，到期或被击碎时爆炸 */
@registerModifier('modifier_golden_bell_shield')
export class modifier_golden_bell_shield extends BaseModifier {
    private shieldAmount: number = 0;
    private currentShield: number = 0;
    private dmg_multiplier: number = 5;
    private constitution: number = 0;
    private hasExploded: boolean = false;

    IsHidden(): boolean {
        return false;
    }
    IsPurgable(): boolean {
        return false;
    }
    IsDebuff(): boolean {
        return false;
    }

    GetTexture(): string {
        return 'golden_bell_shield';
    }

    /** 引擎自动管理护盾粒子 — 自动跟随角色、自动清理 */
    GetEffectName(): string {
        return 'particles/omniknight_repel_buff_text.vpcf';
    }

    GetEffectAttachType(): ParticleAttachment {
        return ParticleAttachment.ABSORIGIN_FOLLOW;
    }

    OnCreated(params: any): void {
        if (!IsServer()) return;

        this.shieldAmount = params.shield_amount || 0;
        this.currentShield = this.shieldAmount;
        this.dmg_multiplier = params.dmg_multiplier || 5;
        this.constitution = params.constitution || 0;
        this.hasExploded = false;

        // tooltip 显示护盾值
        this.SetStackCount(Math.floor(this.currentShield));
    }

    OnRefresh(params: any): void {
        this.OnCreated(params);
    }

    /** 拦截伤害 + 金色模型渲染 */
    DeclareFunctions(): ModifierFunction[] {
        return [ModifierFunction.INCOMING_DAMAGE_CONSTANT, ModifierFunction.TOOLTIP];
    }

    GetModifierIncomingDamageConstant(event: ModifierAttackEvent): number {
        if (!IsServer()) return 0;
        if (!event || !event.damage) return 0;

        const damage = event.damage;
        if (damage <= 0) return 0;

        const absorbed = Math.min(damage, this.currentShield);
        this.currentShield -= absorbed;
        this.SetStackCount(Math.floor(this.currentShield));

        // 护盾被击碎 → 立刻爆炸
        if (this.currentShield <= 0) {
            this.Explode();
            this.Destroy();
        }

        return -absorbed; // 减少受到的伤害
    }

    OnTooltip(): number {
        return this.currentShield;
    }

    /** 护盾到期时也爆炸 */
    OnDestroy(): void {
        if (!IsServer()) return;
        if (!this.hasExploded) {
            this.Explode();
        }
    }

    /** 金钟罩炸裂 — 对周围敌人造成伤害 */
    private Explode(): void {
        this.hasExploded = true;
        const parent = this.GetParent();
        const caster = this.GetCaster()!;
        const ability = this.GetAbility()!;
        const pos = parent.GetAbsOrigin();
        const radius = ability.GetSpecialValueFor('explosion_radius') || 400;

        const damage = this.constitution * this.dmg_multiplier;

        // 爆炸特效 - 风暴之锤爆炸冲击波
        const explosionFx = ParticleManager.CreateParticle(
            'particles/units/heroes/hero_sven/sven_storm_bolt_projectile_explosion.vpcf',
            ParticleAttachment.WORLDORIGIN,
            parent
        );
        ParticleManager.SetParticleControl(explosionFx, 0, pos); // 主位置
        ParticleManager.SetParticleControl(explosionFx, 1, pos); // PositionLock目标
        ParticleManager.SetParticleControl(explosionFx, 3, pos); // RingWave起点
        ParticleManager.ReleaseParticleIndex(explosionFx);

        // 爆炸音效
        EmitSoundOn('Hero_EarthShaker.Totem.Attack', parent);

        // 搜索范围内敌人
        const enemies = FindUnitsInRadius(
            caster.GetTeamNumber(),
            pos,
            undefined,
            radius,
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

                // 短暂击退视觉（减速0.5秒）
                enemy.AddNewModifier(caster, ability, 'modifier_golden_bell_stun', { duration: 0.3 });
            }
        }
    }
}

/** 金钟罩炸裂短晕 */
@registerModifier('modifier_golden_bell_stun')
export class modifier_golden_bell_stun extends BaseModifier {
    IsHidden(): boolean {
        return true;
    }
    IsStunDebuff(): boolean {
        return true;
    }
    IsDebuff(): boolean {
        return true;
    }
    IsPurgable(): boolean {
        return true;
    }

    CheckState(): Partial<Record<ModifierState, boolean>> {
        return {
            [ModifierState.STUNNED]: true,
        };
    }
}
