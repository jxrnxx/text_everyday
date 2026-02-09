import React, { useState, useEffect, useRef } from 'react';
import { getItemConfig, getLocalizedName, getLocalizedDesc, getRarityFrame, getRarityBg, RARITY_BG_MAP, RARITY_FRAME_MAP, ITEM_CONFIG_MAP, isItemUsable, isSkillBook, getSellPrice } from './itemRarityConfig';

// 预加载标记
let imagesPreloaded = false;
let preloadContainer: Panel | null = null;

// 预加载所有品质背景图片 - 使用实际渲染预热 GPU 缓存
// 改进：使用更大尺寸预加载，保持容器存活更长时间
const preloadImages = (contextPanel: Panel) => {
    if (imagesPreloaded && preloadContainer) {
        return;
    }
    imagesPreloaded = true;

    try {
        // 如果已存在旧容器，先删除
        const existingContainer = contextPanel.FindChildTraverse('preloadContainer');
        if (existingContainer) {
            existingContainer.DeleteAsync(0);
        }

        // 创建一个屏幕外的容器来预加载所有图片
        preloadContainer = $.CreatePanel('Panel', contextPanel, 'preloadContainer');
        preloadContainer.style.position = '-2000px -2000px 0px';  // 屏幕外更远位置
        preloadContainer.style.width = '400px';
        preloadContainer.style.height = '400px';
        preloadContainer.style.flowChildren = 'right-wrap';
        preloadContainer.style.visibility = 'collapse';  // 不可见但仍会触发加载

        // 预加载背景图 - 使用更大尺寸确保完全加载
        (Object.values(RARITY_BG_MAP) as string[]).forEach((bgPath, i) => {
            const preloadPanel = $.CreatePanel('Panel', preloadContainer!, `preloadBg_${i}`);
            preloadPanel.style.width = '64px';
            preloadPanel.style.height = '64px';
            preloadPanel.style.backgroundImage = `url("${bgPath}")`;
            preloadPanel.style.backgroundSize = '100% 100%';
            preloadPanel.style.backgroundRepeat = 'no-repeat';
        });

        // 预加载边框图
        (Object.values(RARITY_FRAME_MAP) as string[]).forEach((framePath, i) => {
            const preloadPanel = $.CreatePanel('Image', preloadContainer!, `preloadFrame_${i}`);
            (preloadPanel as ImagePanel).SetImage(framePath);
            preloadPanel.style.width = '64px';
            preloadPanel.style.height = '64px';
        });

        // 预加载物品图标
        (Object.values(ITEM_CONFIG_MAP) as { rarity: number; icon: string }[]).forEach((config, i) => {
            const preloadPanel = $.CreatePanel('Image', preloadContainer!, `preloadIcon_${i}`);
            (preloadPanel as ImagePanel).SetImage(config.icon);
            preloadPanel.style.width = '64px';
            preloadPanel.style.height = '64px';
        });

        // 延长预加载容器存活时间到30秒，确保图片完全加载到 GPU 缓存
        preloadContainer.DeleteAsync(30.0);

    } catch (e) {
        // 出错时重置标记，允许重试
        imagesPreloaded = false;
        preloadContainer = null;
    }
};

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

// 技能替换数据接口
interface SkillReplaceData {
    skill_to_learn: string;
    skill_book_name: string;
    available_slots: string[];
    occupied_slots: { slot: number; key: string; abilityName: string }[];
    storage_type: 'public' | 'private';
    item_index: number;
}

// 样式定义 - 墨玉(Dark Jade)主题
const styles = {
    // ===== 包装容器 - 打开状态 =====
    wrapperOpen: {
        flowChildren: 'right' as const,
        horizontalAlign: 'right' as const,
        verticalAlign: 'center' as const,
        marginRight: '0px',
        transform: 'translateX(0px)',
        transitionProperty: 'transform',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
    },

    // ===== 包装容器 - 关闭状态 =====
    wrapperClosed: {
        flowChildren: 'right' as const,
        horizontalAlign: 'right' as const,
        verticalAlign: 'center' as const,
        marginRight: '0px',
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
        height: '510px',
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
        height: '40px',
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

// 悬停物品信息接口
interface HoveredItemInfo {
    item: BackpackItem;
    itemConfig: ReturnType<typeof getItemConfig>;
    x: number;
    y: number;
}

// 右键菜单信息接口
interface ContextMenuInfo {
    item: BackpackItem;
    itemConfig: ReturnType<typeof getItemConfig>;
    index: number;
    storageType: 'public' | 'private';
    x: number;
    y: number;
}

// 物品格子组件
interface ItemCellProps {
    index: number;
    item: BackpackItem | null;
    storageType: 'public' | 'private';
    onUseItem: (index: number, storageType: 'public' | 'private') => void;
    onDragStart: (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any) => boolean;
    onDragDrop: (index: number, storageType: 'public' | 'private', panel: Panel, dragPanel: any) => void;
    onDragEnd: (panel: Panel, dragPanel: any) => void;
    onHover: (info: HoveredItemInfo | null) => void;
    onContextMenu: (info: ContextMenuInfo | null) => void;
}

function ItemCell({ index, item, storageType, onUseItem, onDragStart, onDragDrop, onDragEnd, onHover, onContextMenu }: ItemCellProps) {
    const [isHovered, setIsHovered] = useState(false);
    const cellRef = useRef<Panel | null>(null);

    // 获取物品品质配置
    const itemConfig = item ? getItemConfig(item.itemName) : null;
    const rarityFrame = itemConfig ? getRarityFrame(itemConfig.rarity) : null;
    const rarityBg = itemConfig ? getRarityBg(itemConfig.rarity) : null;

    // 品质对应的发光颜色
    const glowColors: Record<number, string> = {
        1: '#aaaaaa',  // 凡品 - 灰色
        2: '#22ff88',  // 灵品 - 绿色
        3: '#aa44ff',  // 仙品 - 紫色
        4: '#ffaa00',  // 神品 - 橙色
    };
    const glowColor = itemConfig ? (glowColors[itemConfig.rarity] || '#ffffff') : '#ffffff';

    // 完全硬编码样式，避免任何 undefined 值
    // 重要：两个样式对象必须有完全相同的属性集，否则 Panorama 无法处理属性移除

    // 基础格子样式（无物品时）
    const emptyCellStyle = {
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        margin: `${CELL_GAP}px`,
        backgroundColor: '#00000088',
        backgroundImage: 'none',  // 必须有此属性
        backgroundSize: '100% 100%',  // 必须有此属性
        backgroundRepeat: 'no-repeat',  // 必须有此属性
        border: '1px solid #454545',
        borderRadius: '3px',
        boxShadow: 'inset 0px 0px 8px #000000',
        transitionProperty: 'border, box-shadow, background-color',
        transitionDuration: '0.15s',
    };

    // 有物品时的样式
    const itemCellStyle = {
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        margin: `${CELL_GAP}px`,
        backgroundColor: 'transparent',
        backgroundImage: rarityBg ? `url("${rarityBg}")` : 'none',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        border: '0px solid transparent',
        borderRadius: '3px',
        boxShadow: isHovered
            ? `0px 0px 8px ${glowColor}aa, inset 0px 0px 4px ${glowColor}33`
            : `0px 0px 2px ${glowColor}55`,
        transitionProperty: 'border, box-shadow, background-color',
        transitionDuration: '0.15s',
    };

    // 选择样式
    const cellStyle = (item && rarityBg) ? itemCellStyle : emptyCellStyle;

    // 处理鼠标悬停
    const handleMouseOver = () => {
        setIsHovered(true);
        if (item) {
            // 获取面板位置用于显示提示框
            const panel = cellRef.current;
            let x = 0, y = 0;
            if (panel) {
                const pos = panel.GetPositionWithinWindow();
                x = pos.x;
                y = pos.y;
            }
            onHover({
                item,
                itemConfig,
                x,
                y,
            });
        }
    };

    const handleMouseOut = () => {
        setIsHovered(false);
        onHover(null);
    };

    // 处理右键菜单
    const handleRightClick = () => {
        if (!item) return;

        try {
            // 获取格子位置，在右侧显示菜单
            let x = 100, y = 100;
            const panel = cellRef.current;
            if (panel && panel.GetPositionWithinWindow) {
                const pos = panel.GetPositionWithinWindow();
                if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                    x = pos.x + CELL_SIZE;  // 格子右侧
                    y = pos.y;              // 格子顶部
                }
            }

            onContextMenu({
                item,
                itemConfig,
                index,
                storageType,
                x,
                y,
            });
        } catch (e) {
            // 出错时使用默认位置
            onContextMenu({
                item,
                itemConfig,
                index,
                storageType,
                x: 100,
                y: 100,
            });
        }
    };

    return (
        <Panel
            ref={cellRef as any}
            style={cellStyle}
            onmouseover={handleMouseOver}
            onmouseout={handleMouseOut}
            oncontextmenu={handleRightClick}
            draggable={true}
            on-ui-DragStart={(p: Panel, d: any) => onDragStart(index, storageType, p, d)}
            on-ui-DragDrop={(p: Panel, d: any) => onDragDrop(index, storageType, p, d)}
            on-ui-DragEnd={(p: Panel, d: any) => onDragEnd(p, d)}
        >
            <Button
                style={styles.itemButton}
                ondblclick={() => onUseItem(index, storageType)}
            >
                {item && (
                    <>
                        {/* 边框层 - 始终显示品质边框 */}
                        {rarityFrame && (
                            <Image
                                src={rarityFrame}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    horizontalAlign: 'center',
                                    verticalAlign: 'center',
                                    opacity: '1.0',
                                }}
                                hittest={false}
                            />
                        )}
                        {/* 物品图标 - 使用透明图标或默认图标 */}
                        {itemConfig ? (
                            <Image
                                src={itemConfig.icon}
                                style={{
                                    width: '99%',
                                    height: '99%',
                                    horizontalAlign: 'center' as const,
                                    verticalAlign: 'center' as const,
                                }}
                                hittest={false}
                            />
                        ) : (
                            <DOTAItemImage
                                itemname={item.itemName}
                                style={{ width: '100%', height: '100%' }}
                                hittest={false}
                            />
                        )}
                        {/* 堆叠数量 */}
                        {item.stackable && item.charges > 1 && (
                            <Panel
                                style={{
                                    flowChildren: 'right' as const,
                                    horizontalAlign: 'right' as const,
                                    verticalAlign: 'bottom' as const,
                                    marginBottom: '2px',
                                    marginRight: '4px',
                                }}
                                hittest={false}
                            >
                                <Label
                                    text={item.charges.toString()}
                                    style={{
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        fontWeight: 'bold' as const,
                                        textShadow: '0px 0px 2px #000000',
                                    }}
                                />
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
    onHover: (info: HoveredItemInfo | null) => void;
    onContextMenu: (info: ContextMenuInfo | null) => void;
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
    onDragEnd,
    onHover,
    onContextMenu
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
                onHover={onHover}
                onContextMenu={onContextMenu}
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

// 右键菜单按钮组件 - 带hover效果
interface ContextMenuButtonProps {
    text: string;
    textColor?: string;
    isLast?: boolean;
    onClick: () => void;
}

function ContextMenuButton({ text, textColor = '#e6cfa0', isLast = false, onClick }: ContextMenuButtonProps) {
    const [isHovered, setIsHovered] = useState(false);

    // 计算hover时的高亮颜色
    const getHoverColor = (color: string) => {
        // 简单实现：hover时使用更亮的金色
        if (color === '#ffcc44') return '#ffe066';
        if (color === '#ff6666') return '#ff8888';
        return '#fff0c8'; // 默认hover色
    };

    const btnStyle = {
        width: '100%',
        height: '32px',
        backgroundColor: isHovered
            ? 'gradient(linear, 0% 0%, 100% 0%, from(#b8860b00), color-stop(0.5, #b8860b44), to(#b8860b00))'
            : 'transparent',
        borderBottom: isLast ? '0px' : '1px solid #ffffff08',
    };

    const labelStyle = {
        color: isHovered ? getHoverColor(textColor) : textColor,
        fontSize: '14px',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        textShadow: isHovered ? '0px 0px 6px rgba(255, 200, 100, 0.5)' : '0px 1px 2px black',
        letterSpacing: '1px',
    };

    return (
        <Button
            style={btnStyle}
            onactivate={onClick}
            onmouseover={() => setIsHovered(true)}
            onmouseout={() => setIsHovered(false)}
        >
            <Label style={labelStyle} text={text} />
        </Button>
    );
}

// 技能替换弹窗组件
function SkillReplaceModal({
    data,
    onClose
}: {
    data: SkillReplaceData;
    onClose: () => void;
}) {
    // 获取玩家阶位 (从NetTable读取)
    const playerId = Players.GetLocalPlayer();
    const statsData = CustomNetTables.GetTableValue('custom_stats', `player_${playerId}`) as any;
    const playerRank = statsData?.rank || 0;

    // 技能名称映射
    const skillDisplayNames: Record<string, string> = {
        'ability_public_martial_cleave': '武道·横扫',
        // 可扩展更多技能
    };

    const getSkillDisplayName = (abilityName: string) => {
        return skillDisplayNames[abilityName] || abilityName.replace('ability_', '').replace(/_/g, ' ');
    };

    // 处理替换确认
    const handleConfirm = (slotKey: string) => {
        GameEvents.SendCustomGameEventToServer('cmd_skill_replace_confirm', {
            slot_key: slotKey,
            skill_to_learn: data.skill_to_learn,
            storage_type: data.storage_type,
            item_index: data.item_index,
        } as never);
        onClose();
    };

    // 弹窗样式
    const modalOverlayStyle = {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    };

    const modalBoxStyle = {
        width: '350px',
        flowChildren: 'down' as const,
        backgroundColor: 'linear-gradient(180deg, #1a2030 0%, #0d1520 100%)',
        border: '2px solid #b8860b',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.9)',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    };

    const titleStyle = {
        fontSize: '18px',
        fontWeight: 'bold' as const,
        color: '#ffd700',
        marginBottom: '16px',
        textShadow: '0px 0px 6px rgba(255, 215, 0, 0.5)',
    };

    const skillNameStyle = {
        fontSize: '16px',
        color: '#66ff88',
        marginBottom: '20px',
    };

    const slotButtonStyle = {
        width: '100%',
        height: '40px',
        marginBottom: '8px',
        backgroundColor: 'linear-gradient(180deg, #2a3a4a 0%, #1a2a3a 100%)',
        border: '1px solid #4a6a8a',
        borderRadius: '4px',
    };

    const slotButtonDisabledStyle = {
        ...slotButtonStyle,
        backgroundColor: '#333333',
        border: '1px solid #555555',
        opacity: '0.6',
    };

    const slotButtonTextStyle = {
        fontSize: '14px',
        color: '#ffffff',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    };

    const disabledTextStyle = {
        ...slotButtonTextStyle,
        color: '#888888',
    };

    const cancelButtonStyle = {
        width: '120px',
        height: '36px',
        marginTop: '16px',
        backgroundColor: 'linear-gradient(180deg, #4a3a3a 0%, #3a2a2a 100%)',
        border: '1px solid #8a5a5a',
        borderRadius: '4px',
        horizontalAlign: 'center' as const,
    };

    return (
        <Panel style={modalOverlayStyle}>
            <Panel style={modalBoxStyle}>
                {/* 标题 */}
                <Label style={titleStyle} text="技能格已满，请选择替换" />

                {/* 即将学习的技能 */}
                <Label style={skillNameStyle} text={`即将学习: ${getSkillDisplayName(data.skill_to_learn)}`} />

                {/* 技能槽位按钮 */}
                {data.occupied_slots.map((slot) => {
                    const isRSlot = slot.key === 'R';
                    const isDisabled = isRSlot && playerRank < 2;

                    return (
                        <Button
                            key={slot.key}
                            style={isDisabled ? slotButtonDisabledStyle : slotButtonStyle}
                            onactivate={isDisabled ? undefined : () => handleConfirm(slot.key)}
                        >
                            <Label
                                style={isDisabled ? disabledTextStyle : slotButtonTextStyle}
                                text={isDisabled
                                    ? `[${slot.key}] 需达到三阶(宗师)解锁`
                                    : `[${slot.key}] 替换 ${getSkillDisplayName(slot.abilityName)}`
                                }
                            />
                        </Button>
                    );
                })}

                {/* 如果R格不在occupied_slots但需要显示禁用状态 */}
                {playerRank < 2 && !data.occupied_slots.find(s => s.key === 'R') && (
                    <Button style={slotButtonDisabledStyle}>
                        <Label style={disabledTextStyle} text="[R] 需达到三阶(宗师)解锁" />
                    </Button>
                )}

                {/* 取消按钮 */}
                <Button style={cancelButtonStyle} onactivate={onClose}>
                    <Label style={slotButtonTextStyle} text="取消" />
                </Button>
            </Panel>
        </Panel>
    );
}


// 主背包组件
export function DefaultBackpackPanel() {
    const [isOpen, setIsOpen] = useState(true);
    const [publicItems, setPublicItems] = useState<(BackpackItem | null)[]>([]);
    const [privateItems, setPrivateItems] = useState<(BackpackItem | null)[]>([]);
    const [hoveredItem, setHoveredItem] = useState<HoveredItemInfo | null>(null);
    const [skillReplaceData, setSkillReplaceData] = useState<SkillReplaceData | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuInfo | null>(null);
    const panelRef = useRef<Panel | null>(null);

    // 跟踪组件是否已挂载，防止在卸载后更新状态
    const isMountedRef = useRef(true);

    // 拖拽状态（使用 ref 在事件之间保持状态）
    const dragStateRef = useRef<{
        itemIndex: number;
        storageType: 'public' | 'private';
        sourcePanel: Panel | null;
        displayPanel: any;
        dragComplete: boolean;
    } | null>(null);

    // 从NetTable数据更新物品列表 - 使用 useRef 包装确保闭包正确
    const updateItemsFromNetTableRef = useRef<(data: any, storageType: 'public' | 'private') => void>(() => { });

    // 初始化物品数组 + 预加载图片
    useEffect(() => {
        isMountedRef.current = true;

        const initPublic: (BackpackItem | null)[] = [];
        const initPrivate: (BackpackItem | null)[] = [];
        for (let i = 0; i < PUBLIC_STORAGE_SIZE; i++) initPublic.push(null);
        for (let i = 0; i < PRIVATE_BAG_SIZE; i++) initPrivate.push(null);
        setPublicItems(initPublic);
        setPrivateItems(initPrivate);

        // 立即预加载图片（不再延迟）
        const contextPanel = $.GetContextPanel();
        if (contextPanel) {
            preloadImages(contextPanel);
        }

        // 组件卸载时设置 isMountedRef = false
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // 订阅NetTable更新
    useEffect(() => {
        const playerId = Players.GetLocalPlayer();

        // 加载公用仓库数据
        const loadPublicData = () => {
            const data = CustomNetTables.GetTableValue('public_storage', `player_${playerId}`);
            if (data) {
                updateItemsFromNetTableRef.current(data, 'public');
            }
        };

        // 加载私人背包数据
        const loadPrivateData = () => {
            const data = CustomNetTables.GetTableValue('private_backpack', `player_${playerId}`);
            if (data) updateItemsFromNetTableRef.current(data, 'private');
        };

        // 初始加载
        loadPublicData();
        loadPrivateData();

        // 订阅公用仓库更新
        const publicListener = CustomNetTables.SubscribeNetTableListener('public_storage', (_, key, value) => {
            if (key === `player_${playerId}` && value) {
                updateItemsFromNetTableRef.current(value, 'public');
            }
        });

        // 订阅私人背包更新
        const privateListener = CustomNetTables.SubscribeNetTableListener('private_backpack', (_, key, value) => {
            if (key === `player_${playerId}` && value) {
                updateItemsFromNetTableRef.current(value, 'private');
            }
        });

        // 监听服务端发送的 backpack_updated 事件
        const backpackEventListener = GameEvents.Subscribe('backpack_updated' as any, (event: any) => {
            if (event) {
                // 新格式: event.publicItems 和 event.privateItems
                if (event.publicItems) {
                    updateItemsFromNetTableRef.current(event.publicItems, 'public');
                }
                if (event.privateItems) {
                    updateItemsFromNetTableRef.current(event.privateItems, 'private');
                }
                // 兼容旧格式
                if (event.items && !event.publicItems && !event.privateItems) {
                    updateItemsFromNetTableRef.current(event.items, 'public');
                }
            }
        });

        // 监听技能替换提示事件
        const skillReplaceListener = GameEvents.Subscribe('skill_replace_prompt', (event: any) => {
            if (event && isMountedRef.current) {
                setSkillReplaceData({
                    skill_to_learn: event.skill_to_learn,
                    skill_book_name: event.skill_book_name,
                    available_slots: event.available_slots,
                    occupied_slots: event.occupied_slots,
                    storage_type: event.storage_type,
                    item_index: event.item_index,
                });
            }
        });

        // 监听玩家发出移动命令时关闭右键菜单
        const orderListener = GameEvents.Subscribe('dota_player_update_query_unit', () => {
            setContextMenu(null);
        });
        const orderListener2 = GameEvents.Subscribe('dota_player_update_selected_unit', () => {
            setContextMenu(null);
        });

        return () => {
            CustomNetTables.UnsubscribeNetTableListener(publicListener);
            CustomNetTables.UnsubscribeNetTableListener(privateListener);
            GameEvents.Unsubscribe(backpackEventListener);
            GameEvents.Unsubscribe(skillReplaceListener);
            GameEvents.Unsubscribe(orderListener);
            GameEvents.Unsubscribe(orderListener2);
        };
    }, []);

    // 更新 ref 的实现（每次渲染更新，确保捕获最新的 state setter）
    updateItemsFromNetTableRef.current = (data: any, storageType: 'public' | 'private') => {
        try {
            // 检查组件是否已卸载
            if (!isMountedRef.current) {
                return;
            }

            // 检查 data 是否有效
            if (data === null || data === undefined) {
                return;
            }

            if (typeof data !== 'object') {
                return;
            }

            const size = storageType === 'public' ? PUBLIC_STORAGE_SIZE : PRIVATE_BAG_SIZE;
            const newItems: (BackpackItem | null)[] = [];

            for (let i = 0; i < size; i++) {
                const key = i.toString();
                const item = data[key];

                // 确保物品数据有效
                if (item && typeof item === 'object' && 'itemName' in item && item.itemName) {
                    newItems.push({
                        itemName: item.itemName,
                        itemId: item.itemId || 0,
                        charges: item.charges || 1,
                        stackable: item.stackable || false,
                    });
                } else {
                    newItems.push(null);
                }
            }

            if (storageType === 'public') {
                setPublicItems(newItems);
            } else {
                setPrivateItems(newItems);
            }
        } catch (e) {
        }
    };

    // 包装函数供外部使用
    const updateItemsFromNetTable = (data: any, storageType: 'public' | 'private') => {
        updateItemsFromNetTableRef.current(data, storageType);
    };

    // 切换背包可见性
    const toggleInventoryRef = useRef<() => void>(() => { });
    toggleInventoryRef.current = () => setIsOpen(prev => !prev);

    const toggleInventory = () => {
        toggleInventoryRef.current();
    };

    // 暴露 toggle 到全局，供 B 键快捷键调用
    useEffect(() => {
        (GameUI as any).ToggleBackpack = () => {
            toggleInventoryRef.current();
        };
    }, []);

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
        if (!items[index]) {
            return false;
        }

        const item = items[index]!;

        // 使源格子半透明
        panel.style.opacity = '0.5';

        // 获取物品配置
        const itemConfig = getItemConfig(item.itemName);
        const rarityBg = itemConfig ? getRarityBg(itemConfig.rarity) : null;

        // 创建可见的拖拽预览
        const displayPanel: any = $.CreatePanel('Panel', $.GetContextPanel(), 'dragImage');
        displayPanel.style.width = '48px';
        displayPanel.style.height = '48px';
        displayPanel.style.borderRadius = '4px';

        // 设置背景
        if (rarityBg) {
            displayPanel.style.backgroundImage = `url("${rarityBg}")`;
            displayPanel.style.backgroundSize = '100% 100%';
        } else {
            displayPanel.style.backgroundColor = '#333333aa';
        }

        // 添加物品图标
        if (itemConfig && itemConfig.icon) {
            const iconImage: any = $.CreatePanel('Image', displayPanel, 'dragIcon');
            iconImage.SetImage(itemConfig.icon);
            iconImage.style.width = '44px';
            iconImage.style.height = '44px';
            iconImage.style.horizontalAlign = 'center';
            iconImage.style.verticalAlign = 'center';
        }

        // 存储拖拽信息到 ref（确保跨事件共享）
        dragStateRef.current = {
            itemIndex: index,
            storageType: storageType,
            sourcePanel: panel,
            displayPanel: displayPanel,
            dragComplete: false,
        };

        // 同时存储到 dragPanel（Panorama 需要）
        dragPanel.displayPanel = displayPanel;
        dragPanel.sourcePanel = panel;
        dragPanel.itemIndex = index;
        dragPanel.storageType = storageType;
        dragPanel.b_dragComplete = false;
        dragPanel.offsetX = 0;
        dragPanel.offsetY = 0;

        return true;
    };

    // 拖拽放下
    const handleDragDrop = (index: number, storageType: 'public' | 'private', _panel: Panel, dragPanel: any) => {

        // 从 ref 读取拖拽状态（更可靠）
        const dragState = dragStateRef.current;
        const sourceIndex = dragState?.itemIndex ?? dragPanel.itemIndex;
        const sourceType = dragState?.storageType ?? dragPanel.storageType;

        if (sourceIndex === undefined || sourceType === undefined) {
            return;
        }

        if (sourceIndex !== index || sourceType !== storageType) {
            dragPanel.b_dragComplete = true;
            if (dragState) dragState.dragComplete = true;
            GameEvents.SendCustomGameEventToServer('backpack_swap_item', {
                sourceType: sourceType,
                sourceIndex: sourceIndex,
                targetType: storageType,
                targetIndex: index,
            } as never);
        } else {
        }
    };

    // 拖拽结束
    const handleDragEnd = (panel: Panel, dragPanel: any) => {
        // 从 ref 读取拖拽状态
        const dragState = dragStateRef.current;

        // 清理 displayPanel
        if (dragState?.displayPanel) {
            dragState.displayPanel.DeleteAsync(0);
        } else if (dragPanel.displayPanel) {
            dragPanel.displayPanel.DeleteAsync(0);
        }

        // 恢复透明度
        if (dragState?.sourcePanel) {
            dragState.sourcePanel.style.opacity = '1';
        } else if (dragPanel.sourcePanel) {
            dragPanel.sourcePanel.style.opacity = '1';
        }
        panel.style.opacity = '1';

        // 如果拖拽完成（成功放到其他格子），直接返回
        const dragComplete = dragState?.dragComplete ?? dragPanel.b_dragComplete;
        if (dragComplete) {
            dragStateRef.current = null;
            return;
        }

        // 如果拖拽没有完成（没放到有效格子上），物品保持原位不丢弃
        // 注释掉丢弃逻辑，防止物品意外消失
        // 如果将来需要支持丢弃功能，可以添加一个确认弹窗
        dragStateRef.current = null;
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

        if (data) {
            updateItemsFromNetTable(data, 'public');
        }

        GameEvents.SendCustomGameEventToServer('backpack_tidy_up', {} as never);
    };

    // ========== 右键菜单处理函数 ==========

    // 处理右键菜单显示
    const handleContextMenu = (info: ContextMenuInfo | null) => {
        // 关闭悬停提示
        setHoveredItem(null);
        // 设置右键菜单
        setContextMenu(info);
    };

    // 关闭右键菜单
    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // 使用物品（双击或右键使用）
    const handleMenuUseItem = () => {
        if (!contextMenu) return;
        handleUseItem(contextMenu.index, contextMenu.storageType);
        closeContextMenu();
    };

    // 存入仓库（私人背包 → 公用仓库）
    const handleStoreItem = () => {
        if (!contextMenu) return;
        GameEvents.SendCustomGameEventToServer('backpack_store_item', {
            sourceIndex: contextMenu.index,
        } as never);
        closeContextMenu();
    };

    // 取出物品（公用仓库 → 私人背包）
    const handleRetrieveItem = () => {
        if (!contextMenu) return;
        GameEvents.SendCustomGameEventToServer('backpack_retrieve_item', {
            sourceIndex: contextMenu.index,
        } as never);
        closeContextMenu();
    };

    // 出售物品
    const handleSellItem = () => {
        if (!contextMenu) return;
        const rarity = contextMenu.itemConfig?.rarity || 1;
        const sellPrice = getSellPrice(rarity);
        GameEvents.SendCustomGameEventToServer('backpack_sell_item', {
            storageType: contextMenu.storageType,
            index: contextMenu.index,
            price: sellPrice,
        } as never);
        closeContextMenu();
    };

    // 根据状态选择样式
    const wrapperStyle = isOpen ? styles.wrapperOpen : styles.wrapperClosed;
    const toggleTabStyle = isOpen ? styles.toggleTabHidden : styles.toggleTabVisible;

    // 品质名称映射
    const rarityNames: Record<number, string> = {
        1: '凡品',
        2: '灵品',
        3: '仙品',
        4: '神品',
    };

    // 品质颜色映射
    const rarityColors: Record<number, string> = {
        1: '#c0c0c0',
        2: '#66cc66',
        3: '#cc66ff',
        4: '#ffaa00',
    };

    return (
        <>
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
                            onHover={setHoveredItem}
                            onContextMenu={handleContextMenu}
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
                            onHover={setHoveredItem}
                            onContextMenu={handleContextMenu}
                        />

                        {/* 底部按钮 */}
                        <Panel style={styles.buttonBar}>
                            <ActionButton
                                id="combine_equip"
                                text="合成装备"
                                width={110}
                                height={38}
                                marginLeft={0}
                                onClick={handleCombineEquip}
                            />
                            <ActionButton
                                id="combine_skill"
                                text="合成技能"
                                width={110}
                                height={38}
                                marginLeft={55}
                                onClick={handleCombineSkill}
                            />
                            <ActionButton
                                id="tidy_up"
                                text="整理"
                                width={80}
                                height={38}
                                marginLeft={55}
                                onClick={handleTidyUp}
                            />
                        </Panel>
                    </Panel>
                </Panel>
            </Panel>

            {/* 全局物品提示框 - 在最外层渲染 */}
            {hoveredItem && (() => {
                // 智能定位：背包在屏幕右侧，提示框始终显示在物品左侧
                const tooltipWidth = 220;
                const itemX = hoveredItem.x;
                const itemY = hoveredItem.y;
                const screenHeight = Game.GetScreenHeight();

                // 始终在物品左侧显示，确保不超出左边界
                const tooltipX = Math.max(10, itemX - tooltipWidth - 10);

                // 确保不超出底部边界
                const tooltipY = Math.min(itemY, screenHeight - 150);


                return (
                    <Panel
                        style={{
                            position: `${tooltipX}px ${tooltipY}px 0px` as const,
                            width: `${tooltipWidth}px`,
                            minHeight: '80px',
                            flowChildren: 'down' as const,
                            backgroundColor: 'rgba(15, 20, 25, 0.95)',
                            border: `2px solid ${hoveredItem.itemConfig ? (rarityColors[hoveredItem.itemConfig.rarity] || '#666666') : '#666666'}`,
                            borderRadius: '6px',
                            padding: '10px',
                            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.8)',
                        }}
                        hittest={false}
                    >
                        {/* 物品名称 */}
                        <Label
                            text={hoveredItem.itemConfig ? getLocalizedName(hoveredItem.item.itemName) : hoveredItem.item.itemName.replace('item_', '').replace(/_/g, ' ')}
                            style={{
                                color: hoveredItem.itemConfig ? (rarityColors[hoveredItem.itemConfig.rarity] || '#ffffff') : '#ffffff',
                                fontSize: '16px',
                                fontWeight: 'bold' as const,
                                marginBottom: '4px',
                                textShadow: '0px 0px 4px rgba(0, 0, 0, 0.8)',
                            }}
                        />
                        {/* 品质 */}
                        {hoveredItem.itemConfig && (
                            <Label
                                text={`[${rarityNames[hoveredItem.itemConfig.rarity] || '未知'}]`}
                                style={{
                                    color: rarityColors[hoveredItem.itemConfig.rarity] || '#888888',
                                    fontSize: '12px',
                                    marginBottom: '8px',
                                }}
                            />
                        )}
                        {/* 描述 */}
                        <Label
                            html={true}
                            text={hoveredItem.itemConfig ? getLocalizedDesc(hoveredItem.item.itemName) : '暂无描述'}
                            style={{
                                color: '#cccccc',
                                fontSize: '13px',
                                textOverflow: 'clip' as const,
                                whiteSpace: 'normal' as const,
                            }}
                        />
                        {/* 堆叠数量提示 */}
                        {hoveredItem.item.stackable && hoveredItem.item.charges > 1 && (
                            <Label
                                text={`数量: ${hoveredItem.item.charges}`}
                                style={{
                                    color: '#aaaaaa',
                                    fontSize: '12px',
                                    marginTop: '6px',
                                }}
                            />
                        )}
                    </Panel>
                );
            })()}

            {/* 技能替换弹窗 */}
            {skillReplaceData && (
                <SkillReplaceModal
                    data={skillReplaceData}
                    onClose={() => setSkillReplaceData(null)}
                />
            )}

            {/* 右键菜单 */}
            {contextMenu && contextMenu.item && (() => {
                const menuX = contextMenu.x || 100;
                const menuY = contextMenu.y || 100;
                const isPublicStorage = contextMenu.storageType === 'public';
                const itemName = contextMenu.item.itemName || '';
                const canUse = itemName ? isItemUsable(itemName) : false;
                const isBook = itemName ? isSkillBook(itemName) : false;
                const rarity = contextMenu.itemConfig?.rarity || 1;
                const sellPrice = getSellPrice(rarity);

                // 浮玉石板风格菜单样式
                const menuContainerStyle = {
                    position: `${menuX}px ${menuY}px 0px`,
                    width: '140px',
                    flowChildren: 'down',
                    padding: '1px',
                    // 深翠绿渐变背景
                    backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#052224fa), to(#000b0dfa))',
                    // 古金色边框
                    border: '1px solid #b8860b',
                    borderRadius: '4px',
                    // 悬浮投影效果
                    boxShadow: '0px 5px 20px #000000ee',
                };

                const menuBtnStyle = {
                    width: '100%',
                    height: '32px',
                    backgroundColor: 'transparent',
                    // 底部分隔线
                    borderBottom: '1px solid #ffffff08',
                };

                const menuLabelStyle = {
                    color: '#e6cfa0', // 香槟金
                    fontSize: '14px',
                    horizontalAlign: 'center' as const,
                    verticalAlign: 'center' as const,
                    textShadow: '0px 1px 2px black',
                    letterSpacing: '1px',
                };

                return (
                    <>
                        {/* 遮罩层 */}
                        <Panel
                            style={{
                                width: '100%',
                                height: '100%',
                                position: '0px 0px 0px',
                                backgroundColor: 'transparent',
                            }}
                            onactivate={closeContextMenu}
                            oncontextmenu={closeContextMenu}
                        />
                        {/* 菜单 */}
                        <Panel style={menuContainerStyle}>
                            {isPublicStorage ? (
                                <ContextMenuButton
                                    text="取出"
                                    onClick={handleRetrieveItem}
                                    isLast={true}
                                />
                            ) : (
                                <>
                                    {canUse && (
                                        <ContextMenuButton
                                            text={isBook ? "参悟" : "使用"}
                                            textColor="#ffcc44"
                                            onClick={handleMenuUseItem}
                                        />
                                    )}
                                    <ContextMenuButton
                                        text="存入仓库"
                                        onClick={handleStoreItem}
                                    />
                                    <ContextMenuButton
                                        text={`出售(${sellPrice})`}
                                        textColor="#ff6666"
                                        onClick={handleSellItem}
                                        isLast={true}
                                    />
                                </>
                            )}
                        </Panel>
                    </>
                );
            })()}
        </>
    );
}
