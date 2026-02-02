import React, { useState, useEffect, useRef } from 'react';
import { getItemConfig, getRarityFrame, getRarityBg, RARITY_BG_MAP, RARITY_FRAME_MAP, ITEM_CONFIG_MAP } from './itemRarityConfig';

// 预加载标记
let imagesPreloaded = false;

// 预加载所有品质背景图片 - 使用实际渲染预热 GPU 缓存
const preloadImages = (contextPanel: Panel) => {
    $.Msg('[Backpack] preloadImages 被调用');
    if (imagesPreloaded) {
        $.Msg('[Backpack] 图片已预加载过，跳过');
        return;
    }
    imagesPreloaded = true;

    try {
        $.Msg('[Backpack] 开始预加载图片...');

        // 创建一个屏幕外的容器来预加载所有图片
        const preloadContainer = $.CreatePanel('Panel', contextPanel, 'preloadContainer');
        preloadContainer.style.position = '-1000px -1000px 0px';  // 屏幕外
        preloadContainer.style.width = '200px';
        preloadContainer.style.height = '200px';
        preloadContainer.style.flowChildren = 'right-wrap';

        // 预加载背景图 - 使用 backgroundImage 属性
        (Object.values(RARITY_BG_MAP) as string[]).forEach((bgPath, i) => {
            const preloadPanel = $.CreatePanel('Panel', preloadContainer, `preloadBg_${i}`);
            preloadPanel.style.width = '48px';
            preloadPanel.style.height = '48px';
            preloadPanel.style.backgroundImage = `url("${bgPath}")`;
            preloadPanel.style.backgroundSize = '100% 100%';
        });

        // 预加载边框图
        (Object.values(RARITY_FRAME_MAP) as string[]).forEach((framePath, i) => {
            const preloadPanel = $.CreatePanel('Image', preloadContainer, `preloadFrame_${i}`);
            (preloadPanel as ImagePanel).SetImage(framePath);
            preloadPanel.style.width = '48px';
            preloadPanel.style.height = '48px';
        });

        // 预加载物品图标
        (Object.values(ITEM_CONFIG_MAP) as { rarity: number; icon: string }[]).forEach((config, i) => {
            const preloadPanel = $.CreatePanel('Image', preloadContainer, `preloadIcon_${i}`);
            (preloadPanel as ImagePanel).SetImage(config.icon);
            preloadPanel.style.width = '48px';
            preloadPanel.style.height = '48px';
        });

        // 5秒后删除预加载容器
        preloadContainer.DeleteAsync(5.0);

        $.Msg('[Backpack] 图片预加载完成');
    } catch (e) {
        $.Msg('[Backpack] 图片预加载失败: ' + e);
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
}

function ItemCell({ index, item, storageType, onUseItem, onDragStart, onDragDrop, onDragEnd, onHover }: ItemCellProps) {
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

    return (
        <Panel
            ref={cellRef as any}
            style={cellStyle}
            onmouseover={handleMouseOver}
            onmouseout={handleMouseOut}
            draggable={true}
            on-ui-DragStart={(p: Panel, d: any) => onDragStart(index, storageType, p, d)}
            on-ui-DragDrop={(p: Panel, d: any) => onDragDrop(index, storageType, p, d)}
            on-ui-DragEnd={(p: Panel, d: any) => onDragEnd(p, d)}
        >
            <Button
                style={styles.itemButton}
                onactivate={() => onUseItem(index, storageType)}
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
    onHover
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
        $.Msg(`[SkillReplace] 确认替换到槽位: ${slotKey}`);
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
    $.Msg('[DefaultBackpack] ======= 组件已渲染 =======');
    const [isOpen, setIsOpen] = useState(true);
    const [publicItems, setPublicItems] = useState<(BackpackItem | null)[]>([]);
    const [privateItems, setPrivateItems] = useState<(BackpackItem | null)[]>([]);
    const [hoveredItem, setHoveredItem] = useState<HoveredItemInfo | null>(null);
    const [skillReplaceData, setSkillReplaceData] = useState<SkillReplaceData | null>(null);
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
        } else {
            $.Msg('[Backpack] 无法获取 contextPanel，跳过预加载');
        }

        // 组件卸载时设置 isMountedRef = false
        return () => {
            isMountedRef.current = false;
        };
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
            $.Msg(`[DefaultBackpack] 收到 public_storage 更新: key=${key}`);
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
            $.Msg(`[DefaultBackpack] 收到 backpack_updated 事件!`);
            if (event) {
                // 新格式: event.publicItems 和 event.privateItems
                if (event.publicItems) {
                    $.Msg(`[DefaultBackpack] 更新公用仓库数据`);
                    updateItemsFromNetTableRef.current(event.publicItems, 'public');
                }
                if (event.privateItems) {
                    $.Msg(`[DefaultBackpack] 更新私人背包数据`);
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
            $.Msg(`[DefaultBackpack] 收到 skill_replace_prompt 事件!`);
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

        return () => {
            CustomNetTables.UnsubscribeNetTableListener(publicListener);
            CustomNetTables.UnsubscribeNetTableListener(privateListener);
            GameEvents.Unsubscribe(backpackEventListener);
            GameEvents.Unsubscribe(skillReplaceListener);
        };
    }, []);

    // 更新 ref 的实现（每次渲染更新，确保捕获最新的 state setter）
    updateItemsFromNetTableRef.current = (data: any, storageType: 'public' | 'private') => {
        try {
            // 检查组件是否已卸载
            if (!isMountedRef.current) {
                $.Msg(`[DefaultBackpack] 组件已卸载，跳过更新`);
                return;
            }

            // 检查 data 是否有效
            if (data === null || data === undefined) {
                $.Msg(`[DefaultBackpack] 数据为 null/undefined，跳过更新`);
                return;
            }

            if (typeof data !== 'object') {
                $.Msg(`[DefaultBackpack] 数据类型错误: ${typeof data}，跳过更新`);
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
            $.Msg(`[DefaultBackpack] updateItemsFromNetTable 错误: ${e}`);
        }
    };

    // 包装函数供外部使用
    const updateItemsFromNetTable = (data: any, storageType: 'public' | 'private') => {
        updateItemsFromNetTableRef.current(data, storageType);
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
        $.Msg(`[Backpack] 拖拽开始: ${storageType}[${index}]`);

        if (!isHeroCanCast()) return false;
        const items = storageType === 'public' ? publicItems : privateItems;
        if (!items[index]) {
            $.Msg(`[Backpack] 格子为空，取消拖拽`);
            return false;
        }

        const item = items[index]!;
        $.Msg(`[Backpack] 拖拽物品: ${item.itemName}`);

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

        $.Msg(`[Backpack] 拖拽已开始`);
        return true;
    };

    // 拖拽放下
    const handleDragDrop = (index: number, storageType: 'public' | 'private', _panel: Panel, dragPanel: any) => {
        $.Msg(`[Backpack] 拖拽放下触发: ${storageType}[${index}]`);

        // 从 ref 读取拖拽状态（更可靠）
        const dragState = dragStateRef.current;
        const sourceIndex = dragState?.itemIndex ?? dragPanel.itemIndex;
        const sourceType = dragState?.storageType ?? dragPanel.storageType;

        $.Msg(`[Backpack] 源位置: ${sourceType}[${sourceIndex}]`);

        if (sourceIndex === undefined || sourceType === undefined) {
            $.Msg(`[Backpack] 源位置无效，取消交换`);
            return;
        }

        if (sourceIndex !== index || sourceType !== storageType) {
            dragPanel.b_dragComplete = true;
            if (dragState) dragState.dragComplete = true;
            $.Msg(`[Backpack] 交换物品: ${sourceType}[${sourceIndex}] -> ${storageType}[${index}]`);
            GameEvents.SendCustomGameEventToServer('backpack_swap_item', {
                sourceType: sourceType,
                sourceIndex: sourceIndex,
                targetType: storageType,
                targetIndex: index,
            } as never);
        } else {
            $.Msg(`[Backpack] 放回原位，不交换`);
        }
    };

    // 拖拽结束
    const handleDragEnd = (panel: Panel, dragPanel: any) => {
        $.Msg(`[Backpack] 拖拽结束`);

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

        const dragComplete = dragState?.dragComplete ?? dragPanel.b_dragComplete;
        if (dragComplete) {
            $.Msg(`[Backpack] 拖拽完成`);
            dragStateRef.current = null;
            return;
        }

        // 丢弃到地面
        const sourceType = dragState?.storageType ?? dragPanel.storageType;
        const sourceIndex = dragState?.itemIndex ?? dragPanel.itemIndex;

        $.Schedule(0.01, () => {
            // 检查组件是否已卸载
            if (!isMountedRef.current) {
                return;
            }

            try {
                const pos = GameUI.GetCursorPosition();
                const worldPosition = GameUI.GetScreenWorldPosition(pos);

                if (worldPosition) {
                    const queryUnit = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
                    const isValidHero = Entities.IsControllableByPlayer(queryUnit, Players.GetLocalPlayer()) &&
                        Entities.IsHero(queryUnit) &&
                        !Entities.IsIllusion(queryUnit);

                    if (isValidHero && sourceType && sourceIndex !== undefined) {
                        $.Msg(`[Backpack] 丢弃物品: ${sourceType}[${sourceIndex}]`);
                        GameEvents.SendCustomGameEventToServer('backpack_drop_item', {
                            storageType: sourceType,
                            index: sourceIndex,
                            position: worldPosition,
                        } as never);
                    }
                }
            } catch (e) {
                $.Msg(`[Backpack] handleDragEnd Schedule 错误: ${e}`);
            }
            dragStateRef.current = null;
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
                            text={hoveredItem.itemConfig?.displayName || hoveredItem.item.itemName.replace('item_', '').replace(/_/g, ' ')}
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
                            text={hoveredItem.itemConfig?.description || '暂无描述'}
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
        </>
    );
}
