/**
 * MerchantPanel.tsx
 * Cultivation Shop UI with tier-locked breakthrough functionality
 */

import React, { useEffect, useState, useRef } from 'react';
import { openPanel, markPanelClosed, registerPanel, isAnyPanelOpen } from './PanelManager';

interface ShopSlot {
    id: number;
    name: string;
    purchased: boolean;
}

const MerchantPanel: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [shopId, setShopId] = useState(0);
    const [currentTier, setCurrentTier] = useState(1);
    const [slotsPurchased, setSlotsPurchased] = useState(0);
    const [currentRank, setCurrentRank] = useState(0);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    // 第一层技能 (Tier 1) - 基础生存与输出
    const [slots, setSlots] = useState<ShopSlot[]>([
        { id: 1, name: '根骨', purchased: false },      // +5 根骨 → +250 HP, +2.5 HP/秒
        { id: 2, name: '武道', purchased: false },      // +5 武道 → +10 攻击力
        { id: 3, name: '神念', purchased: false },      // +5 神念 → +10 攻击力(法系)
        { id: 4, name: '攻速', purchased: false },      // +5 攻速
        { id: 5, name: '内息', purchased: false },      // +2 法力回复/秒
        { id: 6, name: '护甲', purchased: false },      // +2 护甲
        { id: 7, name: '法力', purchased: false },      // +20 最大法力
        { id: 8, name: '吸血', purchased: false },      // +2% 吸血
    ]);

    // Calculate max tier for rank
    const getMaxTierForRank = (rank: number) => rank + 2;

    // Check if breakthrough is possible
    const canBreakthrough = () => {
        const maxTier = getMaxTierForRank(currentRank);
        const nextTier = currentTier + 1;
        
        if (nextTier > maxTier) {
            return { allowed: false, reason: '需提升阶位' };
        }
        
        if (slotsPurchased < 8) {
            return { allowed: false, reason: `需购买全部槽位 (${slotsPurchased}/8)` };
        }
        
        return { allowed: true, reason: '' };
    };

    // Refresh player stats
    const refreshStats = () => {
        const localPlayer = Players.GetLocalPlayer();
        const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);
        
        if (heroIndex === -1) return;

        const netTableData = CustomNetTables.GetTableValue('custom_stats' as any, String(heroIndex));
        if (netTableData) {
            setCurrentRank((netTableData as any).rank || 0);
        }
    };

    // 面板引用，用于右键关闭
    const panelRef = useRef<Panel | null>(null);
    
    // 内部关闭函数
    const closeInternal = () => {
        setIsVisible(false);
        Game.EmitSound('Shop.PanelDown');
    };
    
    useEffect(() => {
        // 注册到 PanelManager
        registerPanel('merchant_panel', closeInternal);
        
        // Listen for open panel event
        const openListener = GameEvents.Subscribe('open_merchant_panel', (event: any) => {
            openPanel('merchant_panel'); // 这会自动关闭其他面板
            setIsVisible(true);
            setShopId(event.shop_id);
            refreshStats();
            Game.EmitSound('Shop.PanelUp');
        });

        // Listen for breakthrough result
        const breakthroughListener = GameEvents.Subscribe('breakthrough_result', (event: any) => {
            if (event.success) {
                setCurrentTier(event.new_tier);
                setSlotsPurchased(0);
                // Reset slot purchases for new tier
                setSlots(slots.map(s => ({ ...s, purchased: false })));
                setFeedbackMessage(event.message);
                Game.EmitSound('Hero_Invoker.LevelUp');
            } else {
                setFeedbackMessage(event.message);
                Game.EmitSound('General.InvalidTarget');
            }
            $.Schedule(2.0, () => setFeedbackMessage(''));
        });

        // Listen for stats updates
        const statsListener = CustomNetTables.SubscribeNetTableListener('custom_stats' as any, () => {
            refreshStats();
        });

        return () => {
            GameEvents.Unsubscribe(openListener);
            GameEvents.Unsubscribe(breakthroughListener);
            CustomNetTables.UnsubscribeNetTableListener(statsListener);
        };
    }, []);

    const handleClose = () => {
        closeInternal();
        markPanelClosed('merchant_panel');
    };
    
    // 右键关闭处理
    const handleRightClick = () => {
        handleClose();
        return true; // 阻止默认行为
    };

    const handleSlotPurchase = (slotId: number) => {
        // TODO: Implement actual purchase logic with currency check
        const slot = slots.find(s => s.id === slotId);
        if (!slot || slot.purchased) return;

        setSlots(slots.map(s => 
            s.id === slotId ? { ...s, purchased: true } : s
        ));
        setSlotsPurchased(prev => prev + 1);
        Game.EmitSound('General.Buy');
    };

    const handleBreakthrough = () => {
        const check = canBreakthrough();
        if (!check.allowed) {
            setFeedbackMessage(check.reason);
            Game.EmitSound('General.InvalidTarget');
            $.Schedule(2.0, () => setFeedbackMessage(''));
            return;
        }

        GameEvents.SendCustomGameEventToServer('cmd_request_breakthrough', {
            target_tier: currentTier + 1,
        });
    };

    if (!isVisible) return null;

    const breakthroughStatus = canBreakthrough();
    const maxTier = getMaxTierForRank(currentRank);

    return (
        <Panel 
            style={styles.overlay}
            // @ts-ignore
            oncontextmenu={handleRightClick}
        >
            <Panel style={styles.panel}>
                {/* Header */}
                <Panel style={styles.header}>
                    <Label text={`修炼室 #${shopId}`} style={styles.title} />
                    <Label text={`境界 Tier ${currentTier}`} style={styles.tierLabel} />
                    <Button onactivate={handleClose} style={styles.closeButton}>
                        <Label text="✕" style={styles.closeText} />
                    </Button>
                </Panel>

                {/* Stats Info */}
                <Panel style={styles.infoRow}>
                    <Label text={`当前阶位: ${currentRank}`} style={styles.infoLabel} />
                    <Label text={`最大境界: Tier ${maxTier}`} style={styles.infoLabel} />
                </Panel>

                {/* Slot Grid */}
                <Panel style={styles.slotGrid}>
                    {slots.map(slot => (
                        <Button
                            key={slot.id}
                            onactivate={() => handleSlotPurchase(slot.id)}
                            style={{
                                ...styles.slot,
                                ...(slot.purchased ? styles.slotPurchased : {}),
                            }}
                        >
                            <Label text={slot.name} style={styles.slotText} />
                            <Label 
                                text={slot.purchased ? '✓' : '100金'} 
                                style={slot.purchased ? styles.slotCheckmark : styles.slotPrice} 
                            />
                        </Button>
                    ))}
                </Panel>

                {/* Progress */}
                <Label 
                    text={`已购买: ${slotsPurchased}/8`} 
                    style={styles.progressLabel} 
                />

                {/* Breakthrough Button */}
                <Panel style={styles.breakSection}>
                    <Button
                        onactivate={handleBreakthrough}
                        style={{
                            ...styles.breakthroughButton,
                            ...(breakthroughStatus.allowed ? {} : styles.breakthroughDisabled),
                        }}
                    >
                        <Label 
                            text={breakthroughStatus.allowed ? '突破' : breakthroughStatus.reason} 
                            style={styles.breakthroughText} 
                        />
                    </Button>
                </Panel>

                {/* Feedback */}
                {feedbackMessage && (
                    <Label text={feedbackMessage} style={styles.feedback} />
                )}
            </Panel>
        </Panel>
    );
};

const styles = {
    overlay: {
        width: '100%',
        height: '100%',
        backgroundColor: '#00000088',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    },
    panel: {
        width: '500px',
        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#1a1a2e), to(#16213e))',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0px 0px 30px 10px #00000088',
        flowChildren: 'down' as const,
    },
    header: {
        flowChildren: 'right' as const,
        width: '100%',
        marginBottom: '15px',
    },
    title: {
        color: '#ffd700',
        fontSize: '24px',
        fontWeight: 'bold' as const,
        width: '50%',
    },
    tierLabel: {
        color: '#88ccff',
        fontSize: '18px',
        width: '30%',
        textAlign: 'center' as const,
    },
    closeButton: {
        width: '30px',
        height: '30px',
        backgroundColor: '#ff4444',
        borderRadius: '4px',
        horizontalAlign: 'right' as const,
    },
    closeText: {
        color: '#ffffff',
        fontSize: '16px',
        textAlign: 'center' as const,
        verticalAlign: 'center' as const,
    },
    infoRow: {
        flowChildren: 'right' as const,
        width: '100%',
        marginBottom: '15px',
    },
    infoLabel: {
        color: '#aaaaaa',
        fontSize: '14px',
        width: '50%',
    },
    slotGrid: {
        flowChildren: 'right-wrap' as const,
        width: '100%',
        marginBottom: '15px',
    },
    slot: {
        width: '110px',
        height: '80px',
        backgroundColor: '#2d2d44',
        borderRadius: '8px',
        margin: '5px',
        flowChildren: 'down' as const,
        padding: '10px',
    },
    slotPurchased: {
        backgroundColor: '#2e5731',
        border: '2px solid #4caf50',
    },
    slotText: {
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: 'bold' as const,
        horizontalAlign: 'center' as const,
    },
    slotPrice: {
        color: '#ffd700',
        fontSize: '12px',
        horizontalAlign: 'center' as const,
        marginTop: '5px',
    },
    slotCheckmark: {
        color: '#4caf50',
        fontSize: '18px',
        horizontalAlign: 'center' as const,
        marginTop: '5px',
    },
    progressLabel: {
        color: '#88ccff',
        fontSize: '16px',
        textAlign: 'center' as const,
        marginBottom: '15px',
    },
    breakSection: {
        horizontalAlign: 'center' as const,
        marginTop: '10px',
    },
    breakthroughButton: {
        width: '200px',
        height: '50px',
        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#4caf50), to(#2e7d32))',
        borderRadius: '8px',
        boxShadow: '0px 0px 10px 3px #4caf5066',
    },
    breakthroughDisabled: {
        backgroundColor: '#555555',
        boxShadow: 'none',
        opacity: '0.7',
    },
    breakthroughText: {
        color: '#ffffff',
        fontSize: '18px',
        fontWeight: 'bold' as const,
        textAlign: 'center' as const,
        verticalAlign: 'center' as const,
        horizontalAlign: 'center' as const,
    },
    feedback: {
        color: '#ffffff',
        fontSize: '16px',
        textAlign: 'center' as const,
        marginTop: '15px',
        backgroundColor: '#000000aa',
        padding: '8px 16px',
        borderRadius: '4px',
    },
};

export default MerchantPanel;
