import React, { useState, useEffect } from 'react';

const BAG_LENGTH = 32; // 背包格子数量
const BAG_LIST: number[] = [];
for (let i = 0; i < BAG_LENGTH; i++) {
    BAG_LIST.push(i + 1);
}

// 功能按钮配置
const BUTTON_LIST = [
    {
        name: '整理',
        id: 1,
        call: () => {
            GameEvents.SendCustomGameEventToServer('knapsack_tidy_up', {} as never);
        },
    },
    {
        name: '分解',
        id: 2,
        call: () => {
            GameEvents.SendCustomGameEventToServer('knapsack_decompose', {} as never);
        },
    },
    {
        name: '商店',
        id: 3,
        call: () => {
            // 打开商店
        },
    },
];

// 样式定义
const styles = {
    container: {
        flowChildren: 'down' as const,
        width: '300px',
        height: '300px',
        position: '1300px 450px 0px' as const,
    },
    header: {
        height: '46px',
        width: '100%',
        backgroundImage: 'url("file://{images}/custom_game/knapsack/top.png")',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        marginBottom: '-12px',
    },
    headerTitle: {
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        marginTop: '-4px',
        fontSize: '20px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 4px #000000',
        color: '#ffffff',
    },
    body: {
        height: '220px',
        width: '100%',
        backgroundImage: 'url("file://{images}/custom_game/knapsack/background.png")',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        backgroundColor: '#1a1a1a',
        flowChildren: 'right-wrap' as const,
        overflow: 'squish scroll' as const,
        padding: '0px 10px 0px 5px',
    },
    itemBox: {
        width: '70px',
        height: '50px',
        padding: '2px',
    },
    item: {
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        width: '95%',
        height: '95%',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        backgroundColor: 'rgba(0, 0, 0, 0.43)',
        border: '1px solid #494949',
    },
    itemButton: {
        height: '100%',
        width: '100%',
    },
    footer: {
        marginTop: '-24px',
        height: '53px',
        width: '100%',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        flowChildren: 'right' as const,
    },
    footerButton: {
        marginTop: '20px',
        width: '100px',
        height: '33px',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        textAlign: 'center' as const,
        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#373d45), to(#4d5860))',
        border: '1px solid #494949',
        textShadow: '0px 0px 4px #000000',
        color: '#ffffff',
        fontSize: '14px',
    },
    stackCount: {
        fontSize: '14px',
        horizontalAlign: 'right' as const,
        verticalAlign: 'bottom' as const,
        marginRight: '3px',
        marginBottom: '-2px',
        textShadow: '0px 0px 4px #000000',
        color: '#e0e0e0',
    },
};

// 物品格子组件
interface ItemCellProps {
    index: number;
    item: KnapsackItem | null;
    onUseItem: (index: number) => void;
    onDragStart: (index: number, panel: Panel, dragPanel: any) => boolean;
    onDragDrop: (index: number, panel: Panel, dragPanel: any) => void;
    onDragEnd: (panel: Panel, dragPanel: any) => void;
}

interface KnapsackItem {
    itemName: string;
    itemId: number;
    charges: number;
    stackable: boolean;
}

function ItemCell({ index, item, onUseItem, onDragStart, onDragDrop, onDragEnd }: ItemCellProps) {
    return (
        <Panel style={styles.itemBox}>
            <Panel style={styles.item}>
                <Button
                    style={styles.itemButton}
                    draggable={true}
                    onactivate={() => onUseItem(index)}
                    // @ts-ignore
                    onDragStart={(p: Panel, d: any) => onDragStart(index, p, d)}
                    // @ts-ignore
                    onDragDrop={(p: Panel, d: any) => onDragDrop(index, p, d)}
                    // @ts-ignore
                    onDragEnd={(p: Panel, d: any) => onDragEnd(p, d)}
                >
                    {item && (
                        <>
                            <DOTAItemImage
                                itemname={item.itemName}
                                style={{ width: '100%', height: '100%' }}
                            />
                            {item.stackable && item.charges > 1 && (
                                <Panel style={{ width: '100%', height: '35%', marginBottom: '-3px' }} hittest={false}>
                                    <Label style={styles.stackCount} text={String(item.charges)} />
                                </Panel>
                            )}
                        </>
                    )}
                </Button>
            </Panel>
        </Panel>
    );
}

// 主背包组件
export function KnapsackPanel() {
    const [isVisible, setIsVisible] = useState(false);
    const [items, setItems] = useState<(KnapsackItem | null)[]>([]);

    // 初始化物品数组
    useEffect(() => {
        const initItems: (KnapsackItem | null)[] = [];
        for (let i = 0; i < BAG_LENGTH; i++) {
            initItems.push(null);
        }
        setItems(initItems);
    }, []);

    // 检查英雄是否可以执行命令
    const isHeroCanCast = (): boolean => {
        const heroEntityIndex = Players.GetPlayerHeroEntityIndex(Game.GetLocalPlayerID());
        if (!Entities.IsAlive(heroEntityIndex)) {
            GameEvents.SendEventClientSide('dota_hud_error_message', {
                reason: 0,
                message: '死亡中...',
                sequenceNumber: 1,
            });
            return false;
        }
        if (Entities.IsStunned(heroEntityIndex)) {
            GameEvents.SendEventClientSide('dota_hud_error_message', {
                reason: 0,
                message: '眩晕中...',
                sequenceNumber: 1,
            });
            return false;
        }
        return true;
    };

    // 订阅NetTable更新
    useEffect(() => {
        const playerId = Players.GetLocalPlayer();

        // 初始加载数据
        const initialData = CustomNetTables.GetTableValue('knapsack', `player_${playerId}`);
        if (initialData) {
            updateItemsFromNetTable(initialData);
        }

        // 订阅更新
        const listenerId = CustomNetTables.SubscribeNetTableListener('knapsack', (_, key, value) => {
            if (key === `player_${playerId}` && value) {
                updateItemsFromNetTable(value);
            }
        });

        return () => {
            CustomNetTables.UnsubscribeNetTableListener(listenerId);
        };
    }, []);

    // 从NetTable数据更新物品列表
    const updateItemsFromNetTable = (data: any) => {
        const newItems: (KnapsackItem | null)[] = [];
        for (let i = 0; i < BAG_LENGTH; i++) {
            if (data[i.toString()]) {
                newItems.push(data[i.toString()]);
            } else {
                newItems.push(null);
            }
        }
        setItems(newItems);
    };

    // 使用ref存储切换函数
    const toggleVisibleRef = React.useRef<() => void>(() => { });
    toggleVisibleRef.current = () => setIsVisible(prev => !prev);

    // 暴露切换函数到全局
    useEffect(() => {
        (GameUI as any).ToggleKnapsack = () => {
            toggleVisibleRef.current();
        };
    }, []);

    // 使用物品
    const handleUseItem = (index: number) => {
        if (!isHeroCanCast()) return;
        if (!items[index]) return;

        GameEvents.SendCustomGameEventToServer('knapsack_use_item', {
            index: index,
            targetIndex: Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer()),
        } as never);
    };

    // 拖拽开始
    const handleDragStart = (index: number, panel: Panel, dragPanel: any): boolean => {
        if (!isHeroCanCast()) return false;
        if (!items[index]) return false;

        const item = items[index]!;
        let displayPanel: any = $.CreatePanel('DOTAItemImage', $.GetContextPanel(), 'dragImage');
        displayPanel.itemname = item.itemName;
        displayPanel.style.height = `${panel.contentheight * 1.05}px`;
        displayPanel.style.width = `${panel.contentwidth * 1.05}px`;
        displayPanel.b_dragComplete = false;
        displayPanel.itemIndex = index;

        dragPanel.offsetX = 0;
        dragPanel.offsetY = 0;
        dragPanel.displayPanel = displayPanel;
        panel.style.opacity = '0.1';

        return true;
    };

    // 拖拽放下
    const handleDragDrop = (index: number, _panel: Panel, dragPanel: any) => {
        if (dragPanel.itemIndex !== index) {
            dragPanel.b_dragComplete = true;
            GameEvents.SendCustomGameEventToServer('knapsack_swap_item', {
                index_in: dragPanel.itemIndex,
                index_out: index,
            } as never);
        }
    };

    // 拖拽结束
    const handleDragEnd = (panel: Panel, dragPanel: any) => {
        dragPanel.displayPanel?.DeleteAsync(0);
        panel.style.opacity = '1';

        if (dragPanel.b_dragComplete) return;

        // 丢弃到地面
        $.Schedule(0.01, () => {
            const pos = GameUI.GetCursorPosition();
            const worldPosition = GameUI.GetScreenWorldPosition(pos);

            if (worldPosition) {
                const queryUnit = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
                const isValidHero = Entities.IsControllableByPlayer(queryUnit, Players.GetLocalPlayer()) &&
                    Entities.IsHero(queryUnit) &&
                    !Entities.IsIllusion(queryUnit);

                if (isValidHero) {
                    GameEvents.SendCustomGameEventToServer('knapsack_drop_item', {
                        index: dragPanel.itemIndex,
                        position: worldPosition,
                    } as never);
                }
            }
        });
    };

    // 功能按钮点击
    const handleButtonClick = (buttonId: number) => {
        const button = BUTTON_LIST.find(b => b.id === buttonId);
        if (button) {
            button.call();
        }
    };

    if (!isVisible) return null;

    return (
        <Panel style={styles.container}>
            {/* 标题栏 */}
            <Panel style={styles.header} draggable={true}>
                <Label style={styles.headerTitle} text="背包" />
            </Panel>

            {/* 物品格子区域 */}
            <Panel style={styles.body}>
                {BAG_LIST.map((_, index) => (
                    <ItemCell
                        key={index}
                        index={index}
                        item={items[index]}
                        onUseItem={handleUseItem}
                        onDragStart={handleDragStart}
                        onDragDrop={handleDragDrop}
                        onDragEnd={handleDragEnd}
                    />
                ))}
            </Panel>

            {/* 底部按钮区域 */}
            <Panel style={styles.footer}>
                {BUTTON_LIST.map(button => (
                    <Label
                        key={button.id}
                        style={styles.footerButton}
                        text={button.name}
                        onactivate={() => handleButtonClick(button.id)}
                    />
                ))}
            </Panel>
        </Panel>
    );
}
