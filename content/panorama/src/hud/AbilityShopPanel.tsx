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

    // 更新 handleCloseRef
    handleCloseRef.current = handleClose;

    if (!isVisible) return null;

    return (
        <Panel style={styles.overlay} hittest={false} hittestchildren={true}>
            {/* 主包装容器 - NPC肖像 + 玉面板 */}
            <Panel style={styles.merchantWrapper}>

                {/* NPC肖像区域 */}
                <Panel style={styles.npcContainer}>
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
        marginLeft: '150px',  // 与修炼商人一致
    },

    // NPC容器 - 固定高度 (与修炼商人一致)
    npcContainer: {
        width: '410px',
        height: '500px',
        marginRight: '-110px',  // 往右靠近背景栏
        paddingTop: '-45px',  // 往上调整
    },

    // NPC肖像
    npcPortrait: {
        width: '410px',
        height: '500px',  // 与修炼商人一致
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
};

export default AbilityShopPanel;
