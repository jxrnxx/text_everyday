/**
 * 神念·烈焰风暴 (Flame Storm)
 * Category: PUBLIC | Star: 2 | Element: DIVINITY
 *
 * 主动技能：在目标区域召唤3波火雨轰炸
 * 每波造成 [神念 × (4/5/6/7)] 法术伤害
 * 法力消耗: 10 | 冷却: 10
 */

import { BaseAbility, BaseModifier, registerAbility, registerModifier } from '../utils/dota_ts_adapter';
import { CustomStats } from '../systems/CustomStats';

@registerAbility('ability_public_flame_storm')
export class ability_public_flame_storm extends BaseAbility {
    GetAOERadius(): number {
        return this.GetSpecialValueFor('radius') || 350;
    }

    Precache(context: CScriptPrecacheContext) {
        PrecacheResource('particle', 'particles/custom_flame_storm.vpcf', context);
        PrecacheResource('particle', 'particles/custom_flame_storm_ring.vpcf', context);
        PrecacheResource('particle', 'particles/custom_flame_storm_smoke.vpcf', context);
        PrecacheResource('particle', 'particles/custom_flame_storm_burst.vpcf', context);
        PrecacheResource('soundfile', 'soundevents/game_sounds_heroes/game_sounds_lina.vsndevts', context);
        PrecacheResource('soundfile', 'soundevents/game_sounds_heroes/game_sounds_phoenix.vsndevts', context);
        PrecacheResource('soundfile', 'soundevents/game_sounds_heroes/game_sounds_jakiro.vsndevts', context);
    }

    OnSpellStart(): void {
        if (!IsServer()) return;

        const caster = this.GetCaster();
        const targetPoint = this.GetCursorPosition();

        const radius = this.GetSpecialValueFor('radius') || 350;
        const dmg_multiplier = this.GetSpecialValueFor('dmg_multiplier') || 4;
        const wave_count = this.GetSpecialValueFor('wave_count') || 3;
        const wave_interval = this.GetSpecialValueFor('wave_interval') || 0.8;

        // 播放施法音效 — Phoenix 火灵施放的「嗖」声（蓄力感）
        EmitSoundOnLocationWithCaster(targetPoint, 'Hero_Phoenix.FireSpirits.Cast', caster);

        // 依次释放3波火雨，每波间隔 wave_interval 秒
        for (let i = 0; i < wave_count; i++) {
            Timers.CreateTimer(i * wave_interval, () => {
                if (!caster || caster.IsNull() || !caster.IsAlive()) return;

                // 每波随机偏移一点位置，让火雨更自然
                const offsetX = RandomFloat(-radius * 0.3, radius * 0.3);
                const offsetY = RandomFloat(-radius * 0.3, radius * 0.3);
                const waveCenter = (targetPoint + Vector(offsetX, offsetY, 0)) as Vector;

                // 创建该波火雨的 thinker（和毒云一样的模式）
                CreateModifierThinker(
                    caster,
                    this,
                    'modifier_flame_storm_wave',
                    {
                        duration: 1.0,
                        radius: radius,
                        dmg_multiplier: dmg_multiplier,
                    },
                    waveCenter,
                    caster.GetTeamNumber(),
                    false
                );
            });
        }
    }
}

/** 单波火雨 Thinker — 瞬间造成伤害并播放特效 */
@registerModifier('modifier_flame_storm_wave')
export class modifier_flame_storm_wave extends BaseModifier {
    private radius: number = 350;
    private dmg_multiplier: number = 4;
    private particleFx: ParticleID | undefined;
    private hasDamaged: boolean = false;

    IsHidden(): boolean {
        return true;
    }
    IsPurgable(): boolean {
        return false;
    }

    OnCreated(params: any): void {
        if (!IsServer()) return;

        this.radius = params.radius || 350;
        this.dmg_multiplier = params.dmg_multiplier || 4;

        const parent = this.GetParent();
        const pos = parent.GetAbsOrigin();

        // 使用自定义火焰风暴粒子（需要在 Workshop Tools 中打开并保存编译）
        this.particleFx = ParticleManager.CreateParticle(
            'particles/custom_flame_storm.vpcf',
            ParticleAttachment.WORLDORIGIN,
            parent
        );
        ParticleManager.SetParticleControl(this.particleFx, 0, pos);
        ParticleManager.SetParticleControl(this.particleFx, 1, Vector(this.radius, 0, 0));

        // 播放波次音效 — Lina 光击（冲击感）+ Jakiro 双息（火焰扫过感）
        EmitSoundOnLocationWithCaster(pos, 'Hero_Lina.LightStrikeArray', this.GetCaster()!);
        EmitSoundOnLocationWithCaster(pos, 'Hero_Jakiro.DualBreath', this.GetCaster()!);

        // 施加伤害
        this.DealWaveDamage(pos);
    }

    DealWaveDamage(pos: Vector): void {
        if (this.hasDamaged) return;
        this.hasDamaged = true;

        const caster = this.GetCaster()!;
        const ability = this.GetAbility()!;

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

                // 添加灼烧 debuff（和毒云一样的模式）
                enemy.AddNewModifier(caster, ability, 'modifier_flame_storm_burn', { duration: 1.5 });
            }
        }
    }

    OnDestroy(): void {
        if (!IsServer()) return;

        if (this.particleFx !== undefined) {
            ParticleManager.DestroyParticle(this.particleFx, false);
            ParticleManager.ReleaseParticleIndex(this.particleFx);
        }

        const parent = this.GetParent();
        if (parent && !parent.IsNull()) {
            UTIL_Remove(parent);
        }
    }
}

/** 灼烧 Debuff — 让敌人模型变红（和毒云的 debuff 同样模式） */
@registerModifier('modifier_flame_storm_burn')
export class modifier_flame_storm_burn extends BaseModifier {
    IsHidden(): boolean {
        return false;
    }
    IsPurgable(): boolean {
        return true;
    }
    IsDebuff(): boolean {
        return true;
    }

    GetTexture(): string {
        return 'flame_storm_icon';
    }

    OnCreated(): void {
        if (!IsServer()) return;
        // 染红色表示灼烧
        this.GetParent().SetRenderColor(255, 100, 50);
    }

    OnRefresh(): void {
        // 刷新持续时间
    }

    OnDestroy(): void {
        if (!IsServer()) return;
        // 恢复原色
        this.GetParent().SetRenderColor(255, 255, 255);
    }

    DeclareFunctions(): ModifierFunction[] {
        return [];
    }
}
