import { reloadable } from '../utils/tstl-utils';
import * as json_heroes from '../json/npc_heroes_custom.json';
import { EconomySystem } from '../mechanics/EconomySystem';

// Custom Game Event Declarations moved to shared/gameevents.d.ts

// 定义自定义属性接口
interface HeroStats {
    // ===== 基础属性 (从英雄配置读取) =====
    // 根骨系统
    constitution_base: number; // 基础根骨
    constitution_gain: number; // 根骨成长
    constitution_bonus: number; // 根骨加成百分比
    // 武道系统
    martial_base: number; // 基础武道
    martial_gain: number; // 武道成长
    martial_bonus: number; // 武道加成百分比
    // 神念系统
    divinity_base: number; // 基础神念
    divinity_gain: number; // 神念成长
    divinity_bonus: number; // 神念加成百分比
    // 身法系统
    agility_base: number; // 基础身法
    agility_gain: number; // 身法成长
    agility_bonus: number; // 身法加成百分比
    // 攻击力系统
    damage_base: number; // 基础攻击力
    damage_gain: number; // 攻击力成长
    damage_bonus: number; // 攻击力加成百分比

    // ===== 计算后的面板属性 (用于显示) =====
    constitution: number; // 面板根骨
    martial: number; // 面板武道
    divinity: number; // 面板神念

    // ===== 其他属性 =====
    rank: number;
    display_level: number; // 显示等级 (由服务端控制)
    custom_exp: number; // 自定义经验值 (绕过Dota2的30级限制)
    custom_exp_required: number; // 升级所需经验
    crit_chance: number;
    crit_damage: number;
    main_stat: string; // 主属性: 'Martial' 或 'Divinity'
    profession?: string;

    // ===== 额外获得的属性 (商人/游戏奖励/装备等) =====
    extra_constitution: number; // 额外根骨
    extra_martial: number; // 额外武道
    extra_divinity: number; // 额外神念
    extra_agility: number; // 额外身法
    extra_attack_speed: number; // 额外攻速
    extra_mana_regen: number; // 额外回蓝
    extra_armor: number; // 额外护甲
    extra_max_mana: number; // 额外最大法力
    extra_move_speed: number; // 额外移速
    extra_base_damage: number; // 额外攻击力
    extra_life_on_hit: number; // 额外攻击回血（商店购买）
    lifesteal: number; // 吸血百分比
    armor_pen: number; // 护甲穿透(破势)
    base_move_speed: number; // 基础移速（从配置读取）
    life_on_hit_base: number; // 基础攻击回血（从配置读取）
    life_on_hit: number; // 攻击回血面板值 = 基础 + 额外
}

const DEFAULT_STATS: HeroStats = {
    // 基础属性
    constitution_base: 5,
    constitution_gain: 0,
    constitution_bonus: 0,
    martial_base: 5,
    martial_gain: 0,
    martial_bonus: 0,
    divinity_base: 5,
    divinity_gain: 0,
    divinity_bonus: 0,
    agility_base: 0,
    agility_gain: 0,
    agility_bonus: 0,
    damage_base: 1,
    damage_gain: 0,
    damage_bonus: 0,
    // 面板属性
    constitution: 5,
    martial: 5,
    divinity: 5,
    // 其他
    rank: 0,
    display_level: 1,
    custom_exp: 0,
    custom_exp_required: 230,
    crit_chance: 0,
    crit_damage: 150,
    main_stat: 'Martial',
    // 额外属性
    extra_constitution: 0,
    extra_martial: 0,
    extra_divinity: 0,
    extra_agility: 0,
    extra_attack_speed: 0,
    extra_mana_regen: 0,
    extra_armor: 0,
    extra_max_mana: 0,
    extra_move_speed: 0,
    extra_base_damage: 0,
    extra_life_on_hit: 0,
    lifesteal: 0,
    armor_pen: 0,
    base_move_speed: 300,
    life_on_hit_base: 0,
    life_on_hit: 0,
};

@reloadable
export class CustomStats {
    // 不再使用静态 cache，所有数据存储在 unit.CustomValue['_heroStats']

    /**
     * 初始化英雄的自定义属性
     * 使用 HeroConfigManager 从 Excel/JSON 配置读取
     * 数据存储到 unit.CustomValue['_heroStats']，同时同步到 NetTable
     */
    public static InitializeHeroStats(hero: CDOTA_BaseNPC_Hero) {
        if (!hero || hero.IsNull()) return;

        // 检查是否已经有数据 (Check CustomValue first)
        const existingData = hero.GetCustomValue('_heroStats');
        if (existingData) return;

        const unitName = hero.GetUnitName();
        const unitIndex = tostring(hero.GetEntityIndex());

        // 使用 HeroConfigManager 获取配置（规范化的入口）
        const { HeroConfigManager } = require('./HeroConfigManager');
        const heroConfig = HeroConfigManager.GetHeroConfigWithFallback(unitName);

        // 从配置读取属性（使用类型安全的方法）
        const mainStat = heroConfig.CustomMainStat || 'Martial';

        // 根骨
        const constitutionBase = Number(heroConfig.AttributeBaseConstitution) || 5;
        const constitutionGain = Number(heroConfig.AttributeConstitutionGain) || 0;
        const constitutionBonus = Number(heroConfig.AttributeConstitutionBonus) || 0;
        // 武道
        const martialBase = Number(heroConfig.AttributeBaseMartial) || 5;
        const martialGain = Number(heroConfig.AttributeMartialGain) || 0;
        const martialBonus = Number(heroConfig.AttributeMartialBonus) || 0;
        // 神念
        const divinityBase = Number(heroConfig.AttributeBaseDivinity) || 5;
        const divinityGain = Number(heroConfig.AttributeDivinityGain) || 0;
        const divinityBonus = Number(heroConfig.AttributeDivinityBonus) || 0;
        // 身法
        const agilityBase = Number(heroConfig.AttributeBaseAgility) || 0;
        const agilityGain = Number(heroConfig.AttributeAgilityGain) || 0;
        const agilityBonus = Number(heroConfig.AttributeAgilityBonus) || 0;
        // 攻击力
        const damageBase = Number(heroConfig.AttributeBaseDamage) || 1;
        const damageGain = Number(heroConfig.AttributeDamageGain) || 0;
        const damageBonus = Number(heroConfig.AttributeDamageBonus) || 0;
        // 基础移速
        const baseMoveSpeed = Number(heroConfig.MovementSpeed) || 300;
        // 基础攻击回血
        const lifeOnHitBase = Number(heroConfig.LifeOnHit) || 0;

        const initialStats: HeroStats = {
            // 基础属性
            constitution_base: constitutionBase,
            constitution_gain: constitutionGain,
            constitution_bonus: constitutionBonus,
            martial_base: martialBase,
            martial_gain: martialGain,
            martial_bonus: martialBonus,
            divinity_base: divinityBase,
            divinity_gain: divinityGain,
            divinity_bonus: divinityBonus,
            agility_base: agilityBase,
            agility_gain: agilityGain,
            agility_bonus: agilityBonus,
            damage_base: damageBase,
            damage_gain: damageGain,
            damage_bonus: damageBonus,
            // 面板属性 (初始等于基础值，后续会动态计算)
            constitution: constitutionBase,
            martial: martialBase,
            divinity: divinityBase,
            // 其他
            rank: 0, // 初始阶位为凡胎
            display_level: 1, // 初始显示等级
            custom_exp: 0, // 初始自定义经验
            custom_exp_required: 230, // 1级升2级所需经验
            crit_chance: 0,
            crit_damage: 150,
            main_stat: mainStat,
            profession: heroConfig.CustomJob || `#Job_${unitName}`,
            // 额外属性
            extra_constitution: 0,
            extra_martial: 0,
            extra_divinity: 0,
            extra_agility: 0,
            extra_attack_speed: 0,
            extra_mana_regen: 0,
            extra_armor: 0,
            extra_max_mana: 0,
            extra_move_speed: 0,
            extra_base_damage: 0,
            extra_life_on_hit: 0,
            lifesteal: 0,
            armor_pen: 0,
            base_move_speed: baseMoveSpeed,
            life_on_hit_base: lifeOnHitBase,
            life_on_hit: lifeOnHitBase, // 初始面板值 = 基础值
        };

        // 1. Write to CustomValue (Source of Truth)
        hero.SetCustomValue('_heroStats', initialStats);

        // 2. Write to NetTable (For Client Sync)
        CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, initialStats);

        // Add Modifier
        hero.AddNewModifier(hero, undefined, 'modifier_custom_stats_handler', {});

        // Send to client immediately
        this.SendStatsToClient(hero, initialStats);
    }

    /**
     * 增加指定属性
     */
    public static AddStat(unit: CDOTA_BaseNPC, statType: keyof HeroStats, value: number) {
        if (!unit || unit.IsNull()) return;

        const unitIndex = tostring(unit.GetEntityIndex());
        // Read from CustomValue -> Fallback to NetTable -> Fallback to Default
        const currentStats = unit.GetCustomValue('_heroStats') ||
            CustomNetTables.GetTableValue('custom_stats' as any, unitIndex) || { ...DEFAULT_STATS };

        if (currentStats[statType] !== undefined && typeof currentStats[statType] === 'number') {
            (currentStats as any)[statType] += value;

            // 如果是 extra_life_on_hit，同时更新 life_on_hit 面板值
            if (statType === 'extra_life_on_hit') {
                currentStats.life_on_hit = (currentStats.life_on_hit_base || 0) + (currentStats.extra_life_on_hit || 0);
            }

            // Update CustomValue & NetTable
            unit.SetCustomValue('_heroStats', currentStats);
            CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, currentStats);

            // 保存修改前的血量/蓝量状态
            const oldHealth = unit.GetHealth();
            const oldMaxHealth = unit.GetMaxHealth();
            const oldMana = unit.GetMana();
            const oldMaxMana = unit.GetMaxMana();
            const healthRatio = oldHealth / Math.max(oldMaxHealth, 1);
            const manaRatio = oldMana / Math.max(oldMaxMana, 1);

            // 强制刷新 modifier 属性
            const modifier = unit.FindModifierByName('modifier_custom_stats_handler');
            if (modifier) {
                // 触发 modifier 的 ForceRefresh 来立即重新计算
                (modifier as any).ForceRefresh && (modifier as any).ForceRefresh();
                // 如果 ForceRefresh 不存在，至少调用 CalculateStatBonus
                if (unit.IsRealHero()) {
                    (unit as CDOTA_BaseNPC_Hero).CalculateStatBonus(true);
                }
            }

            // 立即计算并设置正确的血量（避免闪烁）
            // 正确的血量计算逻辑：
            // 新增的最大血量部分，按当前血量比例计算应该增加多少当前血量
            // 例如：当前90/100血(90%)，新增100最大血量 -> 新血量 = 90 + 100*90% = 180
            const newMaxHealth = unit.GetMaxHealth();
            const newMaxMana = unit.GetMaxMana();

            const healthGain = newMaxHealth - oldMaxHealth;
            const manaGain = newMaxMana - oldMaxMana;

            // 新血量 = 旧血量 + (新增最大血量 * 血量比例)
            const newHealth = Math.max(1, Math.floor(oldHealth + healthGain * healthRatio));
            const newMana = Math.floor(oldMana + manaGain * manaRatio);

            unit.SetHealth(Math.min(newHealth, newMaxHealth));
            unit.SetMana(Math.min(newMana, newMaxMana));

            // 通知客户端属性已更新
            if (unit.IsRealHero()) {
                this.SendStatsToClient(unit);
            }
        } else {
        }
    }

    /**
     * 获取指定单位的属性
     */
    public static GetStat(unit: CDOTA_BaseNPC, statType: keyof HeroStats): number {
        if (!unit || unit.IsNull()) return 0;
        const stats = this.GetAllStats(unit);
        if (stats && stats[statType] !== undefined) {
            const val = (stats as any)[statType];
            return typeof val === 'number' ? val : 0;
        }
        return 0;
    }

    /**
     * 获取所有属性
     */
    public static GetAllStats(unit: CDOTA_BaseNPC): HeroStats {
        if (!unit || unit.IsNull()) return { ...DEFAULT_STATS };
        const unitIndex = tostring(unit.GetEntityIndex());

        // 检查 GetCustomValue 方法是否存在（非英雄单位可能没有）
        let fromCustomValue: any = undefined;
        if (typeof unit.GetCustomValue === 'function') {
            fromCustomValue = unit.GetCustomValue('_heroStats');
        }

        // 从 NetTable 获取
        const fromNetTable = CustomNetTables.GetTableValue('custom_stats' as any, unitIndex);

        return fromCustomValue || fromNetTable || { ...DEFAULT_STATS };
    }

    /**
     * 计算身法值
     * 公式: (基础身法 + (等级-1) * 身法成长) * (1 + 身法加成)
     */
    public static GetAgility(unit: CDOTA_BaseNPC): number {
        if (!unit || unit.IsNull()) return 0;

        const stats = this.GetAllStats(unit);
        const level = unit.GetLevel();

        // 公式: (基础身法 + (等级-1) * 身法成长) * (1 + 身法加成)
        const baseAgility = stats.agility_base + (level - 1) * stats.agility_gain;
        const totalAgility = Math.floor(baseAgility * (1 + stats.agility_bonus));

        return totalAgility;
    }

    /**
     * 更新显示等级 - 根据实际等级和阶位计算
     * 当有经验溢出时，会限制显示等级在当前阶位的合理范围内
     */
    public static UpdateDisplayLevel(hero: CDOTA_BaseNPC_Hero) {
        if (!hero || hero.IsNull()) return;

        const stats = this.GetAllStats(hero);
        const rawLevel = hero.GetLevel();
        const rank = stats.rank;

        // 计算当前阶位允许的最大等级: (rank + 1) * 10
        const currentMaxLevel = (rank + 1) * 10;
        // 计算上一阶位的最大等级 (用于判断溢出)
        const prevMaxLevel = rank > 0 ? rank * 10 : 0;

        let displayLevel = rawLevel;

        // 如果实际等级超过了当前阶位的最大等级，限制显示
        if (rawLevel > currentMaxLevel) {
            displayLevel = currentMaxLevel;
        }
        // 如果有阶位但实际等级还没超过上一阶位最大等级+1，说明刚进阶
        else if (rank > 0 && rawLevel <= prevMaxLevel + 1 && stats.display_level <= prevMaxLevel) {
            // 保持在上一阶位最大等级，直到真正升级
            displayLevel = Math.max(stats.display_level, prevMaxLevel);
        }

        // 只有等级变化时才更新
        if (displayLevel !== stats.display_level) {
            this.SetDisplayLevel(hero, displayLevel);
        }
    }

    /**
     * 直接设置显示等级
     */
    public static SetDisplayLevel(unit: CDOTA_BaseNPC, level: number) {
        if (!unit || unit.IsNull()) return;

        const unitIndex = tostring(unit.GetEntityIndex());

        // 使用 GetAllStats 获取完整的 stats 对象（不会丢失其他属性）
        const stats = this.GetAllStats(unit);

        stats.display_level = level;
        unit.SetCustomValue('_heroStats', stats);
        CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, stats);
    }

    /**
     * 获取指定等级升级所需经验
     * 使用公式：100 + level * 30 + (level * level * 5)
     */
    public static GetExpRequiredForLevel(level: number): number {
        // 简单的经验公式
        return 100 + level * 30 + Math.floor(level * level * 5);
    }

    /**
     * 添加自定义经验（完全绕过Dota2的经验系统）
     * 返回是否升级
     */
    public static AddCustomExp(hero: CDOTA_BaseNPC_Hero, expAmount: number): boolean {
        if (!hero || hero.IsNull()) return false;

        const unitIndex = tostring(hero.GetEntityIndex());
        const stats = this.GetAllStats(hero);

        const currentLevel = stats.display_level;
        const rank = stats.rank;

        // 禁忌阶位(rank=5)是最高阶位，不再获取经验
        if (rank >= 5) {
            return false;
        }

        const maxLevel = Math.min((rank + 1) * 10, 50); // 最高50级

        // 如果已经达到当前阶位的等级上限，不添加经验
        if (currentLevel >= maxLevel) {
            return false;
        }

        // 添加经验
        stats.custom_exp += expAmount;

        // 检测是否升级
        let leveledUp = false;
        while (stats.custom_exp >= stats.custom_exp_required && stats.display_level < maxLevel) {
            // 升级！
            stats.custom_exp -= stats.custom_exp_required;
            stats.display_level += 1;
            stats.custom_exp_required = this.GetExpRequiredForLevel(stats.display_level);
            leveledUp = true;
        }

        // 如果升级后达到上限，清空多余经验
        if (stats.display_level >= maxLevel) {
            stats.custom_exp = stats.custom_exp_required; // 满经验显示
        }

        // 更新 CustomValue 和 NetTable
        hero.SetCustomValue('_heroStats', stats);
        CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, stats);

        // 如果升级了，强制刷新 modifier 以更新血量等属性
        if (leveledUp) {
            // 延迟一帧执行，确保 display_level 已更新
            Timers.CreateTimer(0.03, () => {
                if (!hero || hero.IsNull()) return;
                const modifier = hero.FindModifierByName('modifier_custom_stats_handler');
                if (modifier) {
                    (modifier as any).ForceRefresh?.();
                }
            });
        }

        // 通知客户端
        this.SendStatsToClient(hero);

        return leveledUp;
    }

    /**
     * 重置自定义经验（进阶后调用）
     */
    public static ResetCustomExp(hero: CDOTA_BaseNPC_Hero) {
        if (!hero || hero.IsNull()) return;

        const unitIndex = tostring(hero.GetEntityIndex());
        const stats = this.GetAllStats(hero);

        // 重置经验为 0
        stats.custom_exp = 0;
        // 计算当前等级的升级所需经验
        stats.custom_exp_required = this.GetExpRequiredForLevel(stats.display_level);

        // 更新 CustomValue 和 NetTable
        hero.SetCustomValue('_heroStats', stats);
        CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, stats);
    }

    /**
     * 设置经验条满（用于禁忌阶位）
     */
    public static SetCustomExpFull(hero: CDOTA_BaseNPC_Hero) {
        if (!hero || hero.IsNull()) return;

        const unitIndex = tostring(hero.GetEntityIndex());
        const stats = this.GetAllStats(hero);

        // 设置经验等于所需经验（100%）
        stats.custom_exp = stats.custom_exp_required;

        // 更新 CustomValue 和 NetTable
        hero.SetCustomValue('_heroStats', stats);
        CustomNetTables.SetTableValue('custom_stats' as any, unitIndex, stats);
    }

    /**
     * 发送属性数据给客户端
     */
    public static SendStatsToClient(unit: CDOTA_BaseNPC, explicitStats?: HeroStats) {
        if (!unit || unit.IsNull() || !unit.IsRealHero()) return;

        const player = PlayerResource.GetPlayer(unit.GetPlayerOwnerID());
        if (!player) return;

        // Use explicit, or fetch from Cache via GetAllStats
        const stats = explicitStats || this.GetAllStats(unit);

        CustomGameEventManager.Send_ServerToPlayer(player, 'custom_stats_update', {
            entindex: unit.GetEntityIndex(),
            stats: stats,
        });
    }

    public static Init() {
        CustomGameEventManager.RegisterListener('request_custom_stats', (_, event) => {
            const playerId = event.PlayerID;
            const player = PlayerResource.GetPlayer(playerId);
            if (!player) return;
            const hero = player.GetAssignedHero();
            if (hero) {
                // This now triggers GetAllStats -> Reads from Cache -> Returns Correct Data
                CustomStats.SendStatsToClient(hero);
            }
        });

        // 商人购买属性事件处理
        CustomGameEventManager.RegisterListener('cmd_merchant_purchase', (_, event: any) => {
            const playerId = event.PlayerID;
            const player = PlayerResource.GetPlayer(playerId);
            if (!player) return;
            const hero = player.GetAssignedHero();
            if (!hero) return;

            const statType = event.stat_type as string;
            const amount = (event.amount as number) || 0;
            const slotIndex = event.slot_index as number;

            // 从 UpgradeSystem 获取当前 Tier 的费用
            const { UpgradeSystem } = require('./UpgradeSystem');
            const upgradeSystem = UpgradeSystem.GetInstance();
            upgradeSystem.InitPlayer(playerId); // 确保玩家数据已初始化
            const shopData = upgradeSystem.GetShopData(playerId);
            const tierConfig = UpgradeSystem.GetTierConfig(shopData.current_tier); // 使用静态方法而非 .find()
            const cost = tierConfig?.cost_per_slot || 200;

            // 检查灵石是否足够
            const economy = EconomySystem.GetInstance();
            const currentCoin = economy.GetSpiritCoin(playerId);

            if (currentCoin < cost) {
                // 灵石不足
                hero.EmitSound('General.CastFail_NoMana');
                return;
            }

            // 属性映射表 - 将前端属性名映射到 HeroStats 字段
            const statMap: { [key: string]: { stat: keyof HeroStats; defaultAmount: number } } = {
                constitution: { stat: 'extra_constitution', defaultAmount: 5 },
                martial: { stat: 'extra_martial', defaultAmount: 5 },
                divinity: { stat: 'extra_divinity', defaultAmount: 5 },
                agility: { stat: 'extra_agility', defaultAmount: 5 },
                armor: { stat: 'extra_armor', defaultAmount: 2 },
                mana_regen: { stat: 'extra_mana_regen', defaultAmount: 2 },
                attack_speed: { stat: 'extra_attack_speed', defaultAmount: 15 },
                life_on_hit: { stat: 'extra_life_on_hit', defaultAmount: 10 },
                lifesteal_pct: { stat: 'lifesteal', defaultAmount: 5 }, // 百分比吸血
                base_damage: { stat: 'extra_base_damage', defaultAmount: 15 },
                armor_pen: { stat: 'armor_pen', defaultAmount: 10 },
            };

            const mapping = statMap[statType];
            if (mapping) {
                // 扣除灵石
                economy.AddSpiritCoin(playerId, -cost);

                // 添加属性 (使用事件传来的 amount)
                const actualAmount = amount || mapping.defaultAmount;
                CustomStats.AddStat(hero, mapping.stat, actualAmount);
                hero.EmitSound('Item.TomeOfKnowledge');

                print(`[CustomStats] Purchased: ${statType} +${actualAmount}, slot_index=${slotIndex}, cost=${cost}`);

                // 通知 UpgradeSystem 槽位已购买 (用于触发自动突破)
                if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < 8) {
                    print(`[CustomStats] Calling MarkSlotPurchased(${playerId}, ${slotIndex})`);
                    upgradeSystem.MarkSlotPurchased(playerId, slotIndex);
                } else {
                    print(`[CustomStats] WARNING: Invalid slot_index: ${slotIndex}`);
                }
            } else {
                print(`[CustomStats] Unknown stat type: ${statType}`);
            }
        });
    }
}
