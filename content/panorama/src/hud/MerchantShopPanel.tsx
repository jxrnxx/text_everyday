/**
 * MerchantShopPanel.tsx
 * 八荒演武 - 修炼商店面板
 * 布局: NPC肖像(左) + 玉面板(右/中)
 * 使用 slot_1~8.png 图片作为技能格子
 */

import React, { useEffect, useState } from 'react';
import { openPanel, markPanelClosed, registerPanel } from './PanelManager';

// 技能槽位数据
interface SkillSlot {
    id: number;
    name: string;
    stat: string;
    bonus: string;
    purchased: boolean;
}

// 默认费用 (会被 NetTable 覆盖)
const DEFAULT_SLOT_COST = 200;

// Tier 名称映射 (用于显示)
const TIER_NAMES: Record<number, string> = {
    1: '入门期',
    2: '觉醒期',
    3: '凝丹期',
};

// 默认技能配置 (会被 NetTable 覆盖)
const DEFAULT_SKILL_CONFIG: SkillSlot[] = [
    { id: 1, name: '根骨', stat: '+5', bonus: '根骨', purchased: false },
    { id: 2, name: '武道', stat: '+5', bonus: '武道', purchased: false },
    { id: 3, name: '神念', stat: '+5', bonus: '神念', purchased: false },
    { id: 4, name: '戒守', stat: '+2', bonus: '护甲', purchased: false },
    { id: 5, name: '回能', stat: '+2', bonus: '回蓝', purchased: false },
    { id: 6, name: '极速', stat: '+15', bonus: '攻速', purchased: false },
    { id: 7, name: '饮血', stat: '+10', bonus: '攻击回血', purchased: false },
    { id: 8, name: '破军', stat: '+15', bonus: '攻击', purchased: false },
];

// 技能描述 (用于悬浮窗) - key 需要匹配技能的 name 字段
const SKILL_DESC: Record<string, string> = {
    '根骨': '肉身根基，气血充沛（+生命值）',
    '武道': '武学造诣，勇猛精进（+物理伤害）',
    '神念': '神魂凝练，法力深厚（+魔法值）',
    '戒守': '金刚不坏，刀枪不入（+护甲）',
    '回能': '内息运转，灵力回复（+回蓝）',
    '极速': '出手如电，迅捷无双（+攻速）',
    '饮血': '以战养战，攻击回血（+吸血%）',
    '破军': '力量增幅，攻击提升（+攻击力）',
};

// 槽位图片路径 (100x100px 填满版本)
const SLOT_IMAGES = [
    "file://{resources}/images/slot_1_new.png",
    "file://{resources}/images/slot_2_new.png",
    "file://{resources}/images/slot_3_new.png",
    "file://{resources}/images/slot_4_new.png",
    "file://{resources}/images/slot_5_new.png",
    "file://{resources}/images/slot_6_new.png",
    "file://{resources}/images/slot_7_new.png",
    "file://{resources}/images/slot_8_new.png",
];

// 槽位位置配置 (4x2网格, 居中)
const SLOT_POSITIONS = [
    // 第一行
    { x: 100, y: 180 },
    { x: 210, y: 180 },
    { x: 320, y: 180 },
    { x: 430, y: 180 },
    // 第二行
    { x: 100, y: 245 },
    { x: 210, y: 245 },
    { x: 320, y: 245 },
    { x: 430, y: 245 },
];

const MerchantShopPanel: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [skills, setSkills] = useState<SkillSlot[]>(DEFAULT_SKILL_CONFIG);
    const [hoveredSkill, setHoveredSkill] = useState<{ skill: SkillSlot; index: number } | null>(null);
    const [hoveredPurchaseAll, setHoveredPurchaseAll] = useState(false);  // 全修按钮悬停状态
    const [currentTier, setCurrentTier] = useState(1);
    const [tierName, setTierName] = useState('入门期');
    const [slotCost, setSlotCost] = useState(DEFAULT_SLOT_COST);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = React.useRef<number>(0); // 用于跟踪定时器

    // 显示浮动提示
    const showToast = (message: string) => {
        // 增加计时器版本号，使旧的定时器失效
        toastTimerRef.current += 1;
        const currentTimer = toastTimerRef.current;

        setToastMessage(message);
        $.Schedule(1.3, () => {
            // 只有当版本号匹配时才清除（说明没有新的消息覆盖）
            if (toastTimerRef.current === currentTimer) {
                setToastMessage(null);
            }
        });
    };

    // 检查是否所有技能都购买了
    const allPurchased = skills.every(s => s.purchased);
    // 已购买数量
    const purchasedCount = skills.filter(s => s.purchased).length;
    // 未购买数量
    const unpurchasedCount = skills.filter(s => !s.purchased).length;
    // 从 NetTable 读取玩家灵石
    const [playerGold, setPlayerGold] = useState(0);

    // 订阅经济数据更新
    useEffect(() => {
        const localPlayer = Players.GetLocalPlayer();
        const updateGold = () => {
            const economyData = CustomNetTables.GetTableValue('economy', `player_${localPlayer}` as any) as any;
            if (economyData && economyData.spirit_coin !== undefined) {
                setPlayerGold(economyData.spirit_coin);
            }
        };

        // 初始读取
        updateGold();

        // 订阅更新
        const listener = CustomNetTables.SubscribeNetTableListener('economy' as any, updateGold);
        return () => {
            CustomNetTables.UnsubscribeNetTableListener(listener);
        };
    }, []);

    // 每次面板打开时强制刷新数据
    useEffect(() => {
        if (isVisible) {
            const localPlayer = Players.GetLocalPlayer();
            const netTableKey = `player_${localPlayer}`;

            // 尝试读取 NetTable
            const upgradeData = CustomNetTables.GetTableValue('upgrade_system', netTableKey as any) as any;

            if (upgradeData) {

                // 更新状态
                setCurrentTier(upgradeData.current_tier || 1);
                setTierName(upgradeData.tier_name || TIER_NAMES[upgradeData.current_tier] || '入门期');
                setSlotCost(upgradeData.cost_per_slot || 200);

                if (upgradeData.slots_config) {
                    const newSkills: SkillSlot[] = [];
                    for (let i = 0; i < 8; i++) {
                        const luaIndex = i + 1;
                        const slotConfig = upgradeData.slots_config[luaIndex];
                        const isPurchased = upgradeData.slots_purchased ? upgradeData.slots_purchased[luaIndex] === true : false;

                        if (slotConfig && slotConfig.name) {
                            newSkills.push({
                                id: i + 1,
                                name: slotConfig.name,
                                stat: `+${slotConfig.value}${slotConfig.is_percent ? '%' : ''}`,
                                bonus: slotConfig.name,
                                purchased: isPurchased,
                            });
                        } else {
                            newSkills.push({
                                ...DEFAULT_SKILL_CONFIG[i],
                                purchased: isPurchased,
                            });
                        }
                    }
                    setSkills(newSkills);
                }
            } else {
            }
        }
    }, [isVisible]);

    // 订阅升级系统 NetTable - 获取当前 Tier 配置
    // 使用 ref 来追踪当前 tier，避免闭包问题
    const currentTierRef = React.useRef(currentTier);
    currentTierRef.current = currentTier;

    useEffect(() => {
        const localPlayer = Players.GetLocalPlayer();
        const updateUpgradeData = () => {
            const upgradeData = CustomNetTables.GetTableValue('upgrade_system', `player_${localPlayer}` as any) as any;
            if (upgradeData) {
                const serverTier = upgradeData.current_tier;
                const tierChanged = serverTier !== currentTierRef.current;

                // 更新 Tier 信息
                if (serverTier !== undefined) {
                    setCurrentTier(serverTier);
                    setTierName(upgradeData.tier_name || TIER_NAMES[serverTier] || '');
                }
                if (upgradeData.cost_per_slot !== undefined) {
                    setSlotCost(upgradeData.cost_per_slot);
                }

                // 更新槽位配置
                if (upgradeData.slots_config) {

                    // 如果 tier 变化了（突破），完全重置为新tier的配置
                    if (tierChanged) {
                        const newSkills: SkillSlot[] = [];
                        for (let i = 0; i < 8; i++) {
                            const luaIndex = i + 1;
                            const slotConfig = upgradeData.slots_config[luaIndex];
                            const isPurchased = upgradeData.slots_purchased ? upgradeData.slots_purchased[luaIndex] === true : false;

                            if (slotConfig && slotConfig.name) {
                                newSkills.push({
                                    id: i + 1,
                                    name: slotConfig.name,
                                    stat: `+${slotConfig.value}${slotConfig.is_percent ? '%' : ''}`,
                                    bonus: slotConfig.name,
                                    purchased: isPurchased,
                                });
                            } else {
                                newSkills.push({
                                    ...DEFAULT_SKILL_CONFIG[i],
                                    purchased: isPurchased,
                                });
                            }
                        }
                        setSkills(newSkills);
                    }
                    // 如果 tier 没变，不覆盖本地状态（避免覆盖本地的已购买状态）
                    // 本地状态由 handlePurchase 直接管理
                }
            }
        };

        // 初始读取
        updateUpgradeData();

        // 订阅更新
        const listener = CustomNetTables.SubscribeNetTableListener('upgrade_system' as any, updateUpgradeData);
        return () => {
            CustomNetTables.UnsubscribeNetTableListener(listener);
        };
    }, []);

    // 监听突破刷新事件
    useEffect(() => {
        const listenerId = GameEvents.Subscribe('refresh_merchant_ui', (event: any) => {

            // 突破成功后，显示提示并播放音效
            const newTier = event.new_tier;
            const tierNameFromServer = event.tier_name || TIER_NAMES[newTier] || '';

            showToast(`突破成功！进入${tierNameFromServer}！`);
            Game.EmitSound('Hero_Zeus.GodsWrath.Target');

            // 延迟 100ms 后读取 NetTable，确保数据已同步
            $.Schedule(0.1, () => {
                const localPlayer = Players.GetLocalPlayer();
                const upgradeData = CustomNetTables.GetTableValue('upgrade_system', `player_${localPlayer}` as any) as any;


                if (upgradeData && upgradeData.current_tier) {
                    // 更新 Tier 信息
                    setCurrentTier(upgradeData.current_tier);
                    setTierName(upgradeData.tier_name || TIER_NAMES[upgradeData.current_tier] || '');
                    setSlotCost(upgradeData.cost_per_slot || 200);


                    // 更新技能配置
                    if (upgradeData.slots_config) {
                        const newSkills: SkillSlot[] = [];
                        for (let i = 0; i < 8; i++) {
                            const luaIndex = i + 1;
                            const slotConfig = upgradeData.slots_config[luaIndex];
                            const isPurchased = upgradeData.slots_purchased ? upgradeData.slots_purchased[luaIndex] === true : false;

                            if (slotConfig && slotConfig.name) {
                                newSkills.push({
                                    id: i + 1,
                                    name: slotConfig.name,
                                    stat: `+${slotConfig.value}${slotConfig.is_percent ? '%' : ''}`,
                                    bonus: slotConfig.name,
                                    purchased: isPurchased,
                                });
                            } else {
                                newSkills.push({
                                    ...DEFAULT_SKILL_CONFIG[i],
                                    purchased: isPurchased,
                                });
                            }
                        }
                        setSkills(newSkills);
                    }
                } else {
                    // 如果仍然没有数据，再试一次
                    $.Schedule(0.2, () => {
                        const retryData = CustomNetTables.GetTableValue('upgrade_system', `player_${localPlayer}` as any) as any;
                        if (retryData && retryData.current_tier) {
                            setCurrentTier(retryData.current_tier);
                            setTierName(retryData.tier_name || TIER_NAMES[retryData.current_tier] || '');
                            setSlotCost(retryData.cost_per_slot || 200);
                        }
                    });
                }
            });
        });

        return () => {
            GameEvents.Unsubscribe(listenerId);
        };
    }, []);

    // 使用动态 slotCost 计算
    const dynamicTotalCost = unpurchasedCount * slotCost;
    const canAffordAll = playerGold >= dynamicTotalCost && unpurchasedCount > 0;
    const canAffordOne = playerGold >= slotCost;

    // handleClose 引用 - 需要在 useEffect 之前定义
    const handleCloseRef = React.useRef<() => void>(() => { });

    // 标记循环是否已启动，避免重复创建
    const loopStartedRef = React.useRef(false);

    // 使用 ref 跟踪 isVisible 状态，避免闭包问题
    const isVisibleRef = React.useRef(isVisible);
    isVisibleRef.current = isVisible;

    // 检测点击商人打开面板 + 右键关闭 + 选中英雄关闭
    useEffect(() => {
        // 仅在首次挂载时启动循环
        if (loopStartedRef.current) return;
        loopStartedRef.current = true;

        // 注册到 PanelManager
        registerPanel('merchant_panel', () => {
            setIsVisible(false);
            Game.EmitSound('Shop.PanelDown');
        });

        const checkMerchantClick = () => {
            const selectedEntity = Players.GetLocalPlayerPortraitUnit();
            const localPlayer = Players.GetLocalPlayer();
            const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);

            if (selectedEntity === -1) return;

            const unitName = Entities.GetUnitName(selectedEntity);
            const isMerchant = unitName === 'npc_cultivation_merchant';
            const isOwnHero = selectedEntity === heroIndex;

            // 打开逻辑: 商人被选中且面板不可见
            if (isMerchant && !isVisibleRef.current) {
                openPanel('merchant_panel'); // 这会自动隐藏 HeroHUD
                setIsVisible(true);
                Game.EmitSound('Shop.PanelUp');
            }

            // 选中自己英雄时关闭面板
            if (isVisibleRef.current && isOwnHero) {
                handleCloseRef.current();
            }

            // 右键关闭逻辑: 面板可见 + 右键按下
            const isRightDown = GameUI.IsMouseDown(1) || GameUI.IsMouseDown(2);
            if (isVisibleRef.current && isRightDown) {
                handleCloseRef.current();
            }
        };

        $.Schedule(0.5, function loop() {
            checkMerchantClick();
            $.Schedule(0.1, loop); // 加快检测频率
        });
    }, []);


    // ESC 键关闭
    useEffect(() => {
        if (isVisible) {
            // 注册 ESC 键监听
            $.RegisterKeyBind($.GetContextPanel(), 'key_escape', () => {
                handleCloseRef.current();
            });
        }
    }, [isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        Game.EmitSound('Shop.PanelDown');
        markPanelClosed('merchant_panel'); // 通知 PanelManager 面板已关闭，HeroHUD 会自动显示

        // 强制选中玩家英雄，这样商人就被取消选中了
        // 下次点击商人才会被检测为"新选中"
        const localPlayer = Players.GetLocalPlayer();
        const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);
        if (heroIndex !== -1) {
            GameUI.SelectUnit(heroIndex, false);
        }
    };

    // 技能名称到属性类型的映射 (包含新旧名称)
    const STAT_TYPE_MAP: { [key: string]: string } = {
        '根骨': 'constitution',
        '武道': 'martial',
        '神念': 'divinity',
        // 旧名称兼容
        '护甲': 'armor',
        '回蓝': 'mana_regen',
        '攻速': 'attack_speed',
        '回血': 'life_on_hit',
        '攻击': 'base_damage',
        // Tier 配置使用的新名称
        '戒守': 'armor',
        '回能': 'mana_regen',
        '极速': 'attack_speed',
        '饮血': 'life_on_hit',  // Tier 1 用 life_on_hit, Tier 2 用 lifesteal_pct (由后端处理)
        '破军': 'base_damage',
    };

    const handlePurchase = (skill: SkillSlot) => {
        if (skill.purchased) return;

        // 检查余额 (使用动态 slotCost)
        if (playerGold < slotCost) {
            Game.EmitSound('General.CastFail_NoMana');
            showToast(`灵石不足，需要 ${slotCost}`);
            return;
        }

        // 发送购买事件到服务端 (包含 slot_index 用于自动突破检测)
        const statType = STAT_TYPE_MAP[skill.name];
        const slotIndex = skills.findIndex(s => s.id === skill.id);
        if (statType) {
            GameEvents.SendCustomGameEventToServer('cmd_merchant_purchase', {
                stat_type: statType,
                amount: parseInt(skill.stat.replace(/[+%]/g, '')) || 0,
                slot_index: slotIndex,
            });
        }

        // 立即更新本地状态
        setSkills(prev => prev.map(s =>
            s.id === skill.id ? { ...s, purchased: true } : s
        ));
        Game.EmitSound('General.Buy');
    };

    const handlePurchaseAll = () => {
        // 检查余额是否足够购买所有 (使用动态 cost)
        if (playerGold < dynamicTotalCost || unpurchasedCount === 0) {
            Game.EmitSound('General.CastFail_NoMana');
            showToast(`灵石不足，需要 ${dynamicTotalCost} 灵石`);
            return;
        }

        // 全修 - 购买所有未购买的槽位
        skills.forEach((skill, index) => {
            if (!skill.purchased) {
                const statType = STAT_TYPE_MAP[skill.name];
                if (statType) {
                    GameEvents.SendCustomGameEventToServer('cmd_merchant_purchase', {
                        stat_type: statType,
                        amount: parseInt(skill.stat.replace(/[+%]/g, '')) || 0,
                        slot_index: index,
                    });
                }
            }
        });

        // 立即更新本地状态
        setSkills(prev => prev.map(s => ({ ...s, purchased: true })));
        Game.EmitSound('General.Buy');
        Game.EmitSound('Hero_Invoker.LevelUp');
    };

    if (!isVisible) return null;

    // 更新 handleCloseRef
    handleCloseRef.current = handleClose;

    return (
        <Panel style={styles.overlay} hittest={false} hittestchildren={true}>
            {/* 主包装容器 - NPC肖像 + 玉面板 */}
            <Panel style={styles.merchantWrapper}>

                {/* NPC肖像区域 */}
                <Panel style={styles.npcContainer}>
                    {/* 商人对话气泡 - 显示在NPC头顶 */}
                    {toastMessage && (
                        <Panel style={styles.speechBubbleWrapper} className="SpeechFadeIn">
                            <Panel style={styles.speechBubble}>
                                <Label text={`"${toastMessage}"`} style={styles.speechText} />
                            </Panel>
                            {/* 气泡小尾巴 */}
                            <Panel style={styles.speechTail} />
                        </Panel>
                    )}

                    {/* NPC肖像 - 呼吸动画 */}
                    <Image
                        src="file://{resources}/images/shop_01.png"
                        style={styles.npcPortrait}
                        className="NpcBreathing"
                    />
                </Panel>

                {/* 玉面板容器 (右侧) */}
                <Panel style={styles.panelContainer}>
                    {/* 背景图 */}
                    <Image
                        src="file://{resources}/images/shop_panel_large.png"
                        style={styles.background}
                    />

                    {/* 标题 - 显示 Tier 名称 */}
                    <Label
                        text={`修炼境界 · ${tierName}`}
                        style={styles.title}
                    />

                    {/* 技能槽位网格 (使用图片) */}
                    {skills.map((skill, index) => (
                        <Panel
                            key={skill.id}
                            style={{
                                ...styles.skillSlot,
                                position: `${SLOT_POSITIONS[index].x}px ${SLOT_POSITIONS[index].y}px 0px`,
                            }}
                            onmouseover={() => setHoveredSkill({ skill, index })}
                            onmouseout={() => setHoveredSkill(null)}
                            onactivate={() => handlePurchase(skill)}
                        >
                            {/* 槽位图片 */}
                            <Image
                                src={SLOT_IMAGES[index]}
                                style={{
                                    ...styles.slotImage,
                                    ...(!skill.purchased ? styles.slotDimmed : styles.slotBright),
                                }}
                            />

                            {/* 未购买遮罩 (暗淡) */}
                            {!skill.purchased && (
                                <Panel style={styles.dimmedOverlay} />
                            )}
                        </Panel>
                    ))}

                    {/* "全修"图标按钮 - 红金燃烧特效 */}
                    <Panel
                        style={styles.purchaseAllSlot}
                        onactivate={handlePurchaseAll}
                        onmouseover={() => setHoveredPurchaseAll(true)}
                        onmouseout={() => setHoveredPurchaseAll(false)}
                        className="BreathScale"
                    >
                        {/* 图标 + 燃烧效果 */}
                        <Image
                            src="file://{resources}/images/slot_quan_new2.png"
                            style={styles.slotImage}
                            className="BurningImage"
                        />
                    </Panel>

                    {/* 底部区域 - 费用显示 (动态 slotCost) */}
                    <Panel style={styles.costBar}>
                        <Label
                            text={`【 演 武 代 价 ：${slotCost} 灵石 / 式 】`}
                            style={styles.costTitle}
                        />
                    </Panel>

                    {/* 悬浮提示 - 暖玉琥珀风格 */}
                    {hoveredSkill && (
                        <Panel
                            style={{
                                ...styles.tooltip,
                                position: `${SLOT_POSITIONS[hoveredSkill.index].x + 60}px ${SLOT_POSITIONS[hoveredSkill.index].y - 20}px 0px`,
                            }}
                            className="JadeTooltip"
                        >
                            {/* 标题 */}
                            <Label text={hoveredSkill.skill.name} style={styles.tooltipTitle} />
                            {/* 分割线 */}
                            <Panel style={styles.tooltipDivider} />
                            {/* 描述 */}
                            <Label text={SKILL_DESC[hoveredSkill.skill.name] || ''} style={styles.tooltipDesc} />
                            {/* 数值 */}
                            <Panel style={styles.tooltipValueRow}>
                                <Label text={hoveredSkill.skill.stat} style={styles.tooltipValue} />
                                <Label text={` ${hoveredSkill.skill.bonus}`} style={styles.tooltipBonus} />
                            </Panel>
                        </Panel>
                    )}

                    {/* 全修按钮悬浮提示 */}
                    {hoveredPurchaseAll && (
                        <Panel
                            style={{
                                ...styles.tooltip,
                                position: '400px 30px 0px',
                            }}
                            className="JadeTooltip"
                        >
                            <Label text="一键全修" style={styles.tooltipTitle} />
                            <Panel style={styles.tooltipDivider} />
                            <Label
                                text={unpurchasedCount > 0
                                    ? `立即购买剩余 ${unpurchasedCount} 式`
                                    : '已全部购买'
                                }
                                style={styles.tooltipDesc}
                            />
                            {unpurchasedCount > 0 && (
                                <Panel style={styles.tooltipValueRow}>
                                    <Label text="总计 " style={styles.tooltipDesc} />
                                    <Label text={`${dynamicTotalCost}`} style={{ color: '#f5d76e', fontSize: '16px', fontWeight: 'bold' as const }} />
                                    <Label text=" 灵石" style={styles.tooltipDesc} />
                                </Panel>
                            )}
                        </Panel>
                    )}
                </Panel>
            </Panel>
        </Panel>
    );
};

const styles = {
    overlay: {
        width: '100%',
        height: '100%',
    },

    // 主包装器 - 水平布局 (NPC + 面板)
    merchantWrapper: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'bottom' as const,
        marginBottom: '0px',
        marginLeft: '150px',
    },

    // NPC肖像
    npcPortrait: {
        width: '350px',
        height: '500px',
    },

    // 玉面板容器
    panelContainer: {
        width: '680px',
        height: '420px',
    },

    // 背景图
    background: {
        width: '680px',
        height: '420px',
        position: '0px 30px 0px' as const,
    },

    // 标题
    title: {
        color: '#ffd700',
        fontSize: '22px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 10px #ffd700',
        horizontalAlign: 'center' as const,
        letterSpacing: '4px',
        position: '0px 85px 0px' as const,
        width: '100%',
        textAlign: 'center' as const,
    },

    // 技能槽位容器 - 点击区域和图片大小一致
    skillSlot: {
        width: '50px',
        height: '50px',
    },

    // 槽位图片 - 填满容器
    slotImage: {
        width: '100%',
        height: '100%',
    },

    // 槽位图片 - 绝对定位 (用于全修按钮)
    slotImageAbsolute: {
        width: '100%',
        height: '100%',
        position: '0px 0px 0px' as const,
    },

    // 未购买的槽位 (灰暗化)
    slotDimmed: {
        opacity: '0.4',
        saturation: '0.2',
        brightness: '0.6',
    },

    // 已购买的槽位 (原图亮度)
    slotBright: {
        opacity: '1.0',
        saturation: '1.0',
        brightness: '1.0',
    },

    // 未购买遮罩
    dimmedOverlay: {
        width: '100%',
        height: '100%',
        position: '0px 0px 0px' as const,
        border: '2px solid #445555',
        borderRadius: '6px',
        backgroundColor: 'rgba(15, 25, 25, 0.5)',
    },

    // 底部费用栏 - 置于面板内部
    costBar: {
        flowChildren: 'down' as const,
        position: '120px 315px 0px' as const,
        width: '400px',
        horizontalAlign: 'left' as const,
    },

    // 费用标题
    costTitle: {
        color: '#c9a861',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        letterSpacing: '2px',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
    },

    // 费用数值行
    costValueRow: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        marginTop: '2px',
    },

    // 费用数值
    costValue: {
        color: '#ffdd44',
        fontSize: '20px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #ffd700',
    },

    // 费用单位
    costUnit: {
        color: '#d4c4a8',
        fontSize: '16px',
        verticalAlign: 'bottom' as const,
        marginBottom: '1px',
    },

    // "全修"图标按钮 - 位于第二行右侧
    purchaseAllSlot: {
        width: '50px',
        height: '50px',
        position: '525px 220px 0px' as const,
        borderRadius: '6px',
    },

    // 全修按钮 (文字按钮)
    purchaseAllBtn: {
        backgroundColor: '#884422',
        border: '2px solid #ffaa66',
        borderRadius: '8px',
        padding: '8px 24px',
        verticalAlign: 'center' as const,
    },

    // 全修按钮文字
    purchaseAllText: {
        color: '#ffd700',
        fontSize: '28px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #ff8800',
    },

    // 悬浮提示 - 青玉风格
    tooltip: {
        flowChildren: 'down' as const,
        width: '130px',
        padding: '12px 16px',
        // 青绿玉色背景 + 金边
        backgroundColor: 'rgba(25, 50, 55, 0.95)',
        border: '1px solid #c9a861',
        borderRadius: '6px',
        // 青绿色光晕
        boxShadow: '0px 0px 12px 4px rgba(60, 120, 110, 0.35), inset 0px 0px 15px rgba(40, 80, 75, 0.25)',
    },
    tooltipTitle: {
        color: '#ffd780',
        fontSize: '18px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #c9a861',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        letterSpacing: '4px',
        marginBottom: '4px',
    },
    tooltipDivider: {
        width: '80%',
        height: '1px',
        backgroundColor: '#c9a861',
        horizontalAlign: 'center' as const,
        marginTop: '2px',
        marginBottom: '6px',
        opacity: '0.6',
    },
    tooltipDesc: {
        color: '#d4c4a8',
        fontSize: '12px',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        opacity: '0.85',
        marginBottom: '6px',
    },
    tooltipValueRow: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
    },
    tooltipValue: {
        color: '#66ff88',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 6px #44cc66',
    },
    tooltipBonus: {
        color: '#e8d8b8',
        fontSize: '14px',
    },

    // 浮动提示 - 显示在标题下方居中
    toast: {
        position: '240px 118px 0px' as const,
        width: '200px',
        padding: '10px 24px',
        backgroundColor: 'rgba(60, 20, 15, 0.92)',
        border: '1px solid #c9a861',
        borderRadius: '4px',
        boxShadow: '0px 0px 12px 3px rgba(180, 120, 60, 0.3)',
        horizontalAlign: 'center' as const,
    },
    toastText: {
        color: '#ff8866',
        fontSize: '15px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 6px #cc4422',
        textAlign: 'center' as const,
        horizontalAlign: 'center' as const,
        width: '100%',
        letterSpacing: '3px',
    },

    // NPC容器 - 包含对话气泡和胸像
    npcContainer: {
        flowChildren: 'down' as const,
        width: '350px',
        marginRight: '-40px',
    },

    // 气泡包装器 - 用于整体定位和动画
    speechBubbleWrapper: {
        flowChildren: 'down' as const,
        marginLeft: '140px',
        marginBottom: '-15px',
        horizontalAlign: 'center' as const,
    },

    // 商人对话气泡
    speechBubble: {
        width: '160px',
        padding: '8px 14px',
        backgroundColor: 'rgba(40, 30, 20, 0.92)',
        border: '1px solid #c9a861',
        borderRadius: '8px',
        boxShadow: '0px 0px 10px 2px rgba(180, 140, 80, 0.3)',
    },

    // 气泡小尾巴 - 倒三角
    speechTail: {
        width: '0px',
        height: '0px',
        marginLeft: '60px',
        marginTop: '-1px',
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '10px solid #c9a861',
    },

    speechText: {
        color: '#ffd080',
        fontSize: '13px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 4px #c9a861',
        textAlign: 'center' as const,
        horizontalAlign: 'center' as const,
        width: '100%',
        fontStyle: 'italic' as const,
    },

};

export default MerchantShopPanel;
