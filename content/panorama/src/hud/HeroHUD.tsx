import { type FC, useState, useEffect } from 'react';
import { isAnyPanelOpen as checkPanelOpen } from './PanelManager';

// ===== 使用统一的属性工具 =====
import {
    getHeroStats,
    getLocalizedJobName,
    RANK_CONFIG,
    getMaxLevelForRank,
    isAtBreakthrough,
    formatCombatPower,
    type PanelStats,
} from '../utils/StatsUtils';

// 属性文字样式
const statLabelStyle = {
    fontSize: '16px',
    color: '#c9b896',
    marginLeft: '6px',
    width: '50px',
};

const statValueStyle = {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#ffdd88',
    textShadow: '1px 1px 2px #000000, 0px 0px 4px #ffcc00',
    marginLeft: '4px',
    width: '80px',
};

// 属性数据接口（内部使用，与 PanelStats 兼容）
interface HeroStats {
    attack: number;
    defense: number;
    constitution: number;
    martial: number;
    divinity: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    rank: number;
    combatPower: number;
    exp: number;
    expRequired: number;
    level: number;
    displayLevel: number;
    customExp: number;
    customExpRequired: number;
}

// 计算显示等级和经验百分比
const getDisplayLevelAndExp = (
    rank: number,
    displayLevelFromServer: number,
    customExp: number,
    customExpRequired: number
): { displayLevel: number; displayExpPercent: number } => {
    const currentMaxLevel = getMaxLevelForRank(rank);
    let displayLevel = Math.min(displayLevelFromServer, currentMaxLevel);
    let displayExpPercent: number;

    if (displayLevel >= currentMaxLevel) {
        displayExpPercent = 100;
    } else {
        displayExpPercent = Math.min((customExp / Math.max(customExpRequired, 1)) * 100, 100);
    }

    return { displayLevel, displayExpPercent };
};

/**
 * 英雄HUD组件 - 底部信息栏
 * 头像框在背景内部左侧
 */
// 血条状态类型
type HpState = 'normal' | 'healing' | 'damaged' | 'low' | 'full';

const HeroHUD: FC = () => {
    const [professionName, setProfessionName] = useState("...");
    const [stats, setStats] = useState<HeroStats>({
        attack: 0,
        defense: 0,
        constitution: 0,
        martial: 0,
        divinity: 0,
        hp: 0,
        maxHp: 1,
        mp: 0,
        maxMp: 1,
        rank: 0,
        combatPower: 0,
        exp: 0,
        expRequired: 610,
        level: 1,
        displayLevel: 1,
        customExp: 0,
        customExpRequired: 230,
    });

    // 血条状态追踪
    const [prevHp, setPrevHp] = useState(0);
    const [hpState, setHpState] = useState<HpState>('normal');

    // Buff列表 - 存储当前英雄的buff信息
    interface BuffInfo {
        buffSerial: number;
        textureName: string;
        stackCount: number;
    }
    const [buffs, setBuffs] = useState<BuffInfo[]>([]);

    // 公共技能槽位 (F/G/R)
    interface PublicSkillInfo {
        slotIndex: number;
        slotKey: string;
        abilityName: string;
        hasAbility: boolean;
        rarity: number; // 品质等级: 1=凡, 2=灵, 3=仙, 4=神
        abilityEntityIndex: number; // 技能实体索引，用于tooltip显示
    }
    const [publicSkills, setPublicSkills] = useState<PublicSkillInfo[]>([
        { slotIndex: 0, slotKey: 'F', abilityName: '', hasAbility: false, rarity: 1, abilityEntityIndex: -1 },
        { slotIndex: 1, slotKey: 'G', abilityName: '', hasAbility: false, rarity: 1, abilityEntityIndex: -1 },
        { slotIndex: 2, slotKey: 'R', abilityName: '', hasAbility: false, rarity: 1, abilityEntityIndex: -1 },
    ]);

    // Q技能（soldier_war_strike）的实体索引
    const [qSkillEntityIndex, setQSkillEntityIndex] = useState(-1);

    // 装备神器槽位 (6个槽位)
    interface ArtifactSlotInfo {
        itemName: string | null;
        tier: number;
        displayName: string;
    }
    const [artifactSlots, setArtifactSlots] = useState<ArtifactSlotInfo[]>([
        { itemName: null, tier: 0, displayName: '' },
        { itemName: null, tier: 0, displayName: '' },
        { itemName: null, tier: 0, displayName: '' },
        { itemName: null, tier: 0, displayName: '' },
        { itemName: null, tier: 0, displayName: '' },
        { itemName: null, tier: 0, displayName: '' },
    ]);

    // 神器悬停提示状态
    const [hoveredArtifact, setHoveredArtifact] = useState<{ slotIndex: number; x: number; y: number } | null>(null);

    // 属性颜色常量
    const STAT_COLORS = {
        attack: '#FF6644',   // 红橙 — 攻击/武道
        hp: '#55FF55',       // 绿色 — 生命/根骨
        divinity: '#66CCFF', // 蓝色 — 神念/回蓝
        crit: '#FFAA33',     // 橙色 — 暴击
        speed: '#AADDFF',    // 浅蓝 — 移速/身法
        allStat: '#FFD700',  // 金色 — 全属性
        armor: '#CCCCCC',    // 银色 — 护甲/破势
    };

    // 神器信息映射
    const ARTIFACT_INFO: Record<number, {
        name: string;
        lore: Record<number, string>;  // tier -> 故事描述
        stats: Record<number, { label: string; value: string; color: string }[]>;  // tier -> 属性列表
    }> = {
        0: {
            name: '武器',
            lore: {
                0: '蒙尘古剑，剑意未消，似在等待有缘人将其唤醒。',
                1: '千锤百炼的凡铁之剑，虽非神兵，却能斩妖辟邪。',
                2: '精钢淬炼，剑锋所指，万邪退避，破甲无双。',
                3: '玄玉铸剑，剑气冲霄，斩尽天下不平事。',
            },
            stats: {
                0: [{ label: '攻击', value: '+10', color: STAT_COLORS.attack }],
                1: [{ label: '攻击', value: '+50', color: STAT_COLORS.attack }],
                2: [
                    { label: '攻击', value: '+200', color: STAT_COLORS.attack },
                    { label: '破势', value: '+10', color: STAT_COLORS.armor },
                ],
                3: [
                    { label: '攻击', value: '+500', color: STAT_COLORS.attack },
                    { label: '破势', value: '+25', color: STAT_COLORS.armor },
                ],
            },
        },
        1: {
            name: '衣甲',
            lore: {
                0: '残破衣甲，余温尚存，仿佛在诉说昔日荣光。',
                1: '凡铁锻造的甲胄，虽朴实无华，却坚不可摧。',
                2: '精钢铠甲，刀枪不入，护主周全，固若金汤。',
                3: '玄玉灵甲，万法不侵，御敌于千里之外。',
            },
            stats: {
                0: [{ label: '生命', value: '+100', color: STAT_COLORS.hp }],
                1: [{ label: '生命', value: '+500', color: STAT_COLORS.hp }],
                2: [
                    { label: '生命', value: '+3000', color: STAT_COLORS.hp },
                    { label: '护甲', value: '+10', color: STAT_COLORS.armor },
                ],
                3: [
                    { label: '生命', value: '+8000', color: STAT_COLORS.hp },
                    { label: '护甲', value: '+25', color: STAT_COLORS.armor },
                ],
            },
        },
        2: {
            name: '头冠',
            lore: {
                0: '灵光黯淡的法冠，静待有缘人唤醒其中神念。',
                1: '凡铁所铸法冠，灵力流转其间，增强神念感知。',
                2: '精钢法冠，灵力涌动，心神澄明，法力不竭。',
                3: '玄玉神冠，通天彻地，法力无边，万灵俯首。',
            },
            stats: {
                0: [{ label: '神念', value: '+2', color: STAT_COLORS.divinity }],
                1: [{ label: '神念', value: '+10', color: STAT_COLORS.divinity }],
                2: [
                    { label: '神念', value: '+50', color: STAT_COLORS.divinity },
                    { label: '回蓝', value: '+5', color: STAT_COLORS.divinity },
                ],
                3: [
                    { label: '神念', value: '+120', color: STAT_COLORS.divinity },
                    { label: '回蓝', value: '+12', color: STAT_COLORS.divinity },
                ],
            },
        },
        3: {
            name: '饰品',
            lore: {
                0: '蒙尘法戒，杀意犹存，隐隐散发凌厉之气。',
                1: '凡铁精工之戒，佩戴者出手必中要害。',
                2: '精钢法戒，会心四溢，一击致命，摧枯拉朽。',
                3: '玄玉灵戒，一击必杀，天地为之变色。',
            },
            stats: {
                0: [{ label: '暴击', value: '+2%', color: STAT_COLORS.crit }],
                1: [{ label: '暴击', value: '+5%', color: STAT_COLORS.crit }],
                2: [
                    { label: '暴击', value: '+10%', color: STAT_COLORS.crit },
                    { label: '爆伤', value: '+20%', color: STAT_COLORS.crit },
                ],
                3: [
                    { label: '暴击', value: '+18%', color: STAT_COLORS.crit },
                    { label: '爆伤', value: '+40%', color: STAT_COLORS.crit },
                ],
            },
        },
        4: {
            name: '鞋履',
            lore: {
                0: '千里之行，始于足下，此靴似曾踏遍山河。',
                1: '凡铁轻靴，履之如风，步若疾风追月。',
                2: '精钢战靴，闪避自如，来去无踪，步法通神。',
                3: '玄玉神行靴，缩地成寸，天地之间任我行。',
            },
            stats: {
                0: [{ label: '移速', value: '+10', color: STAT_COLORS.speed }],
                1: [{ label: '移速', value: '+30', color: STAT_COLORS.speed }],
                2: [
                    { label: '移速', value: '+50', color: STAT_COLORS.speed },
                    { label: '闪避', value: '+5%', color: STAT_COLORS.speed },
                ],
                3: [
                    { label: '移速', value: '+80', color: STAT_COLORS.speed },
                    { label: '闪避', value: '+10%', color: STAT_COLORS.speed },
                ],
            },
        },
        5: {
            name: '护符',
            lore: {
                0: '古旧符令，隐藏万法归一之力。',
                1: '凡铁铸令，四维增益，万法归宗。',
                2: '精钢符令，全属提升，减伤护体，攻守兼备。',
                3: '玄玉符令，天地共鸣，万法归一，攻守无双。',
            },
            stats: {
                0: [{ label: '全属性', value: '+2', color: STAT_COLORS.allStat }],
                1: [{ label: '全属性', value: '+5', color: STAT_COLORS.allStat }],
                2: [
                    { label: '全属性', value: '+20', color: STAT_COLORS.allStat },
                    { label: '减伤', value: '+2%', color: STAT_COLORS.allStat },
                ],
                3: [
                    { label: '全属性', value: '+50', color: STAT_COLORS.allStat },
                    { label: '减伤', value: '+5%', color: STAT_COLORS.allStat },
                ],
            },
        },
    };

    // 正在播放唤醒动画的槽位
    const [flashingSlots, setFlashingSlots] = useState<Set<number>>(new Set());

    // 隐藏状态 - 当其他面板打开时隐藏HeroHUD
    const [isHidden, setIsHidden] = useState(false);

    // 监听面板打开/关闭事件 - 使用 PanelManager 状态检测
    useEffect(() => {
        // 定期检查面板状态
        function checkPanelState() {
            setIsHidden(checkPanelOpen());
            $.Schedule(0.1, checkPanelState);
        }
        checkPanelState();
    }, []);

    // 计算血条状态 - 优化：只在状态实际改变时才更新
    useEffect(() => {
        const hpPercent = stats.hp / stats.maxHp;

        let newState: HpState = 'normal';

        if (stats.hp >= stats.maxHp) {
            newState = 'full';
        } else if (hpPercent <= 0.25) {
            newState = 'low';
        } else if (stats.hp > prevHp && prevHp > 0) {
            newState = 'healing';
            // 回血状态持续1秒后恢复正常
            $.Schedule(1.0, () => {
                setHpState(prev => prev === 'healing' ? 'normal' : prev);
            });
        } else if (stats.hp < prevHp && prevHp > 0) {
            newState = 'damaged';
            // 掉血状态持续0.5秒后恢复正常
            $.Schedule(0.5, () => {
                setHpState(prev => prev === 'damaged' ? 'normal' : prev);
            });
        }

        // 只在状态改变时才更新
        if (newState !== hpState && (newState === 'healing' || newState === 'damaged' || newState === 'low' || newState === 'full')) {
            setHpState(newState);
        }

        // 只在HP值真正改变时更新 prevHp
        if (stats.hp !== prevHp) {
            setPrevHp(stats.hp);
        }
    }, [stats.hp, stats.maxHp]);

    useEffect(() => {
        // 获取防御、HP、MP (来自 Entities API) - 攻击力由 NetTable 计算
        const updateApiStats = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            const armor = Entities.GetPhysicalArmorValue(localHero);

            // 获取真实HP/MP
            const hp = Entities.GetHealth(localHero);
            const maxHp = Entities.GetMaxHealth(localHero);
            const mp = Entities.GetMana(localHero);
            const maxMp = Entities.GetMaxMana(localHero);

            setStats(prev => ({
                ...prev,
                // attack 由 updateNetTableStats 计算，不在这里设置
                defense: Math.floor(armor),
                hp: hp,
                maxHp: maxHp || 1,
                mp: mp,
                maxMp: maxMp || 1,
                exp: (Entities as any).GetCurrentXP ? (Entities as any).GetCurrentXP(localHero) || 0 : 0,
                expRequired: (Entities as any).GetNeededXPToLevel ? (Entities as any).GetNeededXPToLevel(localHero) || 610 : 610,
                level: Entities.GetLevel(localHero) || 1,
            }));
        };

        // 获取职业和自定义属性 (使用统一工具 StatsUtils)
        const updateNetTableStats = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            // 使用统一的属性计算工具
            const heroStats = getHeroStats(localHero);
            if (!heroStats) return;

            // 职业名称
            setProfessionName(getLocalizedJobName(heroStats.profession, "..."));

            setStats(prev => ({
                ...prev,
                constitution: heroStats.constitution,
                martial: heroStats.martial,
                divinity: heroStats.divinity,
                attack: heroStats.attack,
                defense: heroStats.defense,
                rank: heroStats.rank,
                combatPower: heroStats.combatPower,
                displayLevel: heroStats.level,
                customExp: heroStats.customExp,
                customExpRequired: heroStats.customExpRequired,
                hp: heroStats.hp,
                maxHp: heroStats.maxHp,
                mp: heroStats.mp,
                maxMp: heroStats.maxMp,
            }));
        };

        // 延迟初始化，确保英雄实体准备好 (增加到1秒)
        $.Schedule(1.0, () => {
            updateApiStats();
            updateNetTableStats();
        });

        // 再次延迟刷新 (3秒后确保数据已同步)
        $.Schedule(3.0, () => {
            updateApiStats();
            updateNetTableStats();
        });

        // 监听 NetTable 变化 (事件驱动)
        CustomNetTables.SubscribeNetTableListener('custom_stats' as any, (table, key, data) => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (key === String(localHero)) {
                updateNetTableStats();
            }
        });

        // 定期刷新 NetTable 数据 (每2秒，确保数据同步)
        $.Schedule(1.0, function netTableLoop() {
            updateNetTableStats();
            $.Schedule(2.0, netTableLoop);
        });

        // HP/MP 更新（每0.2秒，约5fps，足够流畅且减少卡顿）
        $.Schedule(0.5, function hpLoop() {
            updateApiStats();
            $.Schedule(0.2, hpLoop);
        });

        // 神器装备更新函数 - 从 NetTable 读取玩家神器数据
        const updateArtifacts = () => {
            const playerId = Players.GetLocalPlayer();
            // 后端使用 'artifacts' 表，key 格式为 'player_X'
            const artifactData = CustomNetTables.GetTableValue('artifacts' as any, `player_${playerId}`) as any;
            if (!artifactData) return;

            const newSlots: ArtifactSlotInfo[] = [];
            for (let i = 0; i < 6; i++) {
                // 后端使用 slot_0, slot_1, ... 格式
                const slot = artifactData[`slot_${i}`];
                if (slot) {
                    $.Msg(`[HeroHUD] 槽位 ${i} 收到 tier=${slot.tier}, displayName=${slot.displayName}`);
                    newSlots.push({
                        itemName: slot.itemName || null,
                        tier: slot.tier || 0,
                        displayName: slot.displayName || '',
                    });
                } else {
                    newSlots.push({ itemName: null, tier: 0, displayName: '' });
                }
            }
            $.Msg(`[HeroHUD] 更新神器槽位: ${JSON.stringify(newSlots)}`);
            setArtifactSlots(newSlots);
        };

        // 监听神器 NetTable 变化
        CustomNetTables.SubscribeNetTableListener('artifacts' as any, (table, key, data) => {
            const playerId = Players.GetLocalPlayer();
            if (key === `player_${playerId}`) {
                updateArtifacts();
            }
        });

        // 初始获取神器数据
        $.Schedule(1.5, updateArtifacts);

        // Buff 更新函数 - 获取英雄当前所有可见的buff
        const updateBuffs = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            const buffList: { buffSerial: number; textureName: string; stackCount: number }[] = [];

            // 使用正确的Buffs API - 直接使用 buffIndex
            // @ts-ignore
            const modifierCount = Entities.GetNumBuffs(localHero);

            for (let i = 0; i < modifierCount; i++) {
                // 在 Panorama 中，Buffs API 直接使用 buffIndex (i) 作为第二个参数
                // @ts-ignore
                const isHidden = Buffs.IsHidden(localHero, i);
                // @ts-ignore
                const modifierName = Buffs.GetName(localHero, i);
                // @ts-ignore
                const textureName = Buffs.GetTexture(localHero, i);
                // @ts-ignore
                const stackCount = Buffs.GetStackCount(localHero, i) || 0;

                if (isHidden) continue;
                if (!textureName) continue;

                buffList.push({
                    buffSerial: i, // 使用 index 作为唯一标识
                    textureName,
                    stackCount,
                });
            }

            setBuffs(buffList);
        };

        // Buff 更新循环 - 每0.2秒刷新（保证攻速快时也能跟上）
        $.Schedule(0.5, function buffLoop() {
            updateBuffs();
            $.Schedule(0.2, buffLoop);
        });

        // 公共技能槽更新函数 - 扫描所有技能找公共技能
        const updatePublicSkills = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            // 公共技能名映射（技能名 -> 品质等级）
            const PUBLIC_ABILITIES: Record<string, number> = {
                'ability_public_martial_cleave': 1, // 武道·横扫 - 凡品
                // 未来添加更多公共技能
            };

            // 初始化三个槽位为空
            const skills: { slotIndex: number; slotKey: string; abilityName: string; hasAbility: boolean; rarity: number; abilityEntityIndex: number }[] = [
                { slotIndex: 0, slotKey: 'F', abilityName: '', hasAbility: false, rarity: 1, abilityEntityIndex: -1 },
                { slotIndex: 1, slotKey: 'G', abilityName: '', hasAbility: false, rarity: 1, abilityEntityIndex: -1 },
                { slotIndex: 2, slotKey: 'R', abilityName: '', hasAbility: false, rarity: 1, abilityEntityIndex: -1 },
            ];

            // 扫描英雄的所有技能（最多24个）
            const foundAbilities: { name: string; rarity: number; entityIndex: number }[] = [];
            let foundQSkillIndex = -1; // Q技能的实体索引
            // @ts-ignore
            const abilityCount = Entities.GetAbilityCount(localHero) || 24;

            for (let i = 0; i < Math.min(abilityCount, 24); i++) {
                // @ts-ignore
                const ability = Entities.GetAbility(localHero, i);
                if (!ability || ability === -1) continue;

                // @ts-ignore
                const abilityName = Abilities.GetAbilityName(ability);
                // @ts-ignore
                const level = Abilities.GetLevel(ability);

                // 检查是否是Q技能（soldier_war_strike）
                if (abilityName === 'soldier_war_strike') {
                    foundQSkillIndex = ability;
                }

                // 检查是否是公共技能
                const abilityRarity = PUBLIC_ABILITIES[abilityName];
                if (abilityName && abilityRarity !== undefined && level > 0) {
                    foundAbilities.push({ name: abilityName, rarity: abilityRarity, entityIndex: ability });
                }
            }

            // 设置Q技能实体索引
            setQSkillEntityIndex(foundQSkillIndex);

            // 将找到的公共技能填入槽位
            foundAbilities.forEach((ability, idx) => {
                if (idx < 3) {
                    skills[idx].abilityName = ability.name;
                    skills[idx].hasAbility = true;
                    skills[idx].rarity = ability.rarity;
                    skills[idx].abilityEntityIndex = ability.entityIndex;
                }
            });

            setPublicSkills(skills);
        };

        // 公共技能更新循环 - 每0.5秒刷新
        $.Schedule(1.0, function skillLoop() {
            updatePublicSkills();
            $.Schedule(0.5, skillLoop);
        });
    }, []);


    // 如果其他面板打开，则隐藏 HeroHUD
    if (isHidden) {
        return null;
    }

    return (
        <Panel style={{
            horizontalAlign: 'center' as const,
            verticalAlign: 'bottom' as const,
            marginBottom: '0px',
            width: '1200px',
            height: '500px',
        }}>
            {/* Buff/Debuff 栏 - 在血条正上方居中位置 */}
            <Panel style={{
                width: '300px',
                height: '48px',
                position: '565px 262px 0px' as const,
            }}>
                {/* 内部容器 - 用于居中显示buff图标 */}
                <Panel style={{
                    width: '100%',
                    height: '100%',
                    flowChildren: 'right' as const,
                    horizontalAlign: 'center' as const,
                }}>
                    {/* 动态渲染Buff图标 */}
                    {buffs.map((buff) => (
                        <Panel
                            key={buff.buffSerial}
                            className="BuffIcon"
                            style={{
                                width: '40px',
                                height: '40px',
                                marginLeft: '4px',
                                marginRight: '4px',
                                border: '2px solid #8b7040',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(30, 25, 20, 0.95)',
                                boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.8), inset 0px 0px 8px rgba(180, 140, 60, 0.3)',
                            }}
                        >
                            <Image
                                src={`s2r://panorama/images/spellicons/${buff.textureName}_png.vtex`}
                                style={{
                                    width: '34px',
                                    height: '34px',
                                    margin: '3px',
                                    borderRadius: '4px',
                                }}
                            />
                            {/* 层数显示 - 右下角 */}
                            {buff.stackCount > 0 && (
                                <Label
                                    text={String(buff.stackCount)}
                                    style={{
                                        position: '22px 24px 0px' as const,
                                        width: '18px',
                                        height: '16px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: '#ffeeaa',
                                        textShadow: '1px 1px 2px #000000, 0px 0px 4px #ffaa00',
                                        textAlign: 'center',
                                        backgroundColor: 'rgba(40, 30, 20, 0.9)',
                                        borderRadius: '3px',
                                    }}
                                />
                            )}
                        </Panel>
                    ))}
                </Panel>
            </Panel>

            {/* 主HUD背景横条 */}
            <Image
                src="file://{resources}/images/hud_bar_extended.png"
                style={{
                    width: '1200px',
                    height: '500px',
                    position: '0px 145px 0px' as const,
                }}
            />

            {/* 头像框 - 在背景内部左侧 */}
            <Panel style={{
                width: '210px',
                height: '250px',
                position: '77px 280px 0px' as const,
            }}>
                {/* 头像框内部发光粒子特效 - 底层 */}
                <DOTAParticleScenePanel
                    style={{
                        width: '150px',
                        height: '150px',
                        position: '30px 30px 0px' as const,
                        opacity: '0.6',
                    }}
                    // @ts-ignore
                    hittest={false}
                    particleName="particles/units/heroes/hero_wisp/wisp_ambient.vpcf"
                    particleonly={true}
                    startActive={true}
                    cameraOrigin="0 0 150"
                    lookAt="0 0 0"
                    fov={50}
                    squarePixels={true}
                />
                {/* 英雄动态头像 - 使用 DOTAScenePanel 显示 3D 模型 */}
                <DOTAScenePanel
                    // @ts-ignore
                    unit="npc_dota_hero_juggernaut"
                    style={{
                        width: '145px',
                        height: '145px',
                        position: '32px 32px 0px' as const,
                    }}
                />
                {/* 头像框背景图（中层） */}
                <Image
                    src="file://{resources}/images/hero_portrait_frame_v2.png"
                    style={{
                        width: '210px',
                        height: '210px',
                        position: '0px 0px 0px' as const,
                    }}
                />
                {/* 英雄职业名称（顶层）- 位置上移 */}
                <Label
                    text={professionName}
                    style={{
                        width: '210px',
                        position: '0px 162px 0px' as const,
                        fontSize: '22px',
                        fontWeight: 'bold' as const,
                        fontFamily: 'SimHei, Microsoft YaHei, sans-serif',
                        color: '#f0d080',
                        textShadow: '0px 0px 4px #ffcc00, 0px 1px 2px #000000',
                        textAlign: 'center' as const,
                        letterSpacing: '2px',
                    }}
                />
            </Panel>

            {/* 等级/阶位/战力/经验条区域 - 在HUD底部 */}
            <Panel style={{
                width: '1020px',
                height: '28px',
                position: '105px 480px 0px' as const,
            }}>
                {/* 左侧信息区域 - 固定宽度布局 */}
                <Panel style={{
                    width: '240px',
                    height: '28px',
                    position: '0px 0px 0px' as const,
                    flowChildren: 'right' as const,
                }}>
                    {/* 境界 - 固定宽度 */}
                    <Panel style={{
                        width: '55px',
                        height: '24px',
                    }}>
                        <Label
                            text={(RANK_CONFIG[stats.rank] || RANK_CONFIG[0]).name}
                            style={{
                                fontSize: '14px',
                                fontWeight: 'bold' as const,
                                color: (RANK_CONFIG[stats.rank] || RANK_CONFIG[0]).color,
                                textShadow: '0px 0px 4px rgba(100, 200, 150, 0.6), 1px 1px 1px #000000',
                                marginTop: '2px',
                            }}
                        />
                    </Panel>
                    {/* 战力 - 固定宽度 */}
                    <Panel style={{
                        width: '110px',
                        height: '24px',
                        flowChildren: 'right' as const,
                    }}>
                        <Label
                            text="战力"
                            style={{
                                fontSize: '14px',
                                color: '#cdb46b',
                                marginRight: '4px',
                                marginTop: '3px',
                            }}
                        />
                        <Label
                            text={formatCombatPower(stats.combatPower)}
                            style={{
                                width: '70px',
                                fontSize: '15px',
                                fontWeight: 'bold' as const,
                                color: '#ffcc66',
                                textAlign: 'left' as const,
                            }}
                        />
                    </Panel>
                    {/* 等级 - 直接使用服务端控制的displayLevel */}
                    <Panel style={{
                        width: '40px',
                        height: '24px',
                    }}>
                        <Label
                            text={`Lv.${stats.displayLevel}`}
                            style={{
                                fontSize: '17px',
                                fontWeight: 'bold' as const,
                                color: '#ffd866',
                                textShadow: '0px 0px 4px #aa7700, 1px 1px 1px #000000',
                            }}
                        />
                    </Panel>
                </Panel>

                {/* 经验条 - 绝对定位固定在右边 */}
                {(() => {
                    // 使用服务端控制的显示等级和自定义经验
                    const { displayLevel, displayExpPercent } = getDisplayLevelAndExp(
                        stats.rank,
                        stats.displayLevel,
                        stats.customExp,
                        stats.customExpRequired
                    );

                    // 判断是否在突破状态（使用显示等级）
                    // 禁忌阶位(rank=5)时不显示突破特效，因为已经是最高阶位
                    const atBreakthrough = stats.rank < 5 && isAtBreakthrough(displayLevel, stats.rank);

                    // 禁忌阶位：满经验条，但使用普通颜色
                    const isForbiddenRank = stats.rank === 5;

                    // 经验条宽度
                    const expWidth = (atBreakthrough || isForbiddenRank) ? '100%' : (displayExpPercent + '%');

                    return (
                        <Panel
                            className={atBreakthrough ? 'ExpBarGlowPulse' : ''}
                            style={{
                                width: '785px',
                                height: '14px',
                                position: '205px 4px 0px' as const,
                                backgroundColor: 'rgba(10, 12, 8, 0.85)',
                                // 突破时金色边框（禁忌阶位用普通边框）
                                border: atBreakthrough
                                    ? '1px solid #ddaa55'
                                    : '1px solid #4a5530',
                                borderRadius: '7px',
                                // 突破时简单的金色光晕 (动画由CSS类控制)
                                boxShadow: atBreakthrough
                                    ? '0px 0px 8px rgba(255, 180, 80, 0.5), inset 0px 1px 2px rgba(0, 0, 0, 0.5)'
                                    : 'inset 0px 1px 2px rgba(0, 0, 0, 0.5)',
                            }}>
                            {/* 经验条填充 */}
                            <Panel style={{
                                width: expWidth,
                                height: '12px',
                                marginTop: '1px',
                                marginLeft: '1px',
                                // 柔和的金色/琥珀色
                                backgroundColor: atBreakthrough
                                    ? 'gradient(linear, 0% 0%, 0% 100%, from(#e8b855), to(#bb7733))'
                                    : 'gradient(linear, 0% 0%, 0% 100%, from(#7ac855), to(#4a8833))',
                                borderRadius: '6px',
                            }}>
                                {/* 顶部高光 */}
                                <Panel style={{
                                    width: '100%',
                                    height: '4px',
                                    backgroundColor: atBreakthrough
                                        ? 'gradient(linear, 0% 0%, 0% 100%, from(rgba(255, 255, 200, 0.6)), to(rgba(255, 255, 200, 0)))'
                                        : 'gradient(linear, 0% 0%, 0% 100%, from(rgba(255, 255, 220, 0.4)), to(rgba(255, 255, 220, 0)))',
                                    borderRadius: '6px 6px 0px 0px',
                                }} />
                                {/* 右端发光点 */}
                                <Panel style={{
                                    width: '4px',
                                    height: '10px',
                                    horizontalAlign: 'right' as const,
                                    marginTop: '-3px',
                                    backgroundColor: atBreakthrough
                                        ? 'gradient(linear, 100% 0%, 0% 0%, from(rgba(255, 200, 100, 0.9)), to(rgba(255, 200, 100, 0)))'
                                        : 'gradient(linear, 100% 0%, 0% 0%, from(rgba(200, 255, 150, 0.9)), to(rgba(200, 255, 150, 0)))',
                                    borderRadius: '2px',
                                }} />
                            </Panel>
                            {/* 突破状态粒子特效 - 在经验条满时显示 (带脉冲) */}
                            {atBreakthrough && (
                                <Panel
                                    className="ExpParticlePulse"
                                    style={{
                                        width: '100%',
                                        height: '40px',
                                        position: '-5px -13px 0px' as const,
                                    }}
                                >
                                    <DOTAParticleScenePanel
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                        // @ts-ignore
                                        hittest={false}
                                        particleName="particles/econ/items/juggernaut/jugg_arcana/juggernaut_arcana_v2_ambient.vpcf"
                                        particleonly={true}
                                        startActive={true}
                                        cameraOrigin="0 0 100"
                                        lookAt="0 0 0"
                                        fov={60}
                                        squarePixels={true}
                                    />
                                </Panel>
                            )}
                        </Panel>
                    );
                })()}
            </Panel>

            {/* 测试进阶按钮 - 在经验条满时显示 (最高到禁忌rank=5) */}
            {isAtBreakthrough(stats.displayLevel, stats.rank) && stats.rank < 5 && (
                <Button
                    onactivate={() => {
                        Game.EmitSound('ui_menu_activate');
                        GameEvents.SendCustomGameEventToServer('cmd_test_rank_up', {});
                    }}
                    style={{
                        width: '80px',
                        height: '24px',
                        position: '1000px 482px 0px' as const,
                        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#ffd700), to(#cc8800))',
                        borderRadius: '4px',
                        border: '1px solid #ffdd55',
                        boxShadow: '0px 0px 8px rgba(255, 200, 80, 0.5)',
                    }}
                    className="ExpBarGlowPulse"
                >
                    <Label
                        text="进阶"
                        style={{
                            color: '#1a1a00',
                            fontSize: '14px',
                            fontWeight: 'bold' as const,
                            textAlign: 'center' as const,
                            horizontalAlign: 'center' as const,
                            verticalAlign: 'center' as const,
                            textShadow: '0px 0px 2px #ffffff88',
                        }}
                    />
                </Button>
            )}

            {/* 属性面板 - 在头像框右边 */}
            <Panel style={{
                width: '200px',
                height: '200px',
                position: '292px 315px 0px' as const,
            }}>
                {/* 透明边框 */}
                <Image
                    src="file://{resources}/images/stats_frame.png"
                    style={{
                        width: '180px',
                        height: '200px',
                        position: '-30px -25px 0px' as const,
                    }}
                />

                {/* 5个属性行 */}
                <Panel style={{
                    flowChildren: 'down' as const,
                    width: '180px',
                    height: '180px',
                    position: '-5px 6px 0px' as const,
                }}>
                    {/* 攻击 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image
                            src="file://{resources}/images/icon_attack.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="攻击1" style={statLabelStyle} />
                        <Label text={String(stats.attack)} style={statValueStyle} />
                    </Panel>

                    {/* 防御 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image
                            src="file://{resources}/images/icon_defense.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="防御:" style={statLabelStyle} />
                        <Label text={String(stats.defense)} style={statValueStyle} />
                    </Panel>

                    {/* 根骨 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image
                            src="file://{resources}/images/icon_constitution.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="根骨:" style={statLabelStyle} />
                        <Label text={String(stats.constitution)} style={statValueStyle} />
                    </Panel>

                    {/* 武道 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image
                            src="file://{resources}/images/icon_martial.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="武道:" style={statLabelStyle} />
                        <Label text={String(stats.martial)} style={statValueStyle} />
                    </Panel>

                    {/* 神念 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image
                            src="file://{resources}/images/icon_spirit.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="神念:" style={statLabelStyle} />
                        <Label text={String(stats.divinity)} style={statValueStyle} />
                    </Panel>
                </Panel>
            </Panel>

            {/* 流光分隔线 - 在属性面板右边 */}
            <Image
                src="file://{resources}/images/divider_glow_vertical.png"
                style={{
                    width: '40px',
                    height: '180px',
                    position: '427px 310px 0px' as const,
                }}
            />

            {/* 血条、蓝条和技能区域 */}
            <Panel style={{
                width: '480px',
                height: '220px',
                position: '462px 325px 0px' as const,
                flowChildren: 'down' as const,
            }}>
                {/* 血条 HP */}
                <Panel style={{
                    width: '400px',
                    height: '38px',
                    marginBottom: '2px',
                }}>
                    {/* 血条背景 - 根据状态切换样式 */}
                    <Panel
                        className={
                            hpState === 'low' ? 'HpBarBg--low' :
                                hpState === 'full' ? 'HpBarBg--full' :
                                    'HpBarBg'
                        }
                        style={{
                            width: '400px',
                            height: '38px',
                        }}
                    >
                        {/* 血条填充 */}
                        <Panel
                            className={`HpBarFill ${hpState === 'damaged' ? 'HpBarFill--damaged' : ''}`}
                            style={{
                                width: `${Math.floor(396 * stats.hp / stats.maxHp)}px`,
                                height: '34px',
                                marginTop: '2px',
                                marginLeft: '2px',
                                overflow: 'clip' as const,
                            }}
                        >
                            {/* 高光层 */}
                            <Panel className="HpBarShine" />
                            {/* 流动粒子特效 */}
                            <DOTAParticleScenePanel
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    opacity: '0.8',
                                }}
                                // @ts-ignore
                                hittest={false}
                                particleName="particles/healthbar_burner2.vpcf"
                                particleonly={true}
                                startActive={true}
                                cameraOrigin="-700 -395 120"
                                lookAt="0 -385 15"
                                fov={60}
                                squarePixels={true}
                            />
                        </Panel>
                    </Panel>
                    {/* HP数值 */}
                    <Label
                        text={`${Math.floor(stats.hp)} / ${Math.floor(stats.maxHp)}`}
                        style={{
                            align: 'center center',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            color: hpState === 'low' ? '#ff8888' : hpState === 'full' ? '#ffeecc' : '#ffffee',
                            textShadow: '1px 1px 1px #000000, 0px 0px 4px #aa2222',
                            letterSpacing: '1px',
                        }}
                    />
                </Panel>

                {/* 蓝条 MP */}
                <Panel style={{
                    width: '400px',
                    height: '38px',
                    marginBottom: '8px',
                }}>
                    {/* 蓝条背景 */}
                    <Panel
                        className="MpBarBg"
                        style={{
                            width: '400px',
                            height: '38px',
                        }}
                    >
                        {/* 蓝条填充 - 渐变 + 动态宽度 */}
                        <Panel
                            className="MpBarFill"
                            style={{
                                width: `${Math.floor(396 * stats.mp / stats.maxMp)}px`,
                                height: '34px',
                                marginTop: '2px',
                                marginLeft: '2px',
                                overflow: 'clip' as const,
                            }}
                        >
                            {/* 高光层 */}
                            <Panel className="MpBarShine" />
                            {/* 流动粒子特效 */}
                            <DOTAParticleScenePanel
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    opacity: '0.7',
                                }}
                                // @ts-ignore
                                hittest={false}
                                particleName="particles/healthbar_burner2.vpcf"
                                particleonly={true}
                                startActive={true}
                                cameraOrigin="-700 -395 120"
                                lookAt="0 -385 15"
                                fov={60}
                                squarePixels={true}
                            />
                        </Panel>
                    </Panel>
                    {/* 灵力数值 - 金色 */}
                    <Label
                        text={`${Math.floor(stats.mp)} / ${Math.floor(stats.maxMp)}`}
                        style={{
                            align: 'center center',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            color: '#fff8e0',
                            textShadow: '1px 1px 1px #000000, 0px 0px 4px #aa8822',
                            letterSpacing: '1px',
                        }}
                    />
                </Panel>

                {/* 技能栏 - 3个职业技能 + 空隙 + 3个公共技能 */}
                <Panel style={{ flowChildren: 'right' as const }}>
                    {/* 第1个技能 - 职业技能1 (兵伐·裂空) - Q */}
                    <Panel
                        className="SkillSlot"
                        onmouseover={(panel) => {
                            if (qSkillEntityIndex !== -1) {
                                // @ts-ignore
                                $.DispatchEvent('DOTAShowAbilityTooltipForEntityIndex', panel, 'soldier_war_strike', qSkillEntityIndex);
                            }
                        }}
                        onmouseout={() => {
                            // @ts-ignore
                            $.DispatchEvent('DOTAHideAbilityTooltip');
                        }}
                    >
                        <Panel className="SkillSlotFrame">
                            {/* 技能图标 */}
                            <Image
                                src="file://{images}/custom_game/hud/skill_q_soldier_war_strike.png"
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    horizontalAlign: 'center' as const,
                                    verticalAlign: 'center' as const,
                                }}
                            />
                        </Panel>
                        {/* 键位标签 */}
                        <Panel
                            style={{
                                position: '2px 2px 0px' as const,
                                width: '14px',
                                height: '16px',
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                borderRadius: '2px',
                            }}
                        >
                            <Label
                                text="Q"
                                style={{
                                    color: '#ffcc00',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    horizontalAlign: 'center' as const,
                                    verticalAlign: 'center' as const,
                                }}
                            />
                        </Panel>
                    </Panel>

                    {/* 第2-3个技能槽 - 职业技能2、3 (空槽) W/E */}
                    {['W', 'E'].map((key) => (
                        <Panel key={key} className="SkillSlot">
                            <Panel className="SkillSlotFrame">
                                <Panel className="SkillSlotInner" />
                            </Panel>
                            {/* 键位标签 - 空槽使用灰色 */}
                            <Panel
                                style={{
                                    position: '2px 2px 0px' as const,
                                    width: '14px',
                                    height: '16px',
                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                    borderRadius: '2px',
                                }}
                            >
                                <Label
                                    text={key}
                                    style={{
                                        color: '#888888',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        horizontalAlign: 'center' as const,
                                        verticalAlign: 'center' as const,
                                    }}
                                />
                            </Panel>
                        </Panel>
                    ))}

                    {/* 空隙 - 分隔职业技能和公共技能 */}
                    <Panel style={{ width: '58px', height: '54px' }} />

                    {/* 公共技能槽 F/G/R - 动态渲染 */}
                    {publicSkills.map((skill, index) => {
                        // 品质对应的边框图片
                        const RARITY_FRAMES: Record<number, string> = {
                            1: 'file://{images}/custom_game/hud/slot_frame_grey.png',  // 凡品
                            2: 'file://{images}/custom_game/hud/slot_frame_green.png', // 灵品
                            3: 'file://{images}/custom_game/hud/slot_frame_purple.png', // 仙品
                            4: 'file://{images}/custom_game/hud/slot_frame_orange.png', // 神品
                        };
                        // 品质对应的背景图片
                        const RARITY_BGS: Record<number, string> = {
                            1: 'file://{images}/custom_game/hud/rarity_bg_1.png', // 凡品背景
                            2: 'file://{images}/custom_game/hud/rarity_bg_2.png', // 灵品背景
                            3: 'file://{images}/custom_game/hud/rarity_bg_3.png', // 仙品背景
                            4: 'file://{images}/custom_game/hud/rarity_bg_4.png', // 神品背景
                        };
                        // 技能图标路径映射（使用 spellicons 目录下的标准图标）
                        const SKILL_ICONS: Record<string, string> = {
                            'ability_public_martial_cleave': 'file://{images}/spellicons/ability_public_martial_cleave.png',
                            // 未来添加更多公共技能图标
                        };
                        const frameImg = RARITY_FRAMES[skill.rarity] || RARITY_FRAMES[1];
                        const bgImg = RARITY_BGS[skill.rarity] || RARITY_BGS[1];
                        const iconImg = SKILL_ICONS[skill.abilityName] || '';

                        return (
                            <Panel
                                key={`public_${skill.slotIndex}`}
                                className="SkillSlot"
                                onmouseover={(panel) => {
                                    if (skill.hasAbility && skill.abilityEntityIndex !== -1) {
                                        // 使用技能实体索引显示原生tooltip - 需要abilityName和entityIndex
                                        // @ts-ignore
                                        $.DispatchEvent('DOTAShowAbilityTooltipForEntityIndex', panel, skill.abilityName, skill.abilityEntityIndex);
                                    }
                                }}
                                onmouseout={() => {
                                    // @ts-ignore
                                    $.DispatchEvent('DOTAHideAbilityTooltip');
                                }}
                            >
                                {skill.hasAbility ? (
                                    <>
                                        {/* 品质背景层 */}
                                        <Image
                                            src={bgImg}
                                            style={{
                                                width: '54px',
                                                height: '54px',
                                                position: '0px 0px 0px' as const,
                                            }}
                                        />
                                        {/* 技能图标层 - 使用直接路径加载 */}
                                        <Image
                                            src={iconImg}
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                position: '3px 3px 0px' as const,
                                            }}
                                        />
                                        {/* 品质边框层 */}
                                        <Image
                                            src={frameImg}
                                            style={{
                                                width: '54px',
                                                height: '54px',
                                                position: '0px 0px 0px' as const,
                                            }}
                                        />
                                        {/* 键位标签 */}
                                        <Panel
                                            style={{
                                                position: '2px 2px 0px' as const,
                                                width: '14px',
                                                height: '16px',
                                                backgroundColor: 'rgba(0,0,0,0.7)',
                                                borderRadius: '2px',
                                            }}
                                        >
                                            <Label
                                                text={skill.slotKey}
                                                style={{
                                                    color: '#ffcc00',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    horizontalAlign: 'center' as const,
                                                    verticalAlign: 'center' as const,
                                                }}
                                            />
                                        </Panel>
                                    </>
                                ) : (
                                    <>
                                        <Panel className="SkillSlotFrame">
                                            <Panel className="SkillSlotInner" />
                                        </Panel>
                                        {/* 键位标签 */}
                                        <Panel
                                            style={{
                                                position: '2px 2px 0px' as const,
                                                backgroundColor: 'rgba(0,0,0,0.5)',
                                                padding: '1px 3px',
                                                borderRadius: '2px',
                                            }}
                                        >
                                            <Label
                                                text={skill.slotKey}
                                                style={{
                                                    color: '#888888',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                }}
                                            />
                                        </Panel>
                                    </>
                                )}
                            </Panel>
                        );
                    })}
                </Panel>
            </Panel>
            {/* 流光分隔线 - 在属性面板右边 */}
            <Image
                src="file://{resources}/images/divider_glow_vertical.png"
                style={{
                    width: '40px',
                    height: '180px',
                    position: '857px 310px 0px' as const,
                }}
            />
            {/* 装备栏区域 - 右侧 */}
            <Panel style={{
                width: '200px',
                height: '150px',
                position: '894px 330px 0px' as const,
            }}>
                {/* 装备栏 - 6个槽位 (2行3列) */}
                <Panel style={{
                    flowChildren: 'down' as const,
                    width: '220px',
                    height: '140px',
                }}>
                    {/* 第一行 - 3个装备槽 (武器、衣服、头盔) */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px' }}>
                        {[0, 1, 2].map((slotIndex) => {
                            const slot = artifactSlots[slotIndex];
                            const isDormant = slot.tier === 0 && slot.itemName !== null;
                            const tier = slot.tier || 1;
                            const slotToIconName: Record<number, string> = {
                                0: 'weapon', 1: 'armor', 2: 'helm',
                                3: 'accessory', 4: 'boots', 5: 'amulet'
                            };
                            const iconName = slotToIconName[slotIndex];

                            // 处理点击 - 蒙尘神器升级（蒙尘破碎动画）
                            const handleClick = () => {
                                $.Msg(`[HeroHUD] 神器槽位 ${slotIndex} 被点击, isDormant=${isDormant}, itemName=${slot.itemName}`);
                                if (isDormant) {
                                    $.Msg(`[HeroHUD] 发送升级命令: cmd_upgrade_artifact, slot=${slotIndex}`);
                                    // 发送服务器命令
                                    GameEvents.SendCustomGameEventToServer('cmd_upgrade_artifact', { slot: slotIndex });

                                    // 触发破碎动画
                                    setFlashingSlots(prev => new Set(prev).add(slotIndex));

                                    // 0.6s后清理碎片
                                    $.Schedule(0.6, () => {
                                        setFlashingSlots(prev => {
                                            const next = new Set(prev);
                                            next.delete(slotIndex);
                                            return next;
                                        });
                                    });

                                    // 播放前端音效
                                    Game.EmitSound('Artifact.Awaken');
                                }
                            };

                            // 判断是否正在播放破碎动画
                            const isFlashing = flashingSlots.has(slotIndex);

                            // 蒙尘状态：isFlashing时已移除蒙尘（露出彩色），否则保持蒙尘
                            const bgClasses = `ArtifactBg${isDormant && !isFlashing ? ' IsDormantBg' : ''}`;
                            const iconClasses = `ArtifactIcon${isDormant && !isFlashing ? ' IsDormantIcon' : ''}`;

                            return (
                                <Panel
                                    key={slotIndex}
                                    className={`ArtifactSlot${isFlashing ? ' ArtifactAwakening' : ''}`}
                                    hittest={true}
                                    style={{
                                        width: '60px',
                                        height: '60px',
                                        marginRight: slotIndex < 2 ? '6px' : '0px',
                                    }}
                                    onactivate={handleClick}
                                    onmouseover={() => setHoveredArtifact({ slotIndex, x: 66 * slotIndex, y: 0 })}
                                    onmouseout={() => setHoveredArtifact(null)}
                                >
                                    {/* 背景层 */}
                                    <Image
                                        className={bgClasses}
                                        src={`file://{images}/custom_game/hud/artifact_bg_t${tier}.png`}
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            position: '0px 0px 0px' as const,
                                        }}
                                    />
                                    {/* 图标层 */}
                                    <Image
                                        className={iconClasses}
                                        src={`file://{images}/custom_game/hud/artifact_${iconName}_t${tier}.png`}
                                        style={{
                                            width: '52px',
                                            height: '52px',
                                            position: '4px 4px 0px' as const,
                                        }}
                                    />
                                    {/* 唤醒闪光 */}
                                    {isFlashing && (
                                        <Panel
                                            className="AwakenFlash"
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                position: '0px 0px 0px' as const,
                                            }}
                                        />
                                    )}
                                </Panel>
                            );
                        })}
                    </Panel>

                    {/* 第二行 - 3个装备槽 (饰品、鞋子、护符) */}
                    <Panel style={{ flowChildren: 'right' as const }}>
                        {[3, 4, 5].map((slotIndex) => {
                            const slot = artifactSlots[slotIndex];
                            const isDormant = slot.tier === 0 && slot.itemName !== null;
                            const tier = slot.tier || 1;
                            const slotToIconName: Record<number, string> = {
                                0: 'weapon', 1: 'armor', 2: 'helm',
                                3: 'accessory', 4: 'boots', 5: 'amulet'
                            };
                            const iconName = slotToIconName[slotIndex];

                            // 处理点击 - 蒙尘神器升级（蒙尘破碎动画）
                            const handleClick = () => {
                                $.Msg(`[HeroHUD] 神器槽位 ${slotIndex} 被点击, isDormant=${isDormant}, itemName=${slot.itemName}`);
                                if (isDormant) {
                                    $.Msg(`[HeroHUD] 发送升级命令: cmd_upgrade_artifact, slot=${slotIndex}`);
                                    // 发送服务器命令
                                    GameEvents.SendCustomGameEventToServer('cmd_upgrade_artifact', { slot: slotIndex });

                                    // 触发破碎动画
                                    setFlashingSlots(prev => new Set(prev).add(slotIndex));

                                    // 0.6s后清理碎片
                                    $.Schedule(0.6, () => {
                                        setFlashingSlots(prev => {
                                            const next = new Set(prev);
                                            next.delete(slotIndex);
                                            return next;
                                        });
                                    });

                                    // 播放前端音效
                                    Game.EmitSound('DOTA_Item.MantaStyle.Activate');
                                }
                            };

                            // 判断是否正在播放破碎动画
                            const isFlashing = flashingSlots.has(slotIndex);

                            // 蒙尘状态：isFlashing时已移除蒙尘（露出彩色），否则保持蒙尘
                            const bgClasses = `ArtifactBg${isDormant && !isFlashing ? ' IsDormantBg' : ''}`;
                            const iconClasses = `ArtifactIcon${isDormant && !isFlashing ? ' IsDormantIcon' : ''}`;

                            return (
                                <Panel
                                    key={slotIndex}
                                    className={`ArtifactSlot${isFlashing ? ' ArtifactAwakening' : ''}`}
                                    hittest={true}
                                    style={{
                                        width: '60px',
                                        height: '60px',
                                        marginRight: slotIndex < 5 ? '6px' : '0px',
                                    }}
                                    onactivate={handleClick}
                                    onmouseover={() => setHoveredArtifact({ slotIndex, x: 66 * (slotIndex - 3), y: 66 })}
                                    onmouseout={() => setHoveredArtifact(null)}
                                >
                                    {/* 背景层 */}
                                    <Image
                                        className={bgClasses}
                                        src={`file://{images}/custom_game/hud/artifact_bg_t${tier}.png`}
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            position: '0px 0px 0px' as const,
                                        }}
                                    />
                                    {/* 图标层 */}
                                    <Image
                                        className={iconClasses}
                                        src={`file://{images}/custom_game/hud/artifact_${iconName}_t${tier}.png`}
                                        style={{
                                            width: '52px',
                                            height: '52px',
                                            position: '4px 4px 0px' as const,
                                        }}
                                    />
                                    {/* 唤醒闪光 */}
                                    {isFlashing && (
                                        <Panel
                                            className="AwakenFlash"
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                position: '0px 0px 0px' as const,
                                            }}
                                        />
                                    )}
                                </Panel>
                            );
                        })}
                    </Panel>
                </Panel>
            </Panel>

            {/* 神器悬停提示 */}
            {hoveredArtifact && (
                <Panel
                    style={{
                        position: `${894 + hoveredArtifact.x + 70}px ${330 + hoveredArtifact.y - 20}px 0px` as const,
                        width: '140px',
                        padding: '10px 12px',
                        backgroundColor: 'rgba(25, 50, 55, 0.95)',
                        border: '1px solid #c9a861',
                        borderRadius: '6px',
                        boxShadow: '0px 0px 12px 4px rgba(60, 120, 110, 0.35)',
                        flowChildren: 'down' as const,
                    }}
                >
                    {/* 标题 - 神器名称 (从 NetTable 的 displayName 读取) */}
                    <Label
                        text={artifactSlots[hoveredArtifact.slotIndex].displayName
                            || ARTIFACT_INFO[hoveredArtifact.slotIndex].name}
                        style={{
                            color: (() => {
                                const t = artifactSlots[hoveredArtifact.slotIndex].tier;
                                if (t === 0) return '#888888';  // 蒙尘 - 灰色
                                if (t === 1) return '#e0e0e0';  // 凡铁 - 银白
                                if (t === 2) return '#66ccff';  // 精钢 - 青蓝
                                if (t === 3) return '#cc66ff';  // 玄铁 - 紫色
                                if (t === 4) return '#ff9933';  // 灵器 - 橙色
                                return '#ffd700';               // 神器 - 金色
                            })(),
                            fontSize: '16px',
                            fontWeight: 'bold' as const,
                            textShadow: (() => {
                                const t = artifactSlots[hoveredArtifact.slotIndex].tier;
                                if (t === 0) return '0px 0px 4px #666666';
                                if (t === 1) return '0px 0px 6px #aaaaaa';
                                if (t === 2) return '0px 0px 8px #3399cc';
                                if (t === 3) return '0px 0px 8px #9933cc';
                                if (t === 4) return '0px 0px 10px #cc6600';
                                return '0px 0px 10px #ccaa00';
                            })(),
                            horizontalAlign: 'center' as const,
                            textAlign: 'center' as const,
                            letterSpacing: '2px',
                            marginBottom: '4px',
                        }}
                    />
                    {/* 分割线 */}
                    <Panel style={{
                        width: '80%',
                        height: '1px',
                        backgroundColor: '#c9a861',
                        horizontalAlign: 'center' as const,
                        marginTop: '2px',
                        marginBottom: '6px',
                        opacity: '0.6',
                    }} />
                    {/* 故事描述 */}
                    <Label
                        text={(() => {
                            const tier = artifactSlots[hoveredArtifact.slotIndex].tier;
                            const info = ARTIFACT_INFO[hoveredArtifact.slotIndex];
                            return info.lore[tier] || info.lore[0];
                        })()}
                        style={{
                            color: '#c8b896',
                            fontSize: '11px',
                            horizontalAlign: 'center' as const,
                            textAlign: 'center' as const,
                            opacity: '0.75',
                            marginBottom: '6px',
                            fontStyle: 'italic' as const,
                        }}
                    />
                    {/* 分割线2 */}
                    <Panel style={{
                        width: '80%',
                        height: '1px',
                        backgroundColor: '#c9a861',
                        horizontalAlign: 'center' as const,
                        marginBottom: '6px',
                        opacity: '0.4',
                    }} />
                    {/* 属性加成 - 每条独立着色 */}
                    {(() => {
                        const tier = artifactSlots[hoveredArtifact.slotIndex].tier;
                        const info = ARTIFACT_INFO[hoveredArtifact.slotIndex];
                        const statList = info.stats[tier] || info.stats[0];
                        return statList.map((stat, i) => (
                            <Label
                                key={`stat-${i}`}
                                text={`${stat.label}  ${stat.value}`}
                                style={{
                                    color: stat.color,
                                    fontSize: '13px',
                                    fontWeight: 'bold' as const,
                                    textShadow: `0px 0px 6px ${stat.color}66`,
                                    horizontalAlign: 'center' as const,
                                    textAlign: 'center' as const,
                                    marginBottom: '2px',
                                }}
                            />
                        ));
                    })()}
                    {/* Tier 0 升级提示 - 呼吸动画 */}
                    {artifactSlots[hoveredArtifact.slotIndex].tier === 0 && (
                        <Label
                            text="点击唤醒"
                            className="TooltipActionHint"
                            style={{
                                fontSize: '12px',
                                horizontalAlign: 'center' as const,
                                textAlign: 'center' as const,
                                marginTop: '4px',
                            }}
                        />
                    )}
                </Panel>
            )}
        </Panel>
    );
};

export default HeroHUD;
