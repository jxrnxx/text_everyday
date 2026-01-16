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
    
    // 其他属性
    main_stat: 'Martial' | 'Divinity';
    rank: number;
    display_level: number;
    profession: string;
    
    custom_exp: number;
    custom_exp_required: number;
    
    crit_chance: number;
    crit_damage: number;
    armor_pen: number;
    
    life_on_hit_base: number;
    life_on_hit: number;
    
    extra_attack_speed: number;
    extra_mana_regen: number;
    extra_armor: number;
    extra_move_speed: number;
    
    base_move_speed: number;
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
    critChance: number;
    critDamage: number;
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
}

// ===== 属性计算函数 =====

/**
 * 计算单个属性的面板值
 * 公式: (基础 + (等级-1) * 成长 + 额外获得) * (1 + 加成)
 */
export function calculatePanelStat(
    base: number,
    gain: number,
    bonus: number,
    extra: number,
    level: number
): number {
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
    
    // 计算五维属性
    const constitution = calculatePanelStat(
        raw.constitution_base || 0,
        raw.constitution_gain || 0,
        raw.constitution_bonus || 0,
        raw.extra_constitution || 0,
        level
    );
    
    const martial = calculatePanelStat(
        raw.martial_base || 0,
        raw.martial_gain || 0,
        raw.martial_bonus || 0,
        raw.extra_martial || 0,
        level
    );
    
    const divinity = calculatePanelStat(
        raw.divinity_base || 0,
        raw.divinity_gain || 0,
        raw.divinity_bonus || 0,
        raw.extra_divinity || 0,
        level
    );
    
    const agility = calculatePanelStat(
        raw.agility_base || 0,
        raw.agility_gain || 0,
        raw.agility_bonus || 0,
        raw.extra_agility || 0,
        level
    );
    
    // 计算攻击力 = 面板攻击 + 主属性 * 1.5
    const dmgPanel = calculatePanelStat(
        raw.damage_base || 0,
        raw.damage_gain || 0,
        raw.damage_bonus || 0,
        raw.extra_base_damage || 0,
        level
    );
    const mainStat = raw.main_stat || 'Martial';
    const mainPanel = mainStat === 'Martial' ? martial : divinity;
    const attack = dmgPanel + Math.floor(mainPanel * 1.5);
    
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
        attack * 1 +
        defense * 5 +
        constitution * 10 +
        martial * 8 +
        divinity * 8 +
        maxHp / 10
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
        
        critChance: raw.crit_chance || 0,
        critDamage: raw.crit_damage || 150,
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
        extraLifeOnHit: (raw.life_on_hit || 0) - (raw.life_on_hit_base || 0),
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
    'bing_shen_dao': '兵神道',
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
