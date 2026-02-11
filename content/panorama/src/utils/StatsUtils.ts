/**
 * StatsUtils.ts
 * 统一的英雄属性计算工具
 *
 * 所有UI组件都应该使用这个工具来获取和计算属性
 * 确保 HeroHUD 和 character_sheet 显示一致的数据
 */

// ===== 类型定义 =====

/** 原始属性数据（从 NetTable 获取） */
export interface RawStatsData {
    // 基础属性
    constitution_base: number;
    constitution_gain: number;
    constitution_bonus: number;
    extra_constitution: number;

    martial_base: number;
    martial_gain: number;
    martial_bonus: number;
    extra_martial: number;

    divinity_base: number;
    divinity_gain: number;
    divinity_bonus: number;
    extra_divinity: number;

    agility_base: number;
    agility_gain: number;
    agility_bonus: number;
    extra_agility: number;

    damage_base: number;
    damage_gain: number;
    damage_bonus: number;
    extra_base_damage: number;

    // 服务端计算的面板值（含神器加成）
    constitution?: number;
    martial?: number;
    divinity?: number;

    // 其他属性
    main_stat: 'Martial' | 'Divinity';
    rank: number;
    display_level: number;
    profession: string;

    custom_exp: number;
    custom_exp_required: number;

    // 战斗属性 (base + bonus)
    crit_chance_base: number;
    crit_chance_bonus: number;
    crit_chance: number;
    crit_damage_base: number;
    crit_damage_bonus: number;
    crit_damage: number;
    armor_pen: number;

    life_on_hit_base: number;
    life_on_hit: number;

    extra_attack_speed: number;
    extra_mana_regen: number;
    extra_armor: number;
    extra_move_speed: number;

    base_move_speed: number;

    extra_life_on_hit: number;

    // 战斗属性 (base + bonus)
    spell_damage_base: number;
    spell_damage_bonus: number;
    spell_damage: number;
    block: number;
    final_dmg_increase_base: number;
    final_dmg_increase_bonus: number;
    final_dmg_increase: number;
    final_dmg_reduct_base: number;
    final_dmg_reduct_bonus: number;
    final_dmg_reduct: number;
    evasion_base: number;
    evasion_bonus: number;
    evasion: number;

    // 神器加成值（从服务端同步）
    art_con?: number;
    art_mar?: number;
    art_div?: number;
    art_agi?: number;
    art_all_stats?: number;
    art_damage?: number;
    art_hp?: number;
    art_armor?: number;
    art_move_speed?: number;
    art_mana_regen?: number;
    art_crit_chance?: number;
    art_crit_damage?: number;
    art_spell_damage?: number;
    art_final_inc?: number;
    art_final_red?: number;
    art_block?: number;
    art_evasion?: number;
}

/** 计算后的面板属性 */
export interface PanelStats {
    // 基础信息
    profession: string;
    rank: number;
    level: number;

    // 五维属性面板值
    constitution: number;
    martial: number;
    divinity: number;
    agility: number;

    // 战斗属性
    attack: number;
    defense: number;
    attackSpeed: number;
    moveSpeed: number;

    // 生存属性
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;

    // 特殊属性
    armorPen: number;
    lifeOnHit: number;

    // 经验
    customExp: number;
    customExpRequired: number;

    // 战斗力
    combatPower: number;

    // 额外属性（商店购买等）
    extraConstitution: number;
    extraMartial: number;
    extraDivinity: number;
    extraAgility: number;
    extraAttackSpeed: number;
    extraManaRegen: number;
    extraArmor: number;
    extraMoveSpeed: number;
    extraDamage: number;
    extraLifeOnHit: number;

    // 战斗属性
    critChanceBase: number;
    critChanceBonus: number;
    critChance: number;
    critDamageBase: number;
    critDamageBonus: number;
    critDamage: number;
    spellDamageBase: number;
    spellDamageBonus: number;
    spellDamage: number;
    block: number;
    finalDmgIncreaseBase: number;
    finalDmgIncreaseBonus: number;
    finalDmgIncrease: number;
    finalDmgReductBase: number;
    finalDmgReductBonus: number;
    finalDmgReduct: number;
    evasionBase: number;
    evasionBonus: number;
    evasion: number;
}

// ===== 属性计算函数 =====

/**
 * 计算单个属性的面板值
 * 公式: (基础 + (等级-1) * 成长 + 额外获得) * (1 + 加成)
 */
export function calculatePanelStat(base: number, gain: number, bonus: number, extra: number, level: number): number {
    return Math.floor((base + (level - 1) * gain + extra) * (1 + bonus));
}

/**
 * 从 NetTable 获取原始数据
 */
export function getRawStats(heroIndex: EntityIndex): RawStatsData | null {
    if (heroIndex === -1) return null;

    const netTableKey = String(heroIndex);
    const data = CustomNetTables.GetTableValue('custom_stats' as any, netTableKey);

    if (!data) return null;

    return data as unknown as RawStatsData;
}

/**
 * 获取计算后的完整面板属性
 * 这是所有 UI 组件应该使用的主要接口
 */
export function getHeroStats(heroIndex: EntityIndex): PanelStats | null {
    const raw = getRawStats(heroIndex);
    if (!raw) return null;

    const level = raw.display_level || Entities.GetLevel(heroIndex);

    // 使用服务端计算好的面板值（已包含神器加成）
    const constitution =
        raw.constitution ||
        calculatePanelStat(
            raw.constitution_base || 0,
            raw.constitution_gain || 0,
            raw.constitution_bonus || 0,
            raw.extra_constitution || 0,
            level
        );

    const martial =
        raw.martial ||
        calculatePanelStat(
            raw.martial_base || 0,
            raw.martial_gain || 0,
            raw.martial_bonus || 0,
            raw.extra_martial || 0,
            level
        );

    const divinity =
        raw.divinity ||
        calculatePanelStat(
            raw.divinity_base || 0,
            raw.divinity_gain || 0,
            raw.divinity_bonus || 0,
            raw.extra_divinity || 0,
            level
        );

    const agility =
        calculatePanelStat(
            raw.agility_base || 0,
            raw.agility_gain || 0,
            raw.agility_bonus || 0,
            raw.extra_agility || 0,
            level
        ) + (raw.art_agi || 0);

    // 计算攻击力 = 面板攻击 + 主属性 * 1.5 + 神器攻击
    const dmgPanel = calculatePanelStat(
        raw.damage_base || 0,
        raw.damage_gain || 0,
        raw.damage_bonus || 0,
        raw.extra_base_damage || 0,
        level
    );
    const mainStat = raw.main_stat || 'Martial';
    const mainPanel = mainStat === 'Martial' ? martial : divinity;
    const artDamage = raw.art_damage || 0;
    const attack = dmgPanel + Math.floor(mainPanel * 1.5) + artDamage;

    // 从 Entities API 获取实时数据
    const defense = Math.floor(Entities.GetPhysicalArmorValue(heroIndex) || 0);
    const hp = Entities.GetHealth(heroIndex) || 0;
    const maxHp = Entities.GetMaxHealth(heroIndex) || 1;
    const mp = Entities.GetMana(heroIndex) || 0;
    const maxMp = Entities.GetMaxMana(heroIndex) || 1;

    // 攻速 = 100 + 身法 + 额外攻速
    const attackSpeed = 100 + agility + (raw.extra_attack_speed || 0);

    // 移速 = 基础移速 + 身法*0.4 + 额外移速
    const baseMoveSpeed = raw.base_move_speed || 300;
    const moveSpeed = baseMoveSpeed + Math.floor(agility * 0.4) + (raw.extra_move_speed || 0);

    // 战斗力计算
    const combatPower = Math.floor(
        attack * 1 + defense * 5 + constitution * 10 + martial * 8 + divinity * 8 + maxHp / 10
    );

    return {
        profession: raw.profession || '',
        rank: raw.rank || 0,
        level,

        constitution,
        martial,
        divinity,
        agility,

        attack,
        defense,
        attackSpeed,
        moveSpeed,

        hp,
        maxHp,
        mp,
        maxMp,

        critChanceBase: raw.crit_chance_base || 0,
        critChanceBonus: raw.crit_chance_bonus || 0,
        critChance: raw.crit_chance || 0,
        critDamageBase: raw.crit_damage_base || 105,
        critDamageBonus: raw.crit_damage_bonus || 0,
        critDamage: raw.crit_damage || 105,
        armorPen: raw.armor_pen || 0,
        lifeOnHit: raw.life_on_hit || 0,

        customExp: raw.custom_exp || 0,
        customExpRequired: raw.custom_exp_required || 230,

        combatPower,

        // 额外属性
        extraConstitution: raw.extra_constitution || 0,
        extraMartial: raw.extra_martial || 0,
        extraDivinity: raw.extra_divinity || 0,
        extraAgility: raw.extra_agility || 0,
        extraAttackSpeed: raw.extra_attack_speed || 0,
        extraManaRegen: raw.extra_mana_regen || 0,
        extraArmor: raw.extra_armor || 0,
        extraMoveSpeed: raw.extra_move_speed || 0,
        extraDamage: raw.extra_base_damage || 0,
        extraLifeOnHit: raw.extra_life_on_hit || 0,

        // 战斗属性 (base + bonus)
        spellDamageBase: raw.spell_damage_base || 0,
        spellDamageBonus: raw.spell_damage_bonus || 0,
        spellDamage: raw.spell_damage || 0,
        block: raw.block || 0,
        finalDmgIncreaseBase: raw.final_dmg_increase_base || 0,
        finalDmgIncreaseBonus: raw.final_dmg_increase_bonus || 0,
        finalDmgIncrease: raw.final_dmg_increase || 0,
        finalDmgReductBase: raw.final_dmg_reduct_base || 0,
        finalDmgReductBonus: raw.final_dmg_reduct_bonus || 0,
        finalDmgReduct: raw.final_dmg_reduct || 0,
        evasionBase: raw.evasion_base || 0,
        evasionBonus: raw.evasion_bonus || 0,
        evasion: raw.evasion || 0,
    };
}

// ===== 辅助函数 =====

/** 阶位配置 */
export const RANK_CONFIG: { [key: number]: { name: string; color: string; desc: string } } = {
    0: { name: '凡胎', color: '#aaaaaa', desc: '肉眼凡胎，受困于世。' },
    1: { name: '觉醒', color: '#7accaa', desc: '窥见真实，打破枷锁。' },
    2: { name: '宗师', color: '#66bbff', desc: '技近乎道，登峰造极。' },
    3: { name: '半神', color: '#aa88ff', desc: '神性初显，超脱凡俗。' },
    4: { name: '神话', color: '#ffaa66', desc: '传颂之名，永恒不朽。' },
    5: { name: '禁忌', color: '#ff4466', desc: '不可直视，不可名状。' },
};

/** 获取阶位的最大等级 */
export function getMaxLevelForRank(rank: number): number {
    return Math.min((rank + 1) * 10, 50);
}

/** 检查是否在突破点 */
export function isAtBreakthrough(level: number, rank: number): boolean {
    const maxLevel = getMaxLevelForRank(rank);
    return level >= maxLevel && rank < 5;
}

/** 格式化战力（超过1万显示为X.XX万） */
export function formatCombatPower(power: number): string {
    if (power >= 10000) {
        return (power / 10000).toFixed(2) + '万';
    }
    return power.toString();
}

/** 职业名称映射 */
export const JOB_NAME_MAP: { [key: string]: string } = {
    bing_shen_dao: '兵神道',
    // 其他职业映射
};

/** 获取本地化职业名称 */
export function getLocalizedJobName(value: string | undefined, fallback: string = '...'): string {
    if (!value || value === 'undefined') return fallback;

    value = value.trim();

    // 处理 #Loc{token} 格式
    const locMatch = value.match(/^#Loc\{(.+)\}$/);
    if (locMatch) {
        const token = locMatch[1];
        const localized = $.Localize('#' + token);
        if (localized && localized !== '#' + token) {
            return localized;
        }
        if (JOB_NAME_MAP[token]) {
            return JOB_NAME_MAP[token];
        }
        return token;
    }

    // 处理 #token 格式
    if (value.startsWith('#')) {
        const localized = $.Localize(value);
        if (localized && localized !== value) {
            return localized;
        }
    }

    // 映射表查找
    if (JOB_NAME_MAP[value]) {
        return JOB_NAME_MAP[value];
    }

    // 排除英文ID
    if (value.startsWith('npc_') || value.includes('_hero_')) {
        return fallback;
    }

    return value;
}
