/**
 * AbilityShopPanel.tsx
 * 技能商人面板
 * 
 * 布局: NPC肖像(左) + 玉面板(右)
 * 与 MerchantShopPanel 布局一致
 */

import React, { useEffect, useState } from 'react';
import { openPanel, markPanelClosed, registerPanel } from './PanelManager';

const AbilityShopPanel: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<number | null>(null);

    // 商品位置配置 (4+4 布局)
    const ITEM_POSITIONS = [
        // 第一行 4个 (功能道具)
        { x: 155, y: 152 },
        { x: 255, y: 152 },
        { x: 355, y: 152 },
        { x: 455, y: 152 },
        // 第二行 4个 (强化石)
        { x: 155, y: 252 },
        { x: 255, y: 252 },
        { x: 355, y: 252 },
        { x: 455, y: 252 },
    ];

    // 商品配置 (8个商品)
    const shopItems = [
        // === 第一行：功能道具 ===
        {
            id: 1,
            name: '演武残卷',
            desc: '天地为台，众生为戏。\n随机获得1星(90%)/2星(9%)/4星(1%)技能书。',
            icon: 'file://{resources}/images/custom_items/skill_book_blue.png',
            price: 500,
            currency: '信仰',
        },
        {
            id: 2,
            name: '问道签',
            desc: '大道三千，弱水三千。\n选择[武道]/[神念]/[被动]，必得指定类型技能书。',
            icon: 'file://{images}/custom_game/hud/skill_fortune_sticks.png',
            price: 1000,
            currency: '信仰',
        },
        {
            id: 3,
            name: '衍法灵笺',
            desc: '法无定法，式无定式。\n将技能随机变为同星级的另一个技能。',
            icon: 'file://{resources}/images/custom_items/derivation_paper.png',
            price: 1000,
            currency: '信仰',
        },
        {
            id: 4,
            name: '空白拓本',
            desc: '前尘影事，皆可拓印。\n将已学技能剥离，变回技能书放入背包。',
            icon: 'file://{resources}/images/custom_items/blank_rubbing.png',
            price: 2000,
            currency: '信仰',
        },
        // === 第二行：强化石 ===
        {
            id: 5,
            name: '悟道石·凡',
            desc: '初窥门径，略有所得。\n将1级技能强化至2级。',
            icon: 'file://{resources}/images/custom_items/upgrade_stone_white.png',
            price: 1000,
            currency: '信仰',
        },
        {
            id: 6,
            name: '悟道石·灵',
            desc: '灵光一闪，融会贯通。\n将2级技能强化至3级。',
            icon: 'file://{resources}/images/custom_items/upgrade_stone_green.png',
            price: 3000,
            currency: '信仰',
        },
        {
            id: 7,
            name: '悟道石·仙',
            desc: '羽化登仙，超脱凡俗。\n将3级技能强化至4级(满级)。',
            icon: 'file://{resources}/images/custom_items/upgrade_stone_purple.png',
            price: 8000,
            currency: '信仰',
        },
        {
            id: 8,
            name: '武道石·神',
            desc: '神恩如海，神威如狱。\n强化4星技能或突破等级上限。',
            icon: 'file://{resources}/images/custom_items/upgrade_stone_gold.png',
            price: 20000,
            currency: '信仰',
        },
    ];

    // Toast 消息状态
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = React.useRef<number>(0);

    // 玩家信仰值
    const [playerFaith, setPlayerFaith] = useState(0);

    // 显示浮动提示
    const showToast = (message: string) => {
        toastTimerRef.current += 1;
        const currentTimer = toastTimerRef.current;

        setToastMessage(message);
        $.Schedule(1.7, () => {
            if (toastTimerRef.current === currentTimer) {
                setToastMessage(null);
            }
        });
    };

    // 订阅信仰值更新
    useEffect(() => {
        const localPlayer = Players.GetLocalPlayer();
        $.Msg(`[AbilityShop] 初始化信仰订阅, 玩家: ${localPlayer}`);

        const updateFaith = () => {
            const economyData = CustomNetTables.GetTableValue('economy', `player_${localPlayer}` as any) as any;
            $.Msg(`[AbilityShop] 读取经济数据: faith=${economyData?.faith}`);
            if (economyData && economyData.faith !== undefined) {
                setPlayerFaith(economyData.faith);
            }
        };

        // 初始读取
        updateFaith();

        // 订阅更新
        const listener = CustomNetTables.SubscribeNetTableListener('economy' as any, updateFaith);
        return () => {
            CustomNetTables.UnsubscribeNetTableListener(listener);
        };
    }, []);

    // handleClose 引用
    const handleCloseRef = React.useRef<() => void>(() => { });

    // 标记循环是否已启动
    const loopStartedRef = React.useRef(false);

    // 使用 ref 跟踪 isVisible 状态
    const isVisibleRef = React.useRef(isVisible);
    isVisibleRef.current = isVisible;

    // 检测点击商人打开面板 + 右键关闭 + 选中英雄关闭
    useEffect(() => {
        // 仅在首次挂载时启动循环
        if (loopStartedRef.current) return;
        loopStartedRef.current = true;

        // 注册到 PanelManager
        registerPanel('ability_panel', () => {
            setIsVisible(false);
            Game.EmitSound('Shop.PanelDown');
        });

        const checkMerchantClick = () => {
            const selectedEntity = Players.GetLocalPlayerPortraitUnit();
            const localPlayer = Players.GetLocalPlayer();
            const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);

            if (selectedEntity === -1) return;

            const unitName = Entities.GetUnitName(selectedEntity);
            const isMerchant = unitName === 'npc_ability_merchant';
            const isOwnHero = selectedEntity === heroIndex;

            // 打开逻辑: 商人被选中且面板不可见
            if (isMerchant && !isVisibleRef.current) {
                openPanel('ability_panel');
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
            $.Schedule(0.1, loop);
        });
    }, []);

    // ESC 键关闭
    useEffect(() => {
        if (isVisible) {
            $.RegisterKeyBind($.GetContextPanel(), 'key_escape', () => {
                handleCloseRef.current();
            });
        }
    }, [isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        Game.EmitSound('Shop.PanelDown');
        markPanelClosed('ability_panel');

        // 强制选中玩家英雄
        const localPlayer = Players.GetLocalPlayer();
        const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);
        if (heroIndex !== -1) {
            GameUI.SelectUnit(heroIndex, false);
        }
    };

    const handlePurchase = (item: typeof shopItems[0]) => {
        // 调试: 显示当前信仰值
        $.Msg(`[AbilityShop] 购买尝试: ${item.name}, 价格: ${item.price}, 当前信仰: ${playerFaith}`);

        // 检查信仰值余额
        if (playerFaith < item.price) {
            Game.EmitSound('General.CastFail_NoMana');
            showToast(`信仰不足，需要 ${item.price}信仰`);
            $.Msg(`[AbilityShop] 信仰不足，阻止购买`);
            return;
        }

        // 发送购买事件到服务端
        GameEvents.SendCustomGameEventToServer('cmd_ability_shop_purchase', {
            item_id: item.id,
            item_name: item.name,
            price: item.price,
            currency: item.currency,
        } as never);

        // 购买成功音效
        Game.EmitSound('General.Buy');
    };

    // 更新 handleCloseRef
    handleCloseRef.current = handleClose;

    if (!isVisible) return null;

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
                        src="file://{resources}/images/shop_02.png"
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

                    {/* 标题 */}
                    <Label
                        text="技能商人"
                        style={styles.title}
                    />

                    {/* 商品槽位 - 绝对定位 */}
                    {shopItems.map((item, index) => (
                        <Panel
                            key={item.id}
                            style={{
                                ...styles.itemSlot,
                                position: `${ITEM_POSITIONS[index].x}px ${ITEM_POSITIONS[index].y}px 0px`,
                            }}
                            onmouseover={() => setHoveredItem(index)}
                            onmouseout={() => setHoveredItem(null)}
                            onactivate={() => handlePurchase(item)}
                        >
                            {/* 边框背景 */}
                            <Image
                                src="file://{resources}/images/custom_items/slot_frame_magic.png"
                                style={styles.slotFrame}
                            />
                            {/* 商品图标 */}
                            <Image src={item.icon} style={styles.itemIcon} />
                        </Panel>
                    ))}

                    {/* 价格标签 - 单独绝对定位在槽位下方 */}
                    {shopItems.map((item, index) => (
                        <Label
                            key={`price-${item.id}`}
                            text={`${item.price} 信仰`}
                            style={{
                                ...styles.priceLabel,
                                position: `${ITEM_POSITIONS[index].x - 310}px ${ITEM_POSITIONS[index].y + 65}px 0px`,
                            }}
                        />
                    ))}

                    {/* 悬浮提示 */}
                    {hoveredItem !== null && (
                        <Panel
                            style={{
                                ...styles.tooltip,
                                position: `${ITEM_POSITIONS[hoveredItem].x + 60}px ${ITEM_POSITIONS[hoveredItem].y - 30}px 0px`,
                            }}
                            className="JadeTooltip"
                        >
                            <Label text={shopItems[hoveredItem].name} style={styles.tooltipTitle} />
                            <Panel style={styles.tooltipDivider} />
                            <Label text={shopItems[hoveredItem].desc} style={styles.tooltipDesc} />
                            <Panel style={styles.tooltipPriceRow}>
                                <Label text={`${shopItems[hoveredItem].price}`} style={styles.tooltipPrice} />
                                <Label text={` ${shopItems[hoveredItem].currency}`} style={styles.tooltipCurrency} />
                            </Panel>
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

    // 主包装器 - 水平布局 (NPC + 面板) - 与修炼商人一致
    merchantWrapper: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'bottom' as const,
        marginBottom: '0px',
        marginLeft: '150px',
    },

    // NPC容器 - 固定高度 (与修炼商人一致)
    npcContainer: {
        width: '410px',
        height: '500px',
        marginRight: '-110px',
        paddingTop: '-45px',
    },

    // NPC肖像
    npcPortrait: {
        width: '410px',
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

    // 标题 - 居中在面板内
    title: {
        color: '#ffd700',
        fontSize: '22px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 10px #ffd700',
        horizontalAlign: 'center' as const,
        letterSpacing: '4px',
        position: '0px 60px 0px' as const,
        width: '100%',
        textAlign: 'center' as const,
    },

    // 商品槽位容器 - 匹配边框大小
    itemSlot: {
        width: '60px',
        height: '60px',
    },

    // 边框背景图 - 填满容器
    slotFrame: {
        width: '60px',
        height: '60px',
        position: '0px 0px 0px' as const,
    },

    // 商品图标 - 居中在边框内
    itemIcon: {
        width: '52px',
        height: '52px',
        position: '4px 4px 0px' as const,
        imgShadow: 'none' as const,
    },

    // 价格标签 - 绝对定位在槽位下方
    priceLabel: {
        color: '#f0d090',
        fontSize: '13px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 4px #c9a861, 1px 1px 2px #000000',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '120px',
        whiteSpace: 'nowrap' as const,
    },

    // 悬浮提示
    tooltip: {
        flowChildren: 'down' as const,
        width: '150px',
        padding: '10px 14px',
        backgroundColor: 'rgba(25, 50, 55, 0.95)',
        border: '1px solid #c9a861',
        borderRadius: '6px',
        boxShadow: '0px 0px 12px 4px rgba(60, 120, 110, 0.35)',
    },

    tooltipTitle: {
        color: '#ffd780',
        fontSize: '15px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #c9a861',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
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
        fontSize: '11px',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        opacity: '0.85',
        marginBottom: '6px',
    },

    tooltipPriceRow: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        marginTop: '4px',
    },

    tooltipPrice: {
        color: '#ff8844',
        fontSize: '14px',
        fontWeight: 'bold' as const,
    },

    tooltipCurrency: {
        color: '#d4c4a8',
        fontSize: '12px',
    },

    // 对话气泡样式
    speechBubbleWrapper: {
        position: '80px -60px 0px' as const,
        flowChildren: 'down' as const,
        horizontalAlign: 'center' as const,
    },

    speechBubble: {
        backgroundColor: 'rgba(20, 35, 35, 0.95)',
        border: '2px solid #c9a861',
        borderRadius: '8px',
        padding: '10px 16px',
        boxShadow: '0px 0px 12px rgba(201, 168, 97, 0.3)',
    },

    speechText: {
        color: '#ffd780',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 6px #c9a861',
        whiteSpace: 'nowrap' as const,
    },

    speechTail: {
        width: '0px',
        height: '0px',
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '10px solid #c9a861',
        horizontalAlign: 'center' as const,
        marginTop: '-1px',
    },
};

export default AbilityShopPanel;


