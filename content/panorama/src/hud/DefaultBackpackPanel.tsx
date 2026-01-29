import React, { useState, useEffect } from 'react';
import { getItemConfig, getRarityFrame } from './itemRarityConfig';

// 背包配置
const PUBLIC_STORAGE_COLS = 8;
const PUBLIC_STORAGE_ROWS = 2;
const PUBLIC_STORAGE_SIZE = PUBLIC_STORAGE_COLS * PUBLIC_STORAGE_ROWS; // 16格

const PRIVATE_BAG_COLS = 8;
const PRIVATE_BAG_ROWS = 5;
const PRIVATE_BAG_SIZE = PRIVATE_BAG_COLS * PRIVATE_BAG_ROWS; // 40格

const CELL_SIZE = 48;
const CELL_GAP = 2;

const CELL_TOTAL = CELL_SIZE + CELL_GAP * 2;
const GRID_INNER_WIDTH = PUBLIC_STORAGE_COLS * CELL_TOTAL; // 416px
const PANEL_WIDTH = GRID_INNER_WIDTH + 32; // 448px
const TAB_WIDTH = 40; // 手柄宽度

// 物品接口
interface BackpackItem {
    itemName: string;
    itemId: number;
    charges: number;
    stackable: boolean;
}

// 样式定义 - 墨玉(Dark Jade)主题
const styles = {
    // ===== 包装容器 - 打开状态 =====
    wrapperOpen: {
        flowChildren: 'right' as const,
        position: '1230px 330px 0px' as const,
        transform: 'translateX(0px)',
        transitionProperty: 'transform',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
    },

    // ===== 包装容器 - 关闭状态 =====
    wrapperClosed: {
        flowChildren: 'right' as const,
        position: '1230px 330px 0px' as const,
        transform: `translateX(${PANEL_WIDTH}px)`,
        transitionProperty: 'transform',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
    },

    // ===== 手柄 - 可见状态 =====
    toggleTabVisible: {
        width: `${TAB_WIDTH}px`,
        height: '120px',
        marginRight: '-2px',
        verticalAlign: 'center' as const,
        backgroundImage: 'url("file://{images}/custom_game/hud/handle_tab_left.png")',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        backgroundColor: 'transparent',
        border: '0px',
        boxShadow: 'none',
        opacity: '1.0',
        transitionProperty: 'opacity',
        transitionDuration: '0.2s',
    },

    // ===== 手柄 - 隐藏状态 =====
    toggleTabHidden: {
        width: `${TAB_WIDTH}px`,
        height: '120px',
        marginRight: '-2px',
        verticalAlign: 'center' as const,
        backgroundImage: 'url("file://{images}/custom_game/hud/handle_tab_left.png")',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        backgroundColor: 'transparent',
        border: '0px',
        boxShadow: 'none',
        opacity: '0.0',
        transitionProperty: 'opacity',
        transitionDuration: '0.2s',
    },

    // ===== 外层总框 =====
    outerFrame: {
        width: `${PANEL_WIDTH}px`,
        height: '500px',
        padding: '6px',
        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#002a32ee), to(#00080add))',
        border: '2px solid #b8860b',
        borderRadius: '4px',
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.6)',
    },

    // ===== 内层容器 =====
    innerContainer: {
        flowChildren: 'down' as const,
        width: '100%',
        height: '100%',
    },

    // ===== 单个仓库区域 =====
    storageSection: {
        flowChildren: 'down' as const,
        width: '100%',
        marginBottom: '4px',
    },

    // 标题栏容器
    sectionTitleBar: {
        width: '100%',
        height: '32px',
        backgroundColor: 'gradient(linear, 0% 0%, 100% 0%, from(#00000000), color-stop(0.5, #b8860b44), to(#00000000))',
        border: '1px solid rgba(184, 134, 11, 0.3)',
        borderRadius: '2px',
        flowChildren: 'right' as const,
    },

    // 标题文字容器
    sectionTitleWrapper: {
        flowChildren: 'down' as const,
        width: '370px',
        height: '100%',
        padding: '5px 0px 0px 0px',
        marginLeft: '25px',
    },

    // 标题文字
    sectionTitle: {
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        letterSpacing: '5px',
        textShadow: '0px 1px 3px rgba(0, 0, 0, 0.8)',
        color: '#f0e68c',
    },

    // 标题横线
    titleUnderline: {
        width: '70%',
        height: '1px',
        horizontalAlign: 'center' as const,
        marginTop: '2px',
        backgroundColor: 'gradient(linear, 0% 50%, 100% 50%, from(rgba(184, 134, 11, 0)), color-stop(0.3, rgba(218, 165, 32, 0.6)), color-stop(0.5, rgba(255, 215, 0, 0.8)), color-stop(0.7, rgba(218, 165, 32, 0.6)), to(rgba(184, 134, 11, 0)))',
    },

    // ===== 内部关闭按钮 - 优雅箭头样式 =====
    internalCloseBtn: {
        width: '36px',
        height: '24px',
        horizontalAlign: 'right' as const,
        verticalAlign: 'center' as const,
        marginRight: '4px',
        backgroundColor: '#00202888',
        border: '1px solid #b8860b55',
        borderRadius: '3px',
    },

    closeBtnArrow: {
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
        height: '100%',
        fontSize: '20px',
        fontWeight: 'bold' as const,
        color: '#b8860b',
        textShadow: '0px 1px 1px #000000',
    },

    // 格子区域框
    gridFrame: {
        width: `${GRID_INNER_WIDTH + 12}px`,
        marginTop: '3px',
        backgroundColor: '#001a1fcc',
        border: '1px solid #2f4f4f',
        borderRadius: '2px',
        padding: '4px',
        boxShadow: 'inset 0px 1px 4px rgba(0, 0, 0, 0.5)',
        horizontalAlign: 'center' as const,
    },

    // 格子容器
    gridContainer: {
        width: `${GRID_INNER_WIDTH}px`,
        flowChildren: 'right-wrap' as const,
    },

    // 单个物品格子 - 默认状态
    itemCell: {
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        margin: `${CELL_GAP}px`,
        backgroundColor: '#00000088',
        border: '1px solid #454545',
        borderRadius: '3px',
        boxShadow: 'inset 0px 0px 8px #000000',
        transitionProperty: 'border, box-shadow, background-color',
        transitionDuration: '0.15s',
    },

    // 单个物品格子 - 悬停状态
    itemCellHover: {
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        margin: `${CELL_GAP}px`,
        backgroundColor: '#001a2288',
        border: '1px solid #b8860b',
        borderRadius: '3px',
        boxShadow: 'inset 0px 0px 12px #00000088, 0px 0px 8px #b8860b44',
        transitionProperty: 'border, box-shadow, background-color',
        transitionDuration: '0.15s',
    },

    // 格子内按钮
    itemButton: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        border: '0px',
    },

    // 物品堆叠数量
    stackCount: {
        fontSize: '12px',
        horizontalAlign: 'right' as const,
        verticalAlign: 'bottom' as const,
        marginRight: '2px',
        marginBottom: '0px',
        textShadow: '0px 0px 3px #000000',
        color: '#e0e0e0',
        fontWeight: 'bold' as const,
    },

    // ===== 底部按钮区域 =====
    buttonBar: {
        width: `${GRID_INNER_WIDTH + 12}px`,
        height: '55px',
        marginTop: '4px',
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        backgroundColor: 'transparent',
    },

    // 按钮图片样式
    buttonImage: {
        backgroundImage: 'url("file://{images}/custom_game/hud/backpack_button_jade.png")',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        borderRadius: '4px',
        border: '1px solid #b8860b',
        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.4)',
    },

    // 按钮文字
    buttonText: {
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
        height: '50%',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        letterSpacing: '2px',
        textShadow: '0px 1px 3px rgba(0, 0, 0, 0.9)',
        color: '#ffd700',
    },
};

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

// 物品格子组件
interface ItemCellProps {
    index: number;
    item: BackpackItem | null;
    storageType: 'public' | 'private';
    onUseItem: (index: number, storageType: 'public' | 'private') => void;
    onDragStart: (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any) => boolean;
    onDragDrop: (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any) => void;
    onDragEnd: (panel: Panel, dragPanel: any) => void;
}

function ItemCell({ index, item, storageType, onUseItem, onDragStart, onDragDrop, onDragEnd }: ItemCellProps) {
    const [isHovered, setIsHovered] = useState(false);
    const cellStyle = isHovered ? styles.itemCellHover : styles.itemCell;

    // 获取物品品质配置
    const itemConfig = item ? getItemConfig(item.itemName) : null;
    const rarityFrame = itemConfig ? getRarityFrame(itemConfig.rarity) : null;

    return (
        <Panel
            style={cellStyle}
            onmouseover={() => setIsHovered(true)}
            onmouseout={() => setIsHovered(false)}
        >
            <Button
                style={styles.itemButton}
                draggable={true}
                onactivate={() => onUseItem(index, storageType)}
                // @ts-ignore
                onDragStart={(p: Panel, d: any) => onDragStart(index, storageType, p, d)}
                // @ts-ignore
                onDragDrop={(p: Panel, d: any) => onDragDrop(index, storageType, p, d)}
                // @ts-ignore
                onDragEnd={(p: Panel, d: any) => onDragEnd(p, d)}
            >
                {item && (
                    <>
                        {/* 有品质的物品: 品质边框 + 透明图标 */}
                        {rarityFrame && itemConfig ? (
                            <>
                                {/* Layer 1: 品质边框背景 */}
                                <Image
                                    src={rarityFrame}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        position: '0px 0px 0px' as const,
                                    }}
                                />
                                {/* Layer 2: 物品透明图标 */}
                                <Image
                                    src={itemConfig.icon}
                                    style={{
                                        width: '85%',
                                        height: '85%',
                                        position: '4px 4px 0px' as const,
                                    }}
                                />
                            </>
                        ) : (
                            // 无品质的物品: 默认 DOTAItemImage
                            <DOTAItemImage
                                itemname={item.itemName}
                                style={{ width: '100%', height: '100%' }}
                            />
                        )}
                        {/* Layer 3: 堆叠数量 */}
                        {item.stackable && item.charges > 1 && (
                            <Panel style={{ width: '100%', height: '30%', position: '0px 35px 0px' }} hittest={false}>
                                <Label style={styles.stackCount} text={String(item.charges)} />
                            </Panel>
                        )}
                    </>
                )}
            </Button>
        </Panel>
    );
}


// 单个仓库区域组件
interface StorageSectionProps {
    title: string;
    cellCount: number;
    storageType: 'public' | 'private';
    items: (BackpackItem | null)[];
    showCloseBtn?: boolean;
    onClose?: () => void;
    onUseItem: (index: number, storageType: 'public' | 'private') => void;
    onDragStart: (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any) => boolean;
    onDragDrop: (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any) => void;
    onDragEnd: (panel: Panel, dragPanel: any) => void;
}

function StorageSection({
    title,
    cellCount,
    storageType,
    items,
    showCloseBtn,
    onClose,
    onUseItem,
    onDragStart,
    onDragDrop,
    onDragEnd
}: StorageSectionProps) {
    const cells = [];
    for (let i = 0; i < cellCount; i++) {
        cells.push(
            <ItemCell
                key={`${storageType}_${i}`}
                index={i}
                item={items[i] || null}
                storageType={storageType}
                onUseItem={onUseItem}
                onDragStart={onDragStart}
                onDragDrop={onDragDrop}
                onDragEnd={onDragEnd}
            />
        );
    }

    return (
        <Panel style={styles.storageSection}>
            <Panel style={styles.sectionTitleBar}>
                <Panel style={styles.sectionTitleWrapper}>
                    <Label style={styles.sectionTitle} text={title} />
                    <Panel style={styles.titleUnderline} />
                </Panel>
                {showCloseBtn && onClose && (
                    <Button style={styles.internalCloseBtn} onactivate={onClose}>
                        <Label style={styles.closeBtnArrow} text="»" />
                    </Button>
                )}
            </Panel>
            <Panel style={styles.gridFrame}>
                <Panel style={styles.gridContainer}>
                    {cells}
                </Panel>
            </Panel>
        </Panel>
    );
}

// 按钮组件
function ActionButton({ id, text, width, height, marginLeft = 0, onClick }: {
    id: string;
    text: string;
    width: number;
    height: number;
    marginLeft?: number;
    onClick?: () => void;
}) {
    const handleClick = () => {
        $.Msg(`[Backpack] Button clicked: ${id}`);
        onClick?.();
    };

    const wrapperStyle = {
        width: `${width}px`,
        height: `${height}px`,
        marginLeft: `${marginLeft}px`,
        marginRight: '3px',
    };

    const imageStyle = {
        ...styles.buttonImage,
        width: '100%',
        height: '100%',
    };

    return (
        <Panel style={wrapperStyle}>
            <Button style={imageStyle} onactivate={handleClick}>
                <Label style={styles.buttonText} text={text} />
            </Button>
        </Panel>
    );
}

// 主背包组件
export function DefaultBackpackPanel() {
    $.Msg('[DefaultBackpack] ======= 组件已渲染 =======');
    const [isOpen, setIsOpen] = useState(true);
    const [publicItems, setPublicItems] = useState<(BackpackItem | null)[]>([]);
    const [privateItems, setPrivateItems] = useState<(BackpackItem | null)[]>([]);

    // 初始化物品数组
    useEffect(() => {
        const initPublic: (BackpackItem | null)[] = [];
        const initPrivate: (BackpackItem | null)[] = [];
        for (let i = 0; i < PUBLIC_STORAGE_SIZE; i++) initPublic.push(null);
        for (let i = 0; i < PRIVATE_BAG_SIZE; i++) initPrivate.push(null);
        setPublicItems(initPublic);
        setPrivateItems(initPrivate);
    }, []);

    // 订阅NetTable更新
    useEffect(() => {
        const playerId = Players.GetLocalPlayer();
        $.Msg(`[DefaultBackpack] 开始订阅 NetTable, playerId=${playerId}`);

        // 加载公用仓库数据
        const loadPublicData = () => {
            const data = CustomNetTables.GetTableValue('public_storage', `player_${playerId}`);
            if (data) {
                $.Msg(`[DefaultBackpack] 发现 public_storage 数据`);
                updateItemsFromNetTable(data, 'public');
            }
        };

        // 加载私人背包数据
        const loadPrivateData = () => {
            const data = CustomNetTables.GetTableValue('private_backpack', `player_${playerId}`);
            if (data) updateItemsFromNetTable(data, 'private');
        };

        // 初始加载
        loadPublicData();
        loadPrivateData();

        // 订阅公用仓库更新
        const publicListener = CustomNetTables.SubscribeNetTableListener('public_storage', (_, key, value) => {
            $.Msg(`[DefaultBackpack] 收到 public_storage 更新: key=${key}`);
            if (key === `player_${playerId}` && value) {
                updateItemsFromNetTable(value, 'public');
            }
        });

        // 订阅私人背包更新
        const privateListener = CustomNetTables.SubscribeNetTableListener('private_backpack', (_, key, value) => {
            if (key === `player_${playerId}` && value) {
                updateItemsFromNetTable(value, 'private');
            }
        });

        // 监听服务端发送的 backpack_updated 事件
        const backpackEventListener = GameEvents.Subscribe('backpack_updated' as any, (event: any) => {
            $.Msg(`[DefaultBackpack] 收到 backpack_updated 事件!`);
            if (event && event.items) {
                $.Msg(`[DefaultBackpack] 事件携带数据, 第一格=${JSON.stringify(event.items['0'])}`);
                updateItemsFromNetTable(event.items, 'public');
            }
        });

        return () => {
            CustomNetTables.UnsubscribeNetTableListener(publicListener);
            CustomNetTables.UnsubscribeNetTableListener(privateListener);
            GameEvents.Unsubscribe(backpackEventListener);
        };
    }, []);

    // 从NetTable数据更新物品列表
    const updateItemsFromNetTable = (data: any, storageType: 'public' | 'private') => {
        const size = storageType === 'public' ? PUBLIC_STORAGE_SIZE : PRIVATE_BAG_SIZE;
        const newItems: (BackpackItem | null)[] = [];
        for (let i = 0; i < size; i++) {
            newItems.push(data[i.toString()] || null);
        }
        if (storageType === 'public') {
            setPublicItems(newItems);
        } else {
            setPrivateItems(newItems);
        }
    };

    // 切换背包可见性
    const toggleInventory = () => {
        setIsOpen(!isOpen);
    };

    // 使用物品
    const handleUseItem = (index: number, storageType: 'public' | 'private') => {
        if (!isHeroCanCast()) return;
        const items = storageType === 'public' ? publicItems : privateItems;
        if (!items[index]) return;

        GameEvents.SendCustomGameEventToServer('backpack_use_item', {
            storageType: storageType,
            index: index,
            targetIndex: Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer()),
        } as never);
    };

    // 拖拽开始
    const handleDragStart = (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any): boolean => {
        if (!isHeroCanCast()) return false;
        const items = storageType === 'public' ? publicItems : privateItems;
        if (!items[index]) return false;

        const item = items[index]!;
        let displayPanel: any = $.CreatePanel('DOTAItemImage', $.GetContextPanel(), 'dragImage');
        displayPanel.itemname = item.itemName;
        displayPanel.style.height = `${panel.contentheight * 1.05}px`;
        displayPanel.style.width = `${panel.contentwidth * 1.05}px`;
        displayPanel.b_dragComplete = false;
        displayPanel.itemIndex = index;
        displayPanel.storageType = storageType;

        dragPanel.offsetX = 0;
        dragPanel.offsetY = 0;
        dragPanel.displayPanel = displayPanel;
        panel.style.opacity = '0.3';

        return true;
    };

    // 拖拽放下
    const handleDragDrop = (index: number, storageType: 'public' | 'private', _panel: Panel, dragPanel: any) => {
        if (dragPanel.itemIndex !== index || dragPanel.storageType !== storageType) {
            dragPanel.b_dragComplete = true;
            GameEvents.SendCustomGameEventToServer('backpack_swap_item', {
                sourceType: dragPanel.storageType,
                sourceIndex: dragPanel.itemIndex,
                targetType: storageType,
                targetIndex: index,
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
                    GameEvents.SendCustomGameEventToServer('backpack_drop_item', {
                        storageType: dragPanel.storageType,
                        index: dragPanel.itemIndex,
                        position: worldPosition,
                    } as never);
                }
            }
        });
    };

    // 功能按钮事件
    const handleCombineEquip = () => {
        GameEvents.SendCustomGameEventToServer('backpack_combine_equip', {} as never);
    };

    const handleCombineSkill = () => {
        GameEvents.SendCustomGameEventToServer('backpack_combine_skill', {} as never);
    };

    const handleTidyUp = () => {
        // 调试：手动读取 NetTable 数据
        const playerId = Players.GetLocalPlayer();
        const data = CustomNetTables.GetTableValue('public_storage', `player_${playerId}`);
        $.Msg(`[DefaultBackpack] 手动读取 public_storage: hasData=${!!data}, 第一格=${JSON.stringify((data as any)?.['0'])}`);

        if (data) {
            updateItemsFromNetTable(data, 'public');
        }

        GameEvents.SendCustomGameEventToServer('backpack_tidy_up', {} as never);
    };

    // 根据状态选择样式
    const wrapperStyle = isOpen ? styles.wrapperOpen : styles.wrapperClosed;
    const toggleTabStyle = isOpen ? styles.toggleTabHidden : styles.toggleTabVisible;

    return (
        <Panel style={wrapperStyle}>
            {/* 左侧手柄 - 关闭时可见，打开时隐藏 */}
            <Button style={toggleTabStyle} onactivate={toggleInventory} />

            {/* 背包主体 */}
            <Panel style={styles.outerFrame}>
                <Panel style={styles.innerContainer}>
                    {/* 公用仓库 */}
                    <StorageSection
                        title="公用仓库"
                        cellCount={PUBLIC_STORAGE_SIZE}
                        storageType="public"
                        items={publicItems}
                        showCloseBtn={isOpen}
                        onClose={toggleInventory}
                        onUseItem={handleUseItem}
                        onDragStart={handleDragStart}
                        onDragDrop={handleDragDrop}
                        onDragEnd={handleDragEnd}
                    />

                    {/* 私人背包 */}
                    <StorageSection
                        title="私人背包"
                        cellCount={PRIVATE_BAG_SIZE}
                        storageType="private"
                        items={privateItems}
                        onUseItem={handleUseItem}
                        onDragStart={handleDragStart}
                        onDragDrop={handleDragDrop}
                        onDragEnd={handleDragEnd}
                    />

                    {/* 底部按钮 */}
                    <Panel style={styles.buttonBar}>
                        <ActionButton
                            id="combine_equip"
                            text="合成装备"
                            width={130}
                            height={44}
                            marginLeft={0}
                            onClick={handleCombineEquip}
                        />
                        <ActionButton
                            id="combine_skill"
                            text="合成技能"
                            width={130}
                            height={44}
                            marginLeft={34}
                            onClick={handleCombineSkill}
                        />
                        <ActionButton
                            id="tidy_up"
                            text="整理"
                            width={90}
                            height={44}
                            marginLeft={34}
                            onClick={handleTidyUp}
                        />
                    </Panel>
                </Panel>
            </Panel>
        </Panel>
    );
}
