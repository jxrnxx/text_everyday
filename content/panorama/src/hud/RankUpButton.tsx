/**
 * RankUpButton.tsx
 * Glowing "境界突破" button that appears when player is at level cap
 */

import React, { useEffect, useState } from 'react';

// Rank data for display
const RANK_DATA: { [key: number]: { title: string; desc: string } } = {
    0: { title: '凡胎', desc: '肉眼凡胎，受困于世。' },
    1: { title: '觉醒', desc: '窥见真实，打破枷锁。' },
    2: { title: '宗师', desc: '技近乎道，登峰造极。' },
    3: { title: '半神', desc: '神性初显，超脱凡俗。' },
    4: { title: '神话', desc: '传颂之名，永恒不朽。' },
    5: { title: '禁忌', desc: '不可直视，不可名状。' },
};

const RankUpButton: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentRank, setCurrentRank] = useState(0);
    const [currentLevel, setCurrentLevel] = useState(1);
    const [maxLevel, setMaxLevel] = useState(10);
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    // Calculate max level for rank
    const getMaxLevelForRank = (rank: number) => (rank + 1) * 10;

    // Check if at level cap
    const checkLevelCap = () => {
        const localPlayer = Players.GetLocalPlayer();
        const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);
        
        if (heroIndex === -1) return;

        const level = Entities.GetLevel(heroIndex);
        
        // Get rank from NetTable
        const netTableData = CustomNetTables.GetTableValue('custom_stats' as any, String(heroIndex));
        const rank = netTableData ? (netTableData as any).rank || 0 : 0;
        
        const max = getMaxLevelForRank(rank);

        setCurrentLevel(level);
        setCurrentRank(rank);
        setMaxLevel(max);
        setIsVisible(level >= max && rank < 5); // Hide if max rank reached
    };

    useEffect(() => {
        // Initial check
        checkLevelCap();

        // Poll every 0.5 seconds
        const updateLoop = () => {
            checkLevelCap();
        };
        
        const interval = $.Schedule(0.5, function loop() {
            updateLoop();
            $.Schedule(0.5, loop);
        });

        // Listen for rank up result
        const rankUpListener = GameEvents.Subscribe('rank_up_result', (event: any) => {
            setIsProcessing(false);
            if (event.success) {
                setFeedbackMessage(event.message);
                Game.EmitSound('Hero_Juggernaut.OmniSlash.Arcana');
                // Clear message after 3 seconds
                $.Schedule(3.0, () => setFeedbackMessage(''));
            } else {
                setFeedbackMessage(event.message);
                Game.EmitSound('General.InvalidTarget');
                $.Schedule(2.0, () => setFeedbackMessage(''));
            }
        });

        // Listen for custom_stats updates
        const statsListener = CustomNetTables.SubscribeNetTableListener('custom_stats' as any, () => {
            checkLevelCap();
        });

        return () => {
            GameEvents.Unsubscribe(rankUpListener);
            CustomNetTables.UnsubscribeNetTableListener(statsListener);
        };
    }, []);

    const handleRankUp = () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        Game.EmitSound('ui_menu_activate');
        GameEvents.SendCustomGameEventToServer('cmd_attempt_rank_up', {});
    };

    // 暂时禁用境界突破按钮，只用经验条金色提醒
    // TODO: 后续可以用其他方式触发升阶
    return null;
    
    // 原来的显示逻辑
    // if (!isVisible) return null;

    const nextRankName = RANK_DATA[currentRank + 1]?.title || '???';
    
    // 测试升阶按钮 - 绕过检查
    const handleTestRankUp = () => {
        Game.EmitSound('ui_menu_activate');
        GameEvents.SendCustomGameEventToServer('cmd_test_rank_up', {});
    };

    return (
        <Panel style={styles.container}>
            {/* Glowing Button */}
            <Button
                onactivate={handleRankUp}
                style={{
                    ...styles.button,
                    ...(isProcessing ? styles.buttonDisabled : {}),
                }}
            >
                <Panel style={styles.glowEffect} />
                <Label text="境界突破" style={styles.buttonText} />
                <Label text={`晋升 ${nextRankName}`} style={styles.subText} />
            </Button>

            {/* Level Info */}
            <Label 
                text={`等级 ${currentLevel}/${maxLevel} (已达上限)`} 
                style={styles.levelInfo} 
            />
            
            {/* 测试按钮 - 绕过检查 */}
            <Button
                onactivate={handleTestRankUp}
                style={{
                    width: '120px',
                    height: '30px',
                    marginTop: '10px',
                    backgroundColor: '#444466',
                    borderRadius: '4px',
                }}
            >
                <Label text="[测试升阶]" style={{
                    color: '#aaaaff',
                    fontSize: '14px',
                    textAlign: 'center' as const,
                    horizontalAlign: 'center' as const,
                    verticalAlign: 'center' as const,
                }} />
            </Button>

            {/* Feedback Message */}
            {feedbackMessage && (
                <Label text={feedbackMessage} style={styles.feedback} />
            )}
        </Panel>
    );
};

const styles = {
    container: {
        flowChildren: 'down' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        position: '50% 40% 0px' as const,
        width: '300px',
    },
    button: {
        width: '200px',
        height: '60px',
        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#ffd700), to(#ff8c00))',
        borderRadius: '8px',
        boxShadow: '0px 0px 20px 5px #ffd70088',
        transition: 'transform 0.1s ease-in-out',
    },
    buttonDisabled: {
        opacity: '0.6',
        saturation: '0.5',
    },
    glowEffect: {
        width: '100%',
        height: '100%',
        position: '0px 0px 0px',
        backgroundColor: '#ffd70044',
        borderRadius: '8px',
        opacity: '0.5',
    },
    buttonText: {
        color: '#1a1a2e',
        fontSize: '24px',
        fontWeight: 'bold' as const,
        textAlign: 'center' as const,
        verticalAlign: 'center' as const,
        horizontalAlign: 'center' as const,
        textShadow: '0px 0px 5px #ffffff88',
    },
    subText: {
        color: '#2d2d44',
        fontSize: '14px',
        textAlign: 'center' as const,
        horizontalAlign: 'center' as const,
        marginTop: '2px',
    },
    levelInfo: {
        color: '#ffd700',
        fontSize: '16px',
        fontWeight: 'bold' as const,
        textAlign: 'center' as const,
        marginTop: '10px',
        textShadow: '0px 0px 3px #000000',
    },
    feedback: {
        color: '#ffffff',
        fontSize: '18px',
        fontWeight: 'bold' as const,
        textAlign: 'center' as const,
        marginTop: '15px',
        backgroundColor: '#000000aa',
        padding: '8px 16px',
        borderRadius: '4px',
    },
};

export default RankUpButton;
